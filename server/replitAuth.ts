import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";
import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

// ========================================
// PRODUCTION SAFETY GUARD (CRITICAL)
// ========================================
// Replit Auth ONLY works in Replit environment (dev/staging)
// NEVER use Replit Auth in production deployments outside Replit
// This guard prevents accidental misconfiguration

if (process.env.NODE_ENV === "production" && !process.env.REPLIT_DOMAINS) {
  throw new Error(
    "FATAL: Replit Auth cannot be used in production without REPLIT_DOMAINS. " +
    "Either deploy on Replit OR implement proper OAuth provider (Google/GitHub/etc)"
  );
}

if (!process.env.REPLIT_DOMAINS) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Only require HTTPS in production
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUserFromOAuth(claims: any, userType?: 'employee' | 'customer'): Promise<{ userId: string; isNewUser: boolean }> {
  const replitAuthId = claims["sub"];
  const email = claims["email"];
  const firstName = claims["first_name"];
  const lastName = claims["last_name"];
  const profileImageUrl = claims["profile_image_url"];

  // Check if user already exists
  let user = await storage.getUserByReplitAuthId(replitAuthId);
  
  if (user) {
    // Existing user - update their info
    await storage.updateUser(user.id, {
      email: email || user.email,
      name: `${firstName || ""} ${lastName || ""}`.trim() || user.name,
      avatar: profileImageUrl || user.avatar,
    });
    
    return {
      userId: user.id,
      isNewUser: false,
    };
  }

  // New user - create user (single-tenant mode: no tenant creation needed)
  const displayName = `${firstName || ""} ${lastName || ""}`.trim() || email || "User";
  const finalUserType = userType || 'customer'; // Default to customer if not specified
  const approvalStatus = finalUserType === 'customer' ? 'approved' : 'pending_approval';
  const role = finalUserType === 'customer' ? 'customer' : 'agent';
  
  user = await storage.createUser({
    email: email || `user-${replitAuthId}@eaas.local`,
    name: displayName,
    avatar: profileImageUrl || null,
    role: role,
    replitAuthId,
    userType: finalUserType,
    approvalStatus: approvalStatus,
    requestedAt: finalUserType === 'employee' ? new Date() : undefined,
  });

  // Auto-create customer record in CRM if customer type and approved
  if (finalUserType === 'customer' && approvalStatus === 'approved') {
    try {
      await storage.createCustomer({
        name: user.name,
        email: user.email,
        phone: null,
        userId: user.id,
      });
    } catch (error) {
      console.error("Error creating customer record from OAuth:", error);
    }
  }

  return {
    userId: user.id,
    isNewUser: true,
  };
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  // Global store for userType during OAuth flow (keyed by session ID)
  const oauthUserTypeStore: Record<string, 'employee' | 'customer'> = {};

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user: any = {};
    updateUserSession(user, tokens);
    
    // Note: We'll set userType in the session during /api/login or /api/auth/replit
    // and retrieve it in /api/callback to pass through authentication process
    // The verify callback will receive it via user object after deserialization
    
    // For now, default to customer if no userType is available
    const userType = (user as any).oauthUserType as 'employee' | 'customer' | undefined;
    
    // Upsert user (single-tenant mode: no tenant context needed)
    const { userId, isNewUser } = await upsertUserFromOAuth(tokens.claims(), userType);
    
    // Store user ID in session
    user.userId = userId;
    user.isNewUser = isNewUser;
    user.userType = userType; // Keep userType for redirect logic
    
    verified(null, user);
  };

  for (const domain of process.env.REPLIT_DOMAINS!.split(",")) {
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${domain}/api/callback`,
        passReqToCallback: false, // Passport OpenID Strategy doesn't support passReqToCallback
      },
      verify,
    );
    passport.use(strategy);
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    const userType = (req.query.type as string) || 'customer'; // Default to customer
    // Store userType in session before OAuth redirect
    (req.session as any).oauthUserType = userType;
    
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });
  
  // Alternative OAuth endpoint to support frontend /api/auth/replit route
  app.get("/api/auth/replit", (req, res, next) => {
    const userType = (req.query.type as string) || 'customer';
    // Store userType in session before OAuth redirect
    (req.session as any).oauthUserType = userType;
    
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    // Retrieve userType from session (stored during /api/login or /api/auth/replit)
    const userType = (req.session as any).oauthUserType as 'employee' | 'customer' | undefined;
    
    passport.authenticate(`replitauth:${req.hostname}`, (err: any, user: any, info: any) => {
      if (err) {
        console.error("OAuth callback error:", err);
        return res.redirect("/login?error=oauth_failed");
      }
      
      if (!user) {
        console.error("OAuth callback failed - no user:", info);
        return res.redirect("/login?error=oauth_failed");
      }
      
      // Inject userType into user object before login
      user.oauthUserType = userType;
      user.userType = userType;
      
      // Login the user
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error("Login error:", loginErr);
          return res.redirect("/login?error=login_failed");
        }
        
        // Clean up session
        delete (req.session as any).oauthUserType;
        
        // Redirect based on userType
        const redirectUrl = userType === 'employee' ? "/" : "/shop";
        return res.redirect(redirectUrl);
      });
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;
  const session = req.session as any;

  // Support both OAuth (Passport) and local (email/password) authentication
  
  // Check for local authentication via session
  if (session?.userId) {
    return next();
  }

  // Check for OAuth authentication via Passport
  if (!req.isAuthenticated() || !user?.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};

// Legacy functions removed for single-tenant mode
// No longer needed: getTenantIdFromSession, getTenantIdFromSessionOrHeader

// Get user ID from authenticated session (supports both OAuth and local auth)
export function getUserIdFromSession(req: any): string | null {
  return req.user?.userId || req.session?.userId || null;
}

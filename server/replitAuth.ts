import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";
import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

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
      secure: true,
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
        status: 'active',
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

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback,
    req?: any
  ) => {
    const user: any = {};
    updateUserSession(user, tokens);
    
    // Extract userType from state parameter (set in OAuth redirect)
    const userType = req?.query?.type as 'employee' | 'customer' | undefined;
    
    // Upsert user (single-tenant mode: no tenant context needed)
    const { userId, isNewUser } = await upsertUserFromOAuth(tokens.claims(), userType);
    
    // Store user ID in session
    user.userId = userId;
    user.isNewUser = isNewUser;
    
    verified(null, user);
  };

  for (const domain of process.env.REPLIT_DOMAINS!.split(",")) {
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${domain}/api/callback`,
      },
      verify,
    );
    passport.use(strategy);
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    const userType = req.query.type || 'customer'; // Default to customer
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
      state: userType as string, // Pass userType through OAuth flow
    })(req, res, next);
  });
  
  // Alternative OAuth endpoint to support legacy /api/auth/replit route
  app.get("/api/auth/replit", (req, res, next) => {
    const userType = req.query.type || 'customer';
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
      state: userType as string,
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    // Extract userType from state parameter
    const userType = req.query.state as 'employee' | 'customer' | undefined;
    
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: userType === 'employee' ? "/admin/dashboard" : "/shop",
      failureRedirect: "/login",
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

  if (!req.isAuthenticated() || !user.expires_at) {
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

// Get user ID from authenticated session
export function getUserIdFromSession(req: any): string | null {
  return req.user?.userId || null;
}

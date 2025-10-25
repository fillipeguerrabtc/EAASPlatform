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

async function upsertUserFromOAuth(claims: any): Promise<{ userId: string; tenantId: string; isNewUser: boolean }> {
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
      tenantId: user.tenantId,
      isNewUser: false,
    };
  }

  // New user - create default personal tenant
  const displayName = `${firstName || ""} ${lastName || ""}`.trim() || email || "User";
  const subdomain = `user-${replitAuthId}`;
  
  const tenant = await storage.createTenant({
    name: `${displayName}'s Workspace`,
    subdomain,
    status: "active",
  });

  // Create user linked to their personal tenant
  user = await storage.createUser({
    tenantId: tenant.id,
    email: email || `user-${replitAuthId}@eaas.local`,
    name: displayName,
    avatar: profileImageUrl || null,
    role: "tenant_admin",
    replitAuthId,
  });

  // Add user to their tenant in the membership table
  await storage.addUserToTenant({
    userId: user.id,
    tenantId: tenant.id,
    role: "tenant_admin",
  });

  return {
    userId: user.id,
    tenantId: tenant.id,
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
    verified: passport.AuthenticateCallback
  ) => {
    const user: any = {};
    updateUserSession(user, tokens);
    
    // Upsert user and get their tenant context
    const { userId, tenantId, isNewUser } = await upsertUserFromOAuth(tokens.claims());
    
    // Store user ID and tenant ID in session
    user.userId = userId;
    user.tenantId = tenantId;
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
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
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

// Get tenant ID from authenticated session (throws 401 if missing)
export function getTenantIdFromSession(req: any): string {
  if (!req.user || !req.user.tenantId) {
    throw new Error("Unauthorized: No tenant context in session");
  }
  return req.user.tenantId;
}

// Get tenant ID from session with fallback (for backward compatibility)
export function getTenantIdFromSessionOrHeader(req: any): string {
  if (req.user && req.user.tenantId) {
    return req.user.tenantId;
  }
  // Fallback for backward compatibility with header-based approach
  return req.headers["x-tenant-id"] as string || "default";
}

// Get user ID from authenticated session
export function getUserIdFromSession(req: any): string | null {
  return req.user?.userId || null;
}

# Production Security Headers Solution

## Problem
External security review requires production security headers (CSP, cache-control, etc.) but `server/vite.ts` is a protected file that cannot be edited.

## Solution
Add Express middleware in `server/index.ts` BEFORE routes are registered to set security headers for ALL responses (including static assets served by Vite).

## Implementation Location
Add this middleware in `server/index.ts` BEFORE `registerRoutes(app)` call:

```typescript
// ========================================
// PRODUCTION SECURITY HEADERS (MIDDLEWARE)
// ========================================
if (process.env.NODE_ENV === "production") {
  app.use((req, res, next) => {
    // CSP: Content Security Policy
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self' data:",
        "connect-src 'self' https:",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; ")
    );

    // Clickjacking prevention
    res.setHeader("X-Frame-Options", "DENY");

    // MIME sniffing prevention
    res.setHeader("X-Content-Type-Options", "nosniff");

    // XSS protection (legacy, but still useful)
    res.setHeader("X-XSS-Protection", "1; mode=block");

    // Referrer policy
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

    // Permissions policy (disable unused features)
    res.setHeader(
      "Permissions-Policy",
      "geolocation=(), microphone=(), camera=(), payment=()"
    );

    // Cache control for static assets (immutable)
    if (/\.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|webp|ico)$/i.test(req.path)) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    } else if (req.path.endsWith("index.html") || req.path === "/") {
      // Never cache HTML (SPA entry point)
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    }

    next();
  });
}
```

## Why This Works
- Express middleware processes ALL requests before they reach routes or static file serving
- Headers are set universally for HTML, JS, CSS, images, and API responses
- Production-only guard prevents dev environment issues
- No modification to protected `vite.ts` required

## Testing
1. Build production bundle: `npm run build`
2. Start production server: `NODE_ENV=production npm start`
3. Inspect headers: `curl -I https://your-app.replit.app`
4. Verify CSP, X-Frame-Options, Cache-Control headers present

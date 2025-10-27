# 🚀 EAAS Platform - Deployment Guide

> Complete deployment guide for production environments

---

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Replit Deployment](#replit-deployment)
- [Custom Domain](#custom-domain)
- [Performance Optimization](#performance-optimization)
- [Monitoring & Logging](#monitoring--logging)
- [Backup & Recovery](#backup--recovery)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

- **Node.js**: 18+ (LTS recommended)
- **PostgreSQL**: 14+
- **RAM**: Minimum 512MB, Recommended 1GB+
- **Storage**: 5GB+ (for assets, screenshots, logs)
- **SSL Certificate**: Required for production (handled by Replit automatically)

### External Services

1. **Stripe** - Payment processing
   - [Sign up](https://stripe.com)
   - Get API keys from Dashboard → Developers → API keys
   
2. **Twilio** - WhatsApp integration
   - [Sign up](https://www.twilio.com/whatsapp)
   - Get Account SID, Auth Token, WhatsApp number
   
3. **OpenAI** - AI capabilities
   - [Sign up](https://platform.openai.com)
   - Create API key

---

## Environment Variables

### Required Secrets

Add these to your Replit Secrets (or `.env` for local development):

```bash
# Database (Neon PostgreSQL - auto-provided on Replit)
DATABASE_URL=postgresql://user:password@host:5432/database
PGHOST=host.neon.tech
PGDATABASE=database
PGUSER=user
PGPASSWORD=password
PGPORT=5432

# Session
SESSION_SECRET=random-64-char-string  # Generate with: openssl rand -hex 32

# Stripe
STRIPE_API_KEY=sk_live_...  # Use sk_test_... for development
VITE_STRIPE_PUBLIC_KEY=pk_live_...  # Use pk_test_... for development

# Twilio WhatsApp
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# OpenAI
OPENAI_API_KEY=sk-proj-...

# Replit Auth (auto-provided on Replit)
REPLIT_DOMAINS=your-domain.replit.app
```

### Optional Secrets

```bash
# SLA Worker (disabled by default)
ENABLE_SLA_WORKER=true

# Storage Directory (defaults to ./.storage)
STORAGE_DIR=./.storage

# Environment (auto-detected)
NODE_ENV=production
```

### Generating SESSION_SECRET

```bash
# macOS/Linux
openssl rand -hex 32

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Output: e4a8b9c2d1f3e5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0
```

---

## Database Setup

### Automatic Setup (Replit)

Replit provides a managed Neon PostgreSQL database:

1. Click **Database** in left sidebar
2. Click **Create database**
3. Environment variables auto-populate in Secrets

### Manual Setup (Custom Hosting)

```bash
# 1. Create PostgreSQL database
createdb eaas_production

# 2. Set DATABASE_URL
export DATABASE_URL="postgresql://user:password@localhost:5432/eaas_production"

# 3. Initialize schema
npm run db:push

# 4. Verify tables
psql $DATABASE_URL -c "\dt"
```

### Schema Migration

```bash
# Push schema changes
npm run db:push

# If changes fail, force push (CAUTION: May lose data)
npm run db:push --force

# Generate migrations (for version control)
npm run db:generate
npm run db:migrate
```

---

## Replit Deployment

### Publishing Your App

1. **Click "Publish"** button in top-right corner
2. **Configure deployment**:
   - App name: `eaas-platform`
   - Domain: `eaas-platform.replit.app` (or custom domain)
   - Build command: Auto-detected (`npm run dev`)
   - Start command: Auto-detected (`npm run dev`)
   
3. **Configure secrets** (see Environment Variables section)

4. **Deploy**: Click "Publish to Production"

### Deployment Status

Check deployment status:
- **Console** tab: View build logs
- **Deployments** page: See deployment history
- **Logs** tab: Real-time application logs

---

## Custom Domain

### Setup

1. **Replit Dashboard** → Your Repl → **Domains**
2. **Add custom domain**: `yourdomain.com`
3. **Configure DNS** at your registrar:

```dns
CNAME @ yourdomain.replit.app
```

Or for subdomain:
```dns
CNAME www yourdomain.replit.app
```

4. **SSL Certificate**: Auto-provisioned by Replit (Let's Encrypt)

### Verification

```bash
# Check DNS propagation
dig yourdomain.com CNAME

# Test HTTPS
curl -I https://yourdomain.com
```

---

## Performance Optimization

### Frontend Optimization

**Vite Build**:
```bash
# Build for production (automatic on Replit)
npm run build

# Verify bundle size
ls -lh dist/assets/
```

**Code Splitting**:
```typescript
// Lazy load pages
const MarketplaceRouter = lazy(() => import('./pages/MarketplaceRouter'));
```

**Image Optimization**:
```typescript
// Use lazy loading
<img src={url} loading="lazy" alt="..." />

// Optimize images before upload (brand scanner)
// Consider adding WebP conversion
```

### Backend Optimization

**Database Indexing**:
```sql
-- Check indexes
SELECT tablename, indexname FROM pg_indexes WHERE schemaname = 'public';

-- Add index for slow queries
CREATE INDEX idx_products_category ON products(category_id);
```

**Connection Pooling**:
```typescript
// Already configured in server/storage.ts
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Max connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

**Caching**:
```typescript
// TanStack Query (frontend)
staleTime: 5 * 60 * 1000, // 5 minutes

// Express Static (backend)
app.use('/public', express.static(path, {
  maxAge: '1h' // Browser cache
}));
```

---

## Monitoring & Logging

### Application Logs

**Structured JSON Logging** (Pino):
```typescript
// Logs are JSON formatted
{"level":30,"time":1635724800000,"pid":1234,"msg":"Server started"}
```

**Log Levels**:
- `10` - TRACE (verbose debug)
- `20` - DEBUG
- `30` - INFO (default)
- `40` - WARN
- `50` - ERROR
- `60` - FATAL

### View Logs

**Replit Console**:
```bash
# Real-time logs
Click "Console" tab

# Filter errors
grep -i error logs.txt
```

**Production Monitoring**:
```bash
# Install monitoring tool (optional)
npm install @sentry/node @sentry/react

# Configure in server/index.ts
import * as Sentry from "@sentry/node";
Sentry.init({ dsn: "..." });
```

### Health Check Endpoint

```http
GET /health
```

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2025-10-27T12:34:56.789Z",
  "database": "connected",
  "uptime": 86400
}
```

---

## Backup & Recovery

### Database Backup

**Automatic (Neon)**:
- Replit's Neon database includes automatic backups
- Point-in-time recovery available

**Manual Backup**:
```bash
# Export database
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Compress
gzip backup-20251027.sql
```

### Restore Database

```bash
# Restore from backup
psql $DATABASE_URL < backup-20251027.sql

# Or compressed
gunzip -c backup-20251027.sql.gz | psql $DATABASE_URL
```

### File Storage Backup

```bash
# Backup .storage directory
tar -czf storage-backup-$(date +%Y%m%d).tar.gz .storage/

# Upload to cloud storage (optional)
# aws s3 cp storage-backup-20251027.tar.gz s3://my-bucket/
```

---

## Troubleshooting

### Common Issues

#### 1. "connect ECONNREFUSED"

**Cause**: Database connection failed

**Solution**:
```bash
# Check DATABASE_URL
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Restart database (Replit)
Click "Database" → "Restart"
```

---

#### 2. "Session secret is not set"

**Cause**: SESSION_SECRET not in environment

**Solution**:
```bash
# Generate secret
openssl rand -hex 32

# Add to Replit Secrets
SESSION_SECRET=<generated-secret>

# Restart app
```

---

#### 3. "Stripe webhook signature verification failed"

**Cause**: STRIPE_WEBHOOK_SECRET missing or incorrect

**Solution**:
```bash
# 1. Go to Stripe Dashboard → Webhooks
# 2. Copy "Signing secret"
# 3. Add to Replit Secrets
STRIPE_WEBHOOK_SECRET=whsec_...

# 4. Restart app
```

---

#### 4. "Port already in use"

**Cause**: Multiple instances running

**Solution**:
```bash
# Kill process on port 5000
lsof -ti:5000 | xargs kill -9

# Or restart Repl
```

---

#### 5. "Failed to extract palette from PNG"

**Cause**: @napi-rs/canvas not installed or platform incompatibility

**Solution**:
```bash
# Install dependency
npm install @napi-rs/canvas

# If platform incompatible, system falls back to client-side colors
# No action needed - graceful degradation works
```

---

#### 6. "Path traversal attempt detected"

**Cause**: Security feature working correctly

**Solution**: This is not an error - it's preventing a security vulnerability. Check your asset paths for malformed entries.

---

### Debug Mode

Enable verbose logging:

```bash
# Set environment variable
DEBUG=*

# Or specific namespaces
DEBUG=express:*,drizzle:*

# Restart app
```

---

### Performance Issues

**Slow Queries**:
```bash
# Enable query logging
# Add to DATABASE_URL
?options=-c log_min_duration_statement=100

# View slow queries in logs
```

**Memory Issues**:
```bash
# Check memory usage
ps aux | grep node

# Increase memory (Replit)
# Click "Repl Settings" → Increase resources
```

---

## Security Checklist

Before going to production:

- [ ] **Secrets**: All environment variables set
- [ ] **HTTPS**: SSL certificate active (automatic on Replit)
- [ ] **Session Secret**: 64+ random characters
- [ ] **Stripe Keys**: Live keys (not test keys)
- [ ] **CORS**: Configured for your domain
- [ ] **Rate Limiting**: Enabled (100 req/15min default)
- [ ] **Database**: Connection pooling configured
- [ ] **Backups**: Automated backups enabled
- [ ] **Monitoring**: Error tracking configured
- [ ] **Logs**: Reviewed for sensitive data
- [ ] **Dependencies**: Updated to latest stable versions

---

## Scaling

### Vertical Scaling (Replit)

Increase resources:
1. **Repl Settings** → **Resources**
2. Increase RAM/CPU as needed
3. **Pricing**: See [Replit Pricing](https://replit.com/pricing)

### Horizontal Scaling (Future)

Not currently supported (single-tenant architecture). For multi-tenant:
- Load balancer (Nginx, HAProxy)
- Multiple app instances
- Shared database with connection pooling
- Redis for session storage
- CDN for static assets

---

## Rollback

If deployment fails:

1. **Replit Dashboard** → **Deployments**
2. Click **Rollback** on previous working deployment
3. **Verify**: Test critical endpoints
4. **Fix**: Address issues in development before redeploying

---

## Support

- **Documentation**: `/docs` directory
- **GitHub Issues**: [Open issue](https://github.com/your-repo/issues)
- **Replit Support**: [support.replit.com](https://support.replit.com)

---

**Ready to Deploy?** Follow this checklist and you'll be live in minutes! 🚀

# Changelog

All notable changes to the EAAS Platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.1.0] - 2025-10-27

### 🚀 Added - Brand Scanner 2.1 PRO Diamond Edition

#### Extract Mode (Advanced Analysis)
- **CIELAB Color Science**
  - `server/color.ts` - Complete sRGB ↔ XYZ ↔ LAB color space conversions
  - Gamma correction for accurate linear color math
  - K-Means clustering with clamping and rounding guards
  - ΔE (CIE76) color distance calculation for perceptual accuracy
  - Optional @napi-rs/canvas integration for PNG analysis
  
- **Typography Extraction**
  - `server/brandScannerTheme.ts` - Font-family detection from computed styles
  - @font-face parsing from inline and external stylesheets
  - Font weight enumeration with fallback chains
  - Bounds checks (string length, weight validation)
  
- **Design Tokens Generation**
  - `buildDesignTokens()` - Combines client + server-side analysis
  - Complete ThemeTokens structure (colors, typography, spacing, borderRadius)
  - HSL format for seamless CSS variable injection
  - Graceful fallback when server enrichment fails

#### Clone Mode (Marketplace Integration)
- **Asset Management**
  - `server/brandCloneManifest.ts` - SHA256-based asset deduplication
  - Asset type classification (image, video, SVG, other)
  - Byte-size tracking for storage optimization
  - `server/marketplaceCloner.ts` - CDN publishing to `.storage/public/marketplace/`
  
- **Layout Heuristics**
  - Automatic page blueprint generation (hero, section, gallery, footer, nav, content)
  - Route mapping with layout hints
  - Manifest.json creation with publishedAt timestamps
  
- **Security Hardening**
  - Path traversal prevention using `path.relative()` (fixed critical vulnerability)
  - Script sanitization in static HTML snapshots
  - Atomic file writes (temp file + rename) for transactional safety

#### Dynamic Theming & Marketplace
- **Admin Theme Applier**
  - `server/adminThemeApplier.ts` - Injects tokens into theme.json + generated.css
  - Transactional writes to prevent partial updates
  - CSS variable generation with proper HSL format
  
- **Marketplace Router**
  - `client/src/pages/MarketplaceRouter.tsx` - Dynamic routing based on manifest
  - Lazy-loads manifest.json via TanStack Query with 5min stale, 30min gc
  - Loading/error states with professional UI
  - 404 fallback for unknown routes
  
- **Marketplace Components** (6 reusable components)
  - `client/src/components/marketplace/Nav.tsx` - Responsive navigation with mobile menu
  - `client/src/components/marketplace/Hero.tsx` - Background image, dark overlay, CTA
  - `client/src/components/marketplace/Section.tsx` - Generic section + SectionCard (3 variants)
  - `client/src/components/marketplace/Gallery.tsx` - Grid (2/3/4 cols) with lightbox modal
  - `client/src/components/marketplace/Footer.tsx` - Sections, copyright, social links
  - `client/src/components/marketplace/BuyButton.tsx` - Loading/success states, Intl price formatting
  
- **Type System**
  - `client/src/types/brandScanner.ts` - Complete TypeScript types
  - ThemeTokens, CloneManifest, MarketplaceManifest, PublishedAsset, etc.
  - Full alignment with backend schema

#### API Endpoints
- `POST /api/brand-scanner/apply-admin-theme` - Apply tokens to admin interface (with Zod validation)
- `POST /api/brand-scanner/clone-to-marketplace` - Publish assets + manifest (with auth)
- Updated brand scanner job endpoints to include advanced fields (palette, typography, manifest)

#### Dependencies
- Added `@napi-rs/canvas` - Optional PNG analysis for CIELAB extraction
- Added `culori` - Color space conversions
- Updated `server/routes.ts` - Static file serving for `/public` → `.storage/public`

### 🔒 Security Fixes
1. **Path Traversal Prevention** - `marketplaceCloner.ts` now uses `path.relative()` instead of `startsWith()`
2. **Stripe API Key Fix** - `stripe.ts` uses `STRIPE_API_KEY` (not `STRIPE_SECRET_KEY`) with fallback
3. **Cache Poisoning Fix** - `useTokens` and `useManifest` hooks use distinct queryKeys

### 🐛 Bug Fixes
- Fixed hover transforms on marketplace Buttons (removed `hover:scale-105` to follow design guidelines)
- Fixed Zod validation for manifest tokens (added runtime check)
- Fixed TanStack Query cache collision between hooks

### 📚 Documentation
- Created `docs/BRAND_SCANNER.md` - Complete 600+ line guide with architecture, API reference, troubleshooting
- Updated `README.md` - Added Brand Scanner 2.1 PRO section with all new features
- Updated `replit.md` - Comprehensive technical implementation details
- Created `CHANGELOG.md` - This file!

### ⚡ Performance
- TanStack Query memoization for manifest (5min stale, 30min gc)
- SHA256 deduplication eliminates duplicate asset downloads
- Lazy loading for gallery images
- Express static serving with 1-hour browser cache

---

## [2.0.0] - 2025-10-24

### 🚀 Added - Core Platform Features

#### Marketplace & E-commerce
- Complete product management with variants and SKUs
- Shopping cart system (anonymous sessionId + authenticated)
- Stripe Checkout integration with webhook validation
- Product bundles with automatic discount calculation
- Public storefront at `/shop` with AI support
- Advanced search and filtering

#### CRM 360°
- Customer lifecycle management
- AI-powered lead scoring
- Drag-and-drop pipeline workflows
- Dynamic customer segmentation
- Activity tracking across all channels
- SLA management with automated escalation

#### Autonomous AI System
- POMDP Planner with Tree-of-Thought (ToT)
- Multi-Layer Critics (Factual, Numeric, Ethical, Risk)
- Hybrid RAG with semantic scoring
- Editable knowledge base (CRUD)
- AI Governance with LTL+D policies
- Decision tracing in `aiTraces` table
- Performance metrics in `aiMetrics` table

#### Omnichat
- Twilio WhatsApp Business API integration
- Admin dashboard with manual takeover
- Smart escalation rules
- Floating customer widget
- Full CRM integration

#### ERP Systems
- **Inventory**: Multi-warehouse, real-time stock, alerts
- **HR**: Employee lifecycle, payroll, attendance
- **Financial**: Revenue/expense tracking, DRE reports, KPIs
- **Suppliers**: Supplier CRUD with payment tracking
- **Purchase Orders**: Complete PO workflow

#### Brand Scanner PRO
- Extract Mode: Web crawler, color extraction, typography
- Clone Mode: Static HTML snapshots
- Dynamic theming via BrandThemeProvider
- Theme preview, activate, rollback, clear

#### Authentication
- Multi-Provider OAuth (Google, Apple, GitHub, X)
- Dual-Track System (Employee + Customer registration)
- RBAC with 5 roles
- Bcrypt hashing, secure sessions

#### Smart Calendar
- Event management (CRUD)
- Resource scheduling
- Conflict detection
- Recurring events

### 🛠️ Tech Stack
- **Frontend**: React 18 + TypeScript + Wouter + TailwindCSS + Shadcn UI
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL (Neon) with 32 tables via Drizzle ORM
- **External**: Stripe, Twilio, OpenAI, Puppeteer

### 🔒 Security
- Helmet.js, CORS, CSRF protection
- express-rate-limit
- Webhook signature validation
- Idempotency for critical operations
- Transaction safety

### 📚 Documentation
- `README.md` - Complete platform overview
- `docs/PROJECT_OVERVIEW.md` - Detailed architecture
- `docs/MARKETPLACE_E_CARRINHO.md` - Shopping system guide
- `docs/EAAS_360_Whitepaper.txt` - AI system mathematics

---

## [1.0.0] - 2025-10-20

### 🚀 Initial Release
- Basic EAAS platform architecture
- Single-tenant design
- PostgreSQL database setup
- React + Express foundation
- Authentication system
- Basic marketplace

---

## Versioning Strategy

- **MAJOR** (x.0.0): Breaking changes, major architectural shifts
- **MINOR** (2.x.0): New features, backward-compatible additions
- **PATCH** (2.1.x): Bug fixes, security patches, documentation

---

## Upgrade Guide

### From 2.0.0 to 2.1.0

1. **Install Dependencies**:
   ```bash
   npm install @napi-rs/canvas culori
   ```

2. **Database** - No schema changes required! All Brand Scanner 2.1 features use existing tables.

3. **Environment Variables** - No new secrets required.

4. **Static Files** - Verify `.storage/public` is served:
   ```typescript
   // Should already exist in server/routes.ts
   app.use("/public", express.static(`${STORAGE_DIR}/public`));
   ```

5. **Test Brand Scanner**:
   ```bash
   # Extract brand
   POST /api/brand-scanner/scan-url
   Body: { url: "https://example.com" }
   
   # Apply to admin
   POST /api/brand-scanner/apply-admin-theme
   Body: { tokens: { ... } }
   
   # Clone to marketplace
   POST /api/brand-scanner/clone-to-marketplace
   Body: { manifest: { ... } }
   ```

---

## Roadmap

### 2.2.0 (Planned)
- [ ] WebP conversion for PNG assets
- [ ] Responsive image generation (srcset)
- [ ] Video thumbnail extraction
- [ ] Real CDN integration (Cloudflare/AWS)
- [ ] Machine learning for layout detection

### 2.3.0 (Planned)
- [ ] A/B testing framework for themes
- [ ] Version control for themes (git-like)
- [ ] SVG optimization (SVGO)
- [ ] CSS minification
- [ ] Source maps for debugging

### 3.0.0 (Future)
- [ ] Multi-tenant support
- [ ] Distributed architecture
- [ ] Advanced AI features
- [ ] Real-time collaboration

---

**Questions?** Check the [documentation](./docs/) or open an issue on GitHub.

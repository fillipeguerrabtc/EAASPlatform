# 🚀 EAAS Platform - Everything As A Service

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Stripe](https://img.shields.io/badge/Stripe-008CDD?style=for-the-badge&logo=stripe&logoColor=white)](https://stripe.com/)
[![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com/)

> **Production-grade single-tenant PaaS** platform with autonomous AI, universal marketplace, 360° CRM, comprehensive ERP, omnichannel communication, and intelligent brand scanner.

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Project Structure](#-project-structure)
- [Security](#-security)
- [Development Status](#-development-status)
- [Documentation](#-documentation)
- [License](#-license)

---

## 🎯 Overview

**EAAS (Everything As A Service)** is an all-in-one Platform-as-a-Service designed to centralize critical business operations in a single, unified platform. Built with a **single-tenant architecture** for maximum performance, security, and AI effectiveness.

### Why EAAS?

- 🏪 **One Platform, Everything**: Marketplace, CRM, ERP, AI, Payments, Communication
- 🤖 **Autonomous AI**: Self-learning sales agent with multi-layer validation system
- 🔒 **Enterprise Security**: Production-grade security hardening, SSRF protection, webhook validation
- 🌍 **Internationalization**: Full PT-BR and EN support
- 🎨 **Silent Sophistication**: Timeless, precise design with dark mode support
- ⚡ **High Performance**: Optimized for speed with caching, lazy loading, and efficient queries

---

## ✨ Key Features

### 🏪 Universal Marketplace
- **Product Management**: Complete CRUD with variants, SKUs, and inventory tracking
- **Shopping Cart**: Anonymous (sessionId) and authenticated cart management
- **Stripe Checkout**: Secure payment processing with webhook integration
- **Search & Filters**: Advanced product search with category-based filtering
- **Product Bundles**: Automatic discount calculation for bundled products
- **Public Storefront** (`/shop`): Customer-facing marketplace with AI support

### 👥 CRM 360°
- **Customer Lifecycle**: Complete customer management with lifecycle tracking
- **Lead Scoring**: AI-powered lead qualification system
- **Workflows**: Automated workflow engine with drag-and-drop pipeline
- **Segmentation**: Dynamic customer segmentation
- **Activity Tracking**: Full interaction history across all channels
- **SLA Management**: Automated SLA monitoring and escalation

### 🤖 Autonomous AI System
- **POMDP Planner**: Tree-of-Thought (ToT) system based on Partially Observable Markov Decision Process
- **Multi-Layer Critics**: Factual, Numeric, Ethical, and Risk validation layers
- **Hybrid RAG**: Retrieval-Augmented Generation with semantic scoring
- **Knowledge Base**: Editable knowledge base with CRUD operations
- **AI Governance**: LTL+D policies with Lyapunov stability monitoring
- **Decision Tracing**: Complete audit trail of AI decisions in `aiTraces` table
- **Performance Metrics**: Aggregated AI performance stats in `aiMetrics` table

### 💬 Omnichat
- **WhatsApp Integration**: Twilio WhatsApp Business API with bot automation
- **Admin Dashboard**: Manage conversations with manual takeover and AI release
- **Smart Escalation**: Automatic human escalation based on rules
- **Floating Widget**: Customer-facing WhatsApp widget for 24/7 support
- **CRM Integration**: All conversations automatically logged in CRM

### 🏢 ERP Systems
- **Inventory Management**: Multi-warehouse, real-time stock tracking, low-stock alerts
- **HR Management**: Employee lifecycle, payroll, attendance, performance reviews
- **Financial Management**: Revenue/expense tracking, DRE reports, dynamic KPIs, budget tracking
- **Supplier Management**: Supplier CRUD with payment tracking
- **Purchase Orders**: Complete purchase order workflow

### 🎨 Brand Scanner 2.1 PRO - Diamond Edition
#### Extract Mode (Advanced Analysis)
- **CIELAB Color Science**: 
  - Accurate sRGB ↔ XYZ ↔ LAB color space conversions with gamma correction
  - K-Means clustering for palette extraction (with clamping/rounding guards)
  - ΔE (CIE76) color distance calculation for perceptual accuracy
  - Optional @napi-rs/canvas integration for PNG analysis
- **Typography Extraction**: 
  - Automatic font-family detection from computed styles
  - @font-face parsing from inline/external stylesheets
  - Font weight enumeration with fallback chains
- **Design Tokens Generation**: 
  - Combines client-side DOM analysis + server-side image processing
  - Generates complete ThemeTokens (colors, typography, spacing, border radius)
  - HSL format for seamless CSS variable injection
- **Security**: 
  - SSRF protection with DNS cache bypass
  - Private IP blocking (RFC 1918)
  - Redirect chain validation
  - robots.txt compliance

#### Clone Mode (Marketplace Integration)
- **Asset Management**: 
  - SHA256-based asset deduplication
  - CDN publishing to `.storage/public/marketplace/`
  - Asset type classification (image, video, SVG, other)
  - Byte-size tracking for storage optimization
- **Layout Heuristics**: 
  - Automatic page blueprint generation (hero, section, gallery, footer, nav)
  - Route mapping with layout hints
  - Manifest.json creation with publishedAt timestamps
- **Security Hardening**: 
  - Path traversal prevention using `path.relative()`
  - Script sanitization in static snapshots
  - Atomic file writes (temp file + rename)

#### Dynamic Theming & Marketplace
- **Admin Theme Applier**: 
  - Injects tokens into `theme.json` + `generated.css`
  - Transactional writes for data safety
  - CSS variable generation with HSL format
- **Marketplace Router**: 
  - Lazy-loads `manifest.json` with TanStack Query memoization
  - Dynamic page rendering based on layout hints
  - 6 reusable components (Nav, Hero, Section, Gallery, Footer, BuyButton)
  - Mobile-first responsive design
- **Theme Operations**: Preview, activate, rollback, clear themes via `BrandThemeProvider`

### 🔐 Multi-Provider Authentication
- **Replit Auth**: Google, Apple, GitHub, X OAuth integration
- **Dual-Track System**: 
  - **Employee Registration**: Admin approval required
  - **Customer Registration**: Auto-approved with automatic CRM record creation
- **RBAC**: 5 roles (super_admin, tenant_admin, manager, agent, customer)
- **Secure Sessions**: Bcrypt password hashing, secure cookies, JWT tokens

### 📅 Smart Calendar
- **Event Management**: Create, update, delete calendar events
- **Resource Scheduling**: Book rooms, equipment, personnel
- **Conflict Detection**: Prevent double-bookings
- **Recurring Events**: Support for repeating schedules

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **Styling**: TailwindCSS + Shadcn UI components
- **State Management**: TanStack Query v5 (React Query)
- **Forms**: React Hook Form + Zod validation
- **Charts**: Recharts
- **Drag & Drop**: @dnd-kit
- **Icons**: Lucide React
- **Internationalization**: i18next + react-i18next

### Backend
- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL (Neon) with 32 tables
- **ORM**: Drizzle ORM
- **Session Management**: express-session + connect-pg-simple
- **Authentication**: Passport.js + OpenID Connect
- **Rate Limiting**: express-rate-limit
- **Security**: Helmet.js, CORS, CSRF protection

### External Services
- **Payments**: Stripe (Checkout + Webhooks)
- **Messaging**: Twilio WhatsApp Business API
- **AI**: OpenAI (GPT models)
- **Browser Automation**: Puppeteer + Chromium (Brand Scanner)
- **Image Processing**: 
  - Jimp (logo detection, pHash)
  - @napi-rs/canvas (optional, CIELAB PNG analysis)
  - culori (color space conversions)

### DevOps & Tools
- **Build Tool**: Vite
- **Code Quality**: TypeScript strict mode, ESLint
- **Schema Validation**: Zod
- **Database Migrations**: Drizzle Kit
- **Logging**: Pino (structured JSON logs)

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: 18+ 
- **PostgreSQL**: 14+ (or use Replit's built-in Neon database)
- **Stripe Account**: For payment processing (sandbox mode for development)
- **Twilio Account**: For WhatsApp integration (optional)
- **OpenAI API Key**: For AI features (optional)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/fillipeguerrar/EAASPlatform.git
   cd EAASPlatform
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory (or use Replit Secrets):
   
   ```env
   # Database
   DATABASE_URL=postgresql://user:password@host:5432/database
   
   # Session
   SESSION_SECRET=your-random-32-char-secret-key
   
   # Stripe
   STRIPE_SECRET_KEY=sk_test_...
   VITE_STRIPE_PUBLIC_KEY=pk_test_...
   
   # Twilio (optional)
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
   
   # OpenAI (optional)
   OPENAI_API_KEY=sk-...
   
   # Replit Auth (optional, for OAuth)
   REPLIT_DOMAINS=your-repl-name.replit.app
   ```

4. **Initialize the database**
   ```bash
   npm run db:push
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   ```
   http://localhost:5000
   ```

### Default Credentials

The system creates a default super admin on first run:

- **Email**: `admin@eaas.com`
- **Password**: `admin123`

⚠️ **IMPORTANT**: Change this password immediately in production!

---

## 📁 Project Structure

```
EAASPlatform/
├── client/                    # Frontend React application
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   │   ├── ui/          # Shadcn UI components
│   │   │   ├── seo.tsx      # SEO meta tags
│   │   │   └── ...
│   │   ├── pages/           # Page components
│   │   │   ├── admin/       # Admin dashboard pages
│   │   │   ├── shop.tsx     # Public marketplace
│   │   │   └── my-account/  # Customer area
│   │   ├── lib/             # Utilities and helpers
│   │   ├── hooks/           # Custom React hooks
│   │   ├── locales/         # i18n translations (PT-BR, EN)
│   │   └── App.tsx          # Root component with routing
│   └── index.html           # HTML entry point
│
├── server/                   # Backend Node.js application
│   ├── index.ts             # Express server entry point
│   ├── routes.ts            # API route definitions
│   ├── storage.ts           # Database operations (Storage interface)
│   ├── auth.ts              # Local authentication (email/password)
│   ├── replitAuth.ts        # Replit OAuth authentication
│   ├── browser.ts           # Puppeteer wrapper with SSRF protection
│   ├── queue.ts             # Request queue system
│   └── vite.ts              # Vite middleware for development
│
├── shared/                   # Shared code between client and server
│   └── schema.ts            # Database schema (Drizzle ORM) + Zod schemas
│
├── docs/                     # Documentation
│   ├── PROJECT_OVERVIEW.md  # Project vision and architecture
│   └── MARKETPLACE_E_CARRINHO.md
│
├── migrations/               # Database migration files
├── attached_assets/          # Static assets (images, etc.)
├── design_guidelines.md      # UI/UX design principles
├── replit.md                 # Platform technical summary
├── CHECKLIST_120_ATIVIDADES.md  # Development checklist
└── README.md                 # This file
```

---

## 🔒 Security

EAAS implements **production-grade security** based on comprehensive external security reviews:

### 🛡️ Security Features

- **SSRF Protection**: 
  - DNS cache bypass with `dns.lookup({ all: true, verbatim: true })`
  - Validation of ALL resolved IPs (IPv4 + IPv6)
  - Blocks private ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16, etc.
  - HTTP redirect validation (prevents 30x redirects to private IPs)
  - Synchronous Puppeteer request interception

- **Webhook Security**:
  - Stripe signature validation with `express.raw()` inline parser
  - Twilio signature validation with `twilio.validateRequest()`
  - Idempotency via `webhookEvents` table (prevents replay attacks)
  - Atomic transactions for order processing

- **Authentication**:
  - JWT secrets require 32+ characters in production
  - Secure cookies: HttpOnly, Secure, SameSite=strict
  - Login rate limiting (anti brute-force)
  - Password reset with single-use tokens

- **Production Headers**:
  - Content-Security-Policy (CSP)
  - X-Frame-Options: DENY (clickjacking prevention)
  - X-Content-Type-Options: nosniff (MIME sniffing prevention)
  - X-XSS-Protection
  - Referrer-Policy: strict-origin-when-cross-origin
  - Permissions-Policy (disable unused features)
  - Cache-Control: immutable for assets, no-cache for HTML

- **CORS**: Restricted to allowed origins with localhost IP variants
- **Rate Limiting**: Per-IP request throttling
- **Request Queue**: Timeout cleanup to prevent memory leaks
- **Transaction Safety**: Atomic operations for critical workflows

### 🔍 Security Audit

All security implementations were reviewed and approved by an external security audit. See [PRODUCTION_HEADERS_SOLUTION.md](./PRODUCTION_HEADERS_SOLUTION.md) for implementation details.

---

## 📊 Development Status

**Current Progress**: ~20% (24/120 activities completed)

### ✅ Completed Modules

- **Foundation**: Authentication (multi-provider OIDC), RBAC, PostgreSQL + Drizzle, i18n, dark mode
- **Marketplace**: Product CRUD, hierarchical categories, cart management, Stripe checkout, product bundles
- **CRM**: Customer lifecycle, lead scoring, workflows, pipeline drag-and-drop
- **AI System**: POMDP Planner, Multi-Layer Critics, AI traces, AI metrics
- **Omnichat**: WhatsApp integration, admin dashboard, floating widget
- **ERP**: Inventory management, HR management, financial management, supplier management
- **Brand Scanner**: Extract & Clone modes, dynamic theming, CIELAB color extraction
- **Security**: Production-grade hardening (SSRF, webhooks, headers, CORS)

### 🚧 In Progress

- Advanced AI features (vector embeddings, semantic search)
- Email automation and drip campaigns
- Multi-currency support
- Advanced analytics and BI
- Mobile app (React Native)

See [CHECKLIST_120_ATIVIDADES.md](./CHECKLIST_120_ATIVIDADES.md) for the complete development roadmap.

---

## 📚 Documentation

- **[replit.md](./replit.md)**: Technical architecture and system overview
- **[docs/PROJECT_OVERVIEW.md](./docs/PROJECT_OVERVIEW.md)**: Project vision and MVP scope
- **[design_guidelines.md](./design_guidelines.md)**: UI/UX design principles
- **[CHECKLIST_120_ATIVIDADES.md](./CHECKLIST_120_ATIVIDADES.md)**: Complete development checklist
- **[PRODUCTION_HEADERS_SOLUTION.md](./PRODUCTION_HEADERS_SOLUTION.md)**: Security headers implementation

### API Documentation

API endpoints follow RESTful conventions. Key routes:

- **Authentication**: `/api/auth/*`
- **Products**: `/api/products/*`
- **Categories**: `/api/categories/*`
- **Cart**: `/api/cart/*`
- **Orders**: `/api/orders/*`
- **Customers**: `/api/customers/*`
- **CRM Workflows**: `/api/crm-workflows/*`
- **AI Knowledge**: `/api/ai-knowledge/*`
- **WhatsApp**: `/api/whatsapp/*`
- **Brand Scanner**: `/api/brand-scanner/*`
- **Webhooks**: `/api/stripe-webhook`, `/api/whatsapp-webhook`

All requests require authentication (except public routes like `/shop` and webhooks).

---

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit your changes**: `git commit -m 'Add amazing feature'`
4. **Push to the branch**: `git push origin feature/amazing-feature`
5. **Open a Pull Request**

### Coding Standards

- Follow TypeScript strict mode
- Use Zod for all schema validation
- Add `data-testid` attributes to interactive elements
- Use Shadcn UI components (don't create custom components)
- Follow the design guidelines in `design_guidelines.md`
- Write meaningful commit messages

---

## 📄 License

This project is proprietary software. All rights reserved.

**© 2025 Fillipe Guerra - EAAS Platform**

For licensing inquiries, please contact: [fillipe@eaas.com](mailto:fillipe@eaas.com)

---

## 🙏 Acknowledgments

- **Replit**: For the amazing development platform
- **Stripe**: For robust payment processing
- **OpenAI**: For powerful AI capabilities
- **Twilio**: For reliable WhatsApp integration
- **Shadcn UI**: For beautiful, accessible components
- **Drizzle ORM**: For type-safe database queries

---

## 📞 Support

For questions, issues, or feature requests:

- **GitHub Issues**: [Create an issue](https://github.com/fillipeguerrar/EAASPlatform/issues)
- **Email**: fillipe@eaas.com
- **Twitter**: [@fillipeguerra](https://twitter.com/fillipeguerra)

---

<div align="center">
  <strong>Built with ❤️ using TypeScript, React, and PostgreSQL</strong>
  <br />
  <sub>Powered by Replit | Secured by Design | Autonomous AI</sub>
</div>

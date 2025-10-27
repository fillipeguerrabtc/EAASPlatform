# EAAS - Everything As A Service Platform

### Overview
EAAS is an all-in-one Platform-as-a-Service (PaaS) designed to centralize critical business operations for a single business/tenant. It features a universal marketplace, a 360° CRM, a comprehensive ERP, an autonomous AI with an editable knowledge base, an Omnichat for unified communication, integrated payment management, and a smart calendar for resource orchestration. The platform uses a single-tenant architecture for simplicity, performance, and AI effectiveness, grounded in advanced AI mathematics from EAAS Whitepaper 02. The business vision is to provide a robust, AI-powered platform that streamlines operations, enhances customer engagement, and drives efficiency for businesses.

### User Preferences
- I prefer simple language and clear explanations.
- I like an iterative development approach.
- I prefer detailed explanations of changes and functionalities.
- Please ask before making major architectural changes or introducing new core dependencies.
- Ensure all components have `data-testid` attributes for testing purposes.
- Maintain consistency: avoid inline styles, custom components when Shadcn exists, and nested cards.
- Prioritize TypeScript strict mode and Zod for form validation.
- All API calls should use TanStack Query.
- Do not add mock data in production.
- **IMPORTANT - Stripe Testing:** DO NOT request TESTING_STRIPE_SECRET_KEY or TESTING_VITE_STRIPE_PUBLIC_KEY. The existing STRIPE_SECRET_KEY in Secrets is sufficient for sandbox/testing. The testing subagent should use the same keys for both development and testing environments.

### System Architecture

**UI/UX Decisions:**
The design philosophy emphasizes "silent sophistication" with a timeless, precise, and inevitable aesthetic. The color palette includes Primary Emerald Green (#10A37F), Deep Slate (#1C1C1E), Vibrant Purple (#8B5CF6), and True Black OLED-style (#0A0A0B). Typography uses Inter for primary text and JetBrains Mono for monospace. Design principles include clarity, consistent rhythm, hierarchical precision, adaptive complexity, and universal neutrality. Accessibility standards require all touch targets to be ≥44×44px. The platform uses a mobile-first responsive approach. Branding includes SEO optimization, a sticky header, dark sidebar navigation, and a theme toggle. Only Shadcn UI components are used. Full support for PT-BR and EN internationalization is provided.

**Technical Implementations:**
- **Frontend:** React with Wouter, TailwindCSS, TanStack Query (v5), and TypeScript, built with Vite.
- **Backend:** Node.js with Express, PostgreSQL (Neon) managed by Drizzle ORM, and TypeScript.
- **Architecture:** Single-tenant, Role-Based Access Control (RBAC).
- **URL Structure:** `/admin/*`, `/shop`, `/my-account`.
- **Database Schema:** 32 tables covering tenant settings, users, marketplace, CRM, Omnichat, AI knowledge base, payments, calendar events, Inventory, HR, AI Planning, and AI Governance (aiGovernance for LTL+D policies, aiTraces for Critics decision history, aiMetrics for aggregated stats).
- **Backend API:** Comprehensive CRUD operations with Zod validation.
- **Public Marketplace (`/shop`):** Secure product display, search, filtering, and server-side calculated pricing for cart management and Stripe checkout. Includes a complete product variants system with SKU-based inventory tracking and multi-option variants.
- **AI Autonomous Sales System:** Incorporates a Planner/ToT (Tree-of-Thought) System based on POMDP, a Multi-Layer Critics System for validation (Factual, Numeric, Ethical, Risk), and Hybrid RAG Scoring. Critics System is fully integrated in all AI response flows with persistence in `aiTraces` and aggregated metrics in `aiMetrics`.
- **ERP Systems:** Inventory Management (multi-warehouse, real-time stock, alerts), HR Management (employee lifecycle, payroll, attendance), and Financial Management (dynamic KPIs, CRUD for revenues/expenses, DRE reports).
- **Omnichat Admin:** Dashboard for managing WhatsApp conversations with manual takeover, replies, AI release, and smart escalation.
- **Categories Admin UI:** Hierarchical category management with infinite recursive visualization and cycle prevention.
- **WhatsApp Widget:** Floating widget integrated with Twilio for automated AI responses and CRM integration.
- **Shopping System:** Supports anonymous sessionId-based cart management and an authenticated customer area (`/my-account`) with order history, tracking, shopping cart, and 24/7 AI support.
- **Brand Scanner 2.1 PRO - Diamond Edition:** Advanced brand identity system with comprehensive analysis capabilities:
  - **Extract Mode**: Web crawler with SSRF protection (DNS cache bypass, private IP blocking, redirect validation), CIELAB color science (sRGB↔XYZ↔LAB conversions with gamma correction, K-Means clustering with guards, ΔE color distance), typography extraction (font-family detection, @font-face parsing, weight enumeration), design tokens generation (combines client/server-side data, ThemeTokens with HSL format), WCAG contrast validation, pHash logo detection, robots.txt compliance
  - **Clone Mode**: Static HTML snapshots with security-hardened script sanitization, SHA256-based asset deduplication, CDN publishing to `.storage/public/marketplace/`, asset type classification (image/video/SVG/other), layout heuristics (hero/section/gallery/footer/nav), manifest.json creation with publishedAt, path traversal prevention using `path.relative()`, atomic file writes
  - **Dynamic Theming**: Admin theme applier (injects tokens into theme.json + generated.css with transactional writes), BrandThemeProvider context (preview/activate/rollback/clear operations), marketplace router (lazy-loads manifest.json via TanStack Query, dynamic page rendering, 6 components: Nav/Hero/Section/Gallery/Footer/BuyButton)
  - **Technologies**: Puppeteer, @napi-rs/canvas (optional PNG analysis), culori (color conversions), Jimp (pHash), node-html-parser, robots-parser
  - **Database**: `brandJobs`, `themeBundles`, `cloneArtifacts` tables
  - **API**: 12 REST endpoints (added `/api/brand-scanner/apply-admin-theme`, `/api/brand-scanner/clone-to-marketplace`)
- **Brand Theming System:** Dynamically applies ThemeTokens as CSS variables via BrandThemeProvider context, supporting preview, activate, clear, and rollback operations.
- **Authentication:** Multi-Provider OAuth (Google, Apple, GitHub, X) and a Dual-Track Authentication System for Employee Registration (admin approval) and Customer Registration (auto-approved, creates CRM record) with Bcrypt hashing and RBAC. Includes single-tenant architecture enforcement, Stripe webhook idempotency, transaction safety for critical operations (e.g., order processing), CRM data quality (deduplication on email/phone), API pagination, CRM pipeline drag-and-drop with transactional reordering, an SLA worker system, and a persistent cart system. Portability and compatibility are ensured across different environments.

### External Dependencies
- **Stripe:** Payment processing.
- **Twilio WhatsApp:** WhatsApp integration.
- **OpenAI:** AI capabilities.
- **PostgreSQL (Neon):** Primary database.
- **Drizzle ORM:** Object-Relational Mapper.
- **Puppeteer + Chromium:** Intelligent Brand Scanner.
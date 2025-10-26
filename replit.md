# EAAS - Everything As A Service Platform

### Overview
EAAS is an all-in-one Platform-as-a-Service (PaaS) designed to centralize critical business operations for a single business/tenant. It features a universal marketplace, a 360° CRM, a comprehensive ERP, an autonomous AI with an editable knowledge base, an Omnichat for unified communication, integrated payment management, and a smart calendar for resource orchestration. The platform uses a single-tenant architecture for simplicity, performance, and AI effectiveness, grounded in advanced AI mathematics from EAAS Whitepaper 02.

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
The design philosophy emphasizes "silent sophistication" with a timeless, precise, and inevitable aesthetic.
- **Color Palette:** Primary Emerald Green (#10A37F), Deep Slate (#1C1C1E) for sidebar, Vibrant Purple (#8B5CF6) for accents, and True Black OLED-style (#0A0A0B) for dark mode.
- **Typography:** Inter for primary text and JetBrains Mono for monospace.
- **Design Principles:** Clarity, consistent rhythm, hierarchical precision, adaptive complexity, and universal neutrality.
- **Accessibility:** All touch targets are ≥44×44px.
- **Responsiveness:** Mobile-first approach with flexible layouts (flex-wrap + gap).
- **Branding:** Full SEO optimization, sticky header with backdrop blur, dark sidebar navigation, and a theme toggle.
- **Components:** Exclusive use of Shadcn UI components.
- **Internationalization:** Full support for PT-BR and EN.

**Technical Implementations:**
- **Frontend:** React with Wouter for routing, TailwindCSS for styling, TanStack Query (v5) for data fetching, and TypeScript. Developed with Vite.
- **Backend:** Node.js with Express, PostgreSQL (Neon) managed by Drizzle ORM, and TypeScript.
- **Architecture:** Single-tenant, Role-Based Access Control (RBAC).
- **URL Structure:** `/admin/*`, `/shop`, `/my-account`.
- **Database Schema:** 29 tables covering tenant settings, users, marketplace, CRM, Omnichat, AI knowledge base, payments, calendar events, Inventory, HR, and AI Planning.
- **Backend API:** Comprehensive CRUD operations with Zod validation.
- **Public Marketplace (`/shop`):** Secure product display, search, filtering, and server-side calculated pricing for cart management and Stripe checkout (sandbox).
- **AI Autonomous Sales System:** Incorporates a Planner/ToT (Tree-of-Thought) System based on POMDP for action planning, a Multi-Layer Critics System for validation (Factual, Numeric, Ethical, Risk), and Hybrid RAG Scoring for multi-component relevance. AI Governance Fields are configured in the `tenants` table.
- **Inventory Management ERP:** Complete inventory control with multi-warehouse support, real-time stock levels, automatic movement logging, and low-stock alerts.
- **HR Management ERP:** Complete human resources system with organizational hierarchy, employee lifecycle management, automated payroll, and attendance tracking.
- **Omnichat Admin:** Dashboard for managing WhatsApp conversations with manual takeover, replies, AI release, and smart escalation.
- **Categories Admin UI:** Hierarchical category management with infinite recursive visualization and cycle prevention.
- **Financial Management ERP:** Dashboard with dynamic KPIs, CRUD for revenues/expenses, and DRE reports.
- **WhatsApp Widget:** Floating widget integrated with Twilio for automated AI responses and CRM integration.
- **Anonymous Shopping System:** Supports sessionId-based cart management without authentication.
- **Customer Area (`/my-account`):** Authenticated customer dashboard with order history, tracking, shopping cart, and 24/7 AI support.
- **Brand Scanner PRO - Diamond Edition (PRODUCTION):** Advanced brand identity system with two modes achieving DIAMOND-grade paridade with market leaders (Figma Tokens + Pro Crawlers):
  - **Extract Mode (PRO):** 
    - **Crawler Controlado:** maxDepth=2, maxPages=10, frontier management with BFS, adaptive politeness
    - **CIELAB K-Means:** Perceptually uniform color clustering (not RGB), ΔE distance calculation, K-means++ initialization
    - **WCAG Contrast:** Automated AA/AAA compliance validation (4.5:1 normal, 3:1 large text), accessibility reports
    - **Image Sampling:** Hero/background color extraction via canvas sampling (not just CSS)
    - **pHash Logos:** Perceptual hashing for logo variants detection with Hamming distance deduplication
    - **Font Fallback:** Real rendered font detection vs declared font-stack
    - **Export Determinístico:** CSS variables + Tailwind.config.ts with complete tokens (color, font, spacing, radius, shadow, border)
  - **Clone Mode:** Creates static HTML snapshots with security-hardened script sanitization (allowlist-based, removes inline scripts and event handlers). Supports serving cloned websites as /shop marketplace with secure iframe previews.
  - **Technical Stack:** Puppeteer + Chromium, culori (CIELAB conversion), Jimp (pHash), node-html-parser (crawler), robots-parser
  - **Security:** Default-deny script policy, removes ALL inline scripts and event handlers, only allows explicitly verified CDN domains.
  - **Database:** brandJobs (job tracking), themeBundles (versioned themes with JSONB tokens), cloneArtifacts (HTML snapshots with manifests).
  - **API Routes:** 10 REST endpoints (/api/brand/jobs, /api/brand/themes, /api/brand/clones) with public /api/brand/clones/active for /shop serving.
  - **Coverage Metrics:** pagesScanned, colorsExtracted, logosFound, wcagIssues
  - **Timeout Protection:** 45s max per job with Promise.race to prevent handler blocking
- **Brand Theming System:** Dynamically applies ThemeTokens as CSS variables via BrandThemeProvider context. Auto-loads active themes on mount with /api/brand/themes/active query. Supports preview, activate, clear, and rollback operations.
- **Multi-Provider OAuth:** Integration with Google, Apple, GitHub, and X for authentication.
- **Dual-Track Authentication System:** Distinct flows for Employee Registration (requires admin approval) and Customer Registration (auto-approved, creates CRM record). Security features include Bcrypt hashing and RBAC.

### External Dependencies
- **Stripe:** Payment processing.
- **Twilio WhatsApp:** WhatsApp integration.
- **OpenAI:** AI capabilities.
- **PostgreSQL (Neon):** Primary database.
- **Drizzle ORM:** Object-Relational Mapper.
- **Puppeteer + Chromium:** Intelligent Brand Scanner.
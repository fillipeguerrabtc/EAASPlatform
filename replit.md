# EAAS - Everything As A Service Platform

### Overview
EAAS is an all-in-one Platform-as-a-Service (PaaS) designed to centralize critical business operations. It features a universal marketplace for diverse offerings, a 360° CRM, a comprehensive ERP, an autonomous AI with a tenant-editable knowledge base, an Omnichat for unified communication, integrated payment management (Stripe), and a smart calendar for resource orchestration. The platform is built on a secure multi-tenant core with subdomain routing, aiming to provide a silent, sophisticated, and inevitable solution for businesses.

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
- **Multi-tenant Core:** Schema-based isolation, subdomain routing simulation, and `X-Tenant-ID` header for API requests. Role-Based Access Control (RBAC) implemented.
- **Database Schema:** 28 tables covering tenants, users, marketplace (products, carts, orders), CRM (customers, segments, pipeline, deals, activities), Omnichat (conversations, messages), AI knowledge base, payments, calendar events, Inventory (warehouses, productStock, stockMovements), and HR (departments, employees, payrollRecords, attendanceRecords).
- **Backend API:** Comprehensive CRUD operations for all major entities including tenants, products, customers, conversations, knowledge base, orders, carts, payments, warehouses, stock, stock movements, departments, employees, payroll, and attendance. All POST/PATCH routes have Zod validation.
- **Public Marketplace (`/shop`):** Secure product display, search, filtering, and server-side calculated pricing for cart management and Stripe checkout (sandbox).
- **AI Autonomous Sales System:** RAG-based knowledge base search with OpenAI GPT-5 fallback, per-tenant isolation, and editable content. AI now detects purchase intent in chat ("comprar", "adicionar ao carrinho"), automatically searches products, adds items to cart, and suggests checkout with actionable cart links. Complete autonomous sales flow from conversation to cart.
- **Inventory Management ERP:** Complete inventory control with 3 database tables (warehouses, productStock, stockMovements). Features multi-warehouse support, real-time stock levels tracking, automatic movement logging (IN/OUT/TRANSFER/ADJUSTMENT), low-stock alerts, and comprehensive audit trail. Full CRUD API with Zod validation and multi-tab UI (Warehouses, Stock Levels, Movements).
- **HR Management ERP:** Complete human resources system with 4 database tables (departments, employees, payrollRecords, attendanceRecords). Features organizational hierarchy, employee lifecycle management, automated payroll calculations (base salary + bonuses - deductions = net salary), attendance tracking with clock-in/out timestamps, and comprehensive reporting. Full CRUD API with Zod validation and multi-tab UI (Employees, Departments, Payroll, Attendance).
- **Omnichat Admin:** Dashboard for managing WhatsApp conversations, with features for manual takeover, manual replies, releasing to AI, and smart escalation based on user sentiment.
- **Categories Admin UI:** Hierarchical category management with infinite recursive visualization, cycle prevention, and intelligent delete functionality.
- **Financial Management ERP:** Dashboard with dynamic KPIs, CRUD for revenues and expenses, and DRE reports. Zod validation for all POST/PATCH routes.
- **WhatsApp Widget:** Floating widget with pre-formatted messages, integrated with Twilio for automated AI responses and CRM integration (auto-creates customer, conversation, and messages).
- **Anonymous Shopping System:** Complete support for anonymous cart management with sessionId-based tracking. Endpoints GET/POST/PATCH `/api/carts` are now public, allowing customers to shop without authentication. Schema modified with nullable `customerId` and new `sessionId` field.
- **Customer Area (`/my-account`):** Complete authenticated customer dashboard with tabs for order history, tracking, shopping cart, and 24/7 AI support. Includes order status badges, detailed item breakdowns, and integrated Omnichat access.
- **Brand Scanner with Puppeteer (PRODUCTION):** Intelligent Brand Scanner using Puppeteer to automatically extract comprehensive branding elements from websites: colors (primary, secondary, accent, background, foreground), logos, favicons, typography (fonts), and spacing (border-radius, padding). Available at POST `/api/tenants/:id/scan-brand` with `websiteUrl` parameter. Also includes legacy OpenAI Vision API endpoint for logo-only color extraction at `/api/tenants/:id/scan-brand-colors`.
- **Multi-Provider OAuth:** Replit Auth integration supporting Google, Apple, GitHub, and X (Twitter) authentication providers with automatic user creation and session management.

### External Dependencies
- **Stripe:** For payment processing (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`).
- **Twilio WhatsApp:** For WhatsApp integration (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER`).
- **OpenAI:** For AI capabilities and fallback (`OPENAI_API_KEY`).
- **PostgreSQL (Neon):** Primary database.
- **Drizzle ORM:** Object-Relational Mapper for database interactions.
- **Puppeteer:** (Planned) For the Intelligent Brand Scanner to scrape website branding.
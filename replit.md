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
- **Database Schema:** 16 tables covering tenants, users, marketplace (products, carts, orders), CRM, Omnichat, AI knowledge base, payments, and calendar events.
- **Backend API:** Comprehensive CRUD operations for all major entities (tenants, products, customers, conversations, knowledge base, orders, carts, payments).
- **Public Marketplace (`/shop`):** Secure product display, search, filtering, and server-side calculated pricing for cart management and Stripe checkout (sandbox).
- **AI System:** RAG-based knowledge base search with OpenAI GPT-5 fallback, per-tenant isolation, and editable content. Interactions are logged for learning.
- **Omnichat Admin:** Dashboard for managing WhatsApp conversations, with features for manual takeover, manual replies, releasing to AI, and smart escalation based on user sentiment.
- **Categories Admin UI:** Hierarchical category management with infinite recursive visualization, cycle prevention, and intelligent delete functionality.
- **Financial Management ERP:** Dashboard with dynamic KPIs, CRUD for revenues and expenses, and DRE reports. Zod validation for all POST/PATCH routes.
- **WhatsApp Widget:** Floating widget with pre-formatted messages, integrated with Twilio for automated AI responses and CRM integration (auto-creates customer, conversation, and messages).
- **Planned Features (Wave 2 - Tenant Branding):** Manual branding setup (logo, favicon, color picker) and an "Intelligent Brand Scanner" using Puppeteer to automatically extract and apply branding elements (colors, fonts, logos, spacing, shadows, borders) from a provided website URL.

### External Dependencies
- **Stripe:** For payment processing (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`).
- **Twilio WhatsApp:** For WhatsApp integration (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER`).
- **OpenAI:** For AI capabilities and fallback (`OPENAI_API_KEY`).
- **PostgreSQL (Neon):** Primary database.
- **Drizzle ORM:** Object-Relational Mapper for database interactions.
- **Puppeteer:** (Planned) For the Intelligent Brand Scanner to scrape website branding.
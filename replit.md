# EAAS - Everything As A Service Platform

### Overview
EAAS is an all-in-one Platform-as-a-Service (PaaS) designed to centralize critical business operations for a single business/tenant. It offers a universal marketplace, a 360° CRM, a comprehensive ERP, an autonomous AI with an editable knowledge base, an Omnichat for unified communication, integrated payment management, and a smart calendar. The platform uses a single-tenant architecture for simplicity, performance, and AI effectiveness, grounded in advanced AI mathematics. The vision is to provide a robust, AI-powered platform that streamlines operations, enhances customer engagement, and drives efficiency for businesses.

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
The design emphasizes "silent sophistication" with a timeless, precise aesthetic. The color palette includes Primary Emerald Green, Deep Slate, Vibrant Purple, and True Black OLED-style. Typography uses Inter and JetBrains Mono. Design principles focus on clarity, rhythm, precision, adaptive complexity, and neutrality. Accessibility requires touch targets ≥44×44px. It features a mobile-first responsive approach, SEO optimization, a sticky header, dark sidebar navigation, and a theme toggle. Only Shadcn UI components are used. Full support for PT-BR and EN internationalization is provided.

**Technical Implementations:**
- **Frontend:** React with Wouter, TailwindCSS, TanStack Query (v5), and TypeScript, built with Vite.
- **Backend:** Node.js with Express, PostgreSQL (Neon) managed by Drizzle ORM, and TypeScript.
- **Architecture:** Single-tenant, Role-Based Access Control (RBAC).
- **URL Structure:** `/admin/*`, `/shop`, `/my-account`.
- **Database Schema:** 42 tables for tenant settings, users, marketplace, CRM, Omnichat, AI knowledge base, payments, calendar, Inventory, HR, AI Planning, and AI Governance.
- **Backend API:** Comprehensive CRUD operations with Zod validation.
- **Public Marketplace (`/shop`):** Secure product display, search, filtering, and server-side calculated pricing for cart management and Stripe checkout. Includes product variants with SKU-based inventory tracking.
- **AI Autonomous Sales System:** Incorporates a Planner/ToT System (POMDP), a Multi-Layer Critics System (Factual, Numeric, Ethical, Risk) with persistence in `aiTraces` and `aiMetrics`, and Hybrid RAG Scoring.
- **ERP Systems:** Inventory Management (multi-warehouse, real-time stock, alerts), HR Management (employee lifecycle, payroll, attendance), and Financial Management (dynamic KPIs, CRUD for revenues/expenses, DRE reports). Includes a production-ready order management system with 13 tables for pricing, inventory, orders, payments, refunds, etc., featuring time-window pricing, atomic stock operations, and transaction-safe coupon system.
- **CRM Enterprise Module:** Production-grade CRM with 10 tables for companies, contacts, pipelines, deals, activities, etc. Features deduplication, dynamic segments, asynchronous CSV import queue, and integration with external webhooks (Twilio, Meta).
- **Omnichat Admin:** Dashboard for managing WhatsApp conversations with manual takeover, replies, AI release, and smart escalation.
- **Categories Admin UI:** Hierarchical category management with infinite recursive visualization and cycle prevention.
- **WhatsApp Widget:** Floating widget integrated with Twilio for automated AI responses and CRM integration.
- **Shopping System:** Supports anonymous sessionId-based cart management and an authenticated customer area (`/my-account`) with order history, tracking, and AI support.
- **Brand Scanner 2.1 PRO - Diamond Edition:** Advanced brand identity system with extract, clone, and dynamic theming modes.
- **Brand Theming System:** Dynamically applies ThemeTokens as CSS variables via BrandThemeProvider context.
- **Authentication:** Multi-Provider OAuth (Google, Apple, GitHub, X) and a Dual-Track Authentication System for Employee (admin approval) and Customer (auto-approved) registration with Bcrypt hashing and RBAC. Includes single-tenant architecture enforcement, Stripe webhook idempotency, transaction safety, CRM data quality, API pagination, and a persistent cart system.
- **PostgreSQL-Based Job Queue System:** Autonomous asynchronous job processing with zero external dependencies using a `job_queue` table, `JobQueueService`, and a global worker system. Fully migrated CRM CSV imports and Marketing campaign scheduling. Complete admin dashboard at `/admin/queue` with real-time monitoring, filtering, retry, and cancel operations.
- **Marketing Automation Module:** Comprehensive multi-channel marketing campaign system with LGPD/GDPR compliance. Includes 5 database tables for templates, campaigns, sends, events, and contact preferences. Supports Email (SMTP/Nodemailer), WhatsApp (Twilio), and Facebook/Instagram (Graph API stubs) with Handlebars templating. Features audience segmentation, A/B testing, throttling, scheduling, and crypto-secure tracking. Campaign execution fully integrated with PostgreSQL job queue (zero Redis dependency).
- **AI Multimodal 2.0 System:** Autonomous AI knowledge base with multimodal ingestion (text/image/URL), ONNX embeddings, HNSW vector search, and hybrid RAG scoring. Uses 16 database tables for documents, chunks, embeddings, entities, feedback, traces, and governance. Features a Multimodal Parser (HTML, PDF, DOCX, PPTX, CSV, Images via Tesseract OCR) with SSRF protection. Utilizes ONNX Runtime for text (MiniLM L6 v2) and image (MobileNetV2) embeddings, and hnswlib-node for HNSW vector search. Hybrid RAG scoring uses a 5-weight system. URL ingestion is disabled by default for security.

### External Dependencies
- **Stripe:** Payment processing.
- **Twilio WhatsApp:** WhatsApp integration.
- **Meta (Facebook/Instagram):** Social media integration.
- **OpenAI:** AI capabilities.
- **PostgreSQL (Neon):** Primary database.
- **Drizzle ORM:** Object-Relational Mapper.
- **Puppeteer + Chromium:** Intelligent Brand Scanner.
- **Nodemailer:** SMTP email sending.
- **Handlebars:** Template engine.
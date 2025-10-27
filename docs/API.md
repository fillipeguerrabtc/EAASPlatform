# 📡 EAAS Platform - API Documentation

> Complete REST API reference for EAAS Platform v2.1.0

---

## 📋 Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Base URL](#base-url)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Brand Scanner API](#brand-scanner-api)
- [Marketplace API](#marketplace-api)
- [CRM API](#crm-api)
- [AI Knowledge Base API](#ai-knowledge-base-api)
- [Omnichat API](#omnichat-api)
- [ERP APIs](#erp-apis)

---

## Overview

The EAAS Platform API is organized around REST. Our API has predictable resource-oriented URLs, accepts JSON-encoded request bodies, returns JSON-encoded responses, and uses standard HTTP response codes, authentication, and verbs.

**API Version**: 2.1.0  
**Total Endpoints**: 232+  
**Base Protocol**: HTTPS  
**Response Format**: JSON

---

## Authentication

### Session-Based (Recommended)

All authenticated endpoints require a valid session cookie:

```http
Cookie: connect.sid=s%3A...
```

**Login Endpoint**:
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123"
}
```

**Response**:
```json
{
  "user": {
    "id": "123",
    "email": "user@example.com",
    "role": "tenant_admin",
    "fullName": "John Doe"
  }
}
```

### RBAC Roles

- `super_admin` - Platform administrator
- `tenant_admin` - Tenant administrator
- `manager` - Manager with elevated permissions
- `agent` - Customer service agent
- `customer` - End customer (public-facing)

---

## Base URL

### Development
```
http://localhost:5000
```

### Production
```
https://your-domain.replit.app
```

---

## Response Format

### Success Response

```json
{
  "id": "abc123",
  "name": "Product Name",
  "price": 99.99,
  "createdAt": "2025-10-27T12:34:56.789Z"
}
```

### Error Response

```json
{
  "error": "Invalid input",
  "message": "Email is required",
  "statusCode": 400
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| `200` | OK | Request succeeded |
| `201` | Created | Resource created successfully |
| `400` | Bad Request | Invalid input or validation error |
| `401` | Unauthorized | Authentication required |
| `403` | Forbidden | Insufficient permissions |
| `404` | Not Found | Resource not found |
| `409` | Conflict | Resource already exists |
| `422` | Unprocessable Entity | Zod validation error |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Server error |

---

## Rate Limiting

**Limit**: 100 requests per 15 minutes per IP  
**Headers**:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1635724800
```

---

## Brand Scanner API

### Scan URL (Extract Mode)

Extract brand identity from a URL with advanced CIELAB analysis.

```http
POST /api/brand-scanner/scan
Authorization: Required
Content-Type: application/json
```

**Request Body**:
```json
{
  "url": "https://example.com"
}
```

**Response** (`200 OK`):
```json
{
  "id": "job-abc123",
  "url": "https://example.com",
  "status": "completed",
  "screenshotUrl": "/storage/brand-scanner/job-abc123/screenshot.png",
  
  "colors": ["#10A37F", "#1C1C1E", "#FFFFFF"],
  "fonts": ["Inter", "JetBrains Mono"],
  
  "advancedPalette": {
    "colors": [
      {
        "hex": "#10A37F",
        "lab": { "L": 61.5, "a": -42.3, "b": 18.7 },
        "frequency": 0.35
      }
    ]
  },
  
  "advancedTypography": {
    "families": [
      {
        "family": "Inter",
        "weights": [400, 600, 700],
        "sources": ["https://fonts.googleapis.com/css2?family=Inter"]
      }
    ]
  },
  
  "cloneManifest": {
    "siteUrl": "https://example.com",
    "tokens": { /* ThemeTokens */ },
    "assets": [
      {
        "localPath": ".storage/brand-scanner/job-abc123/assets/logo.png",
        "originalUrl": "https://example.com/logo.png",
        "type": "image",
        "hash": "a1b2c3...",
        "bytes": 45678
      }
    ],
    "pages": [
      {
        "url": "https://example.com/",
        "route": "/",
        "layout": [
          { "kind": "hero", "notes": "Main landing hero" },
          { "kind": "section", "notes": "Features grid" }
        ]
      }
    ],
    "notes": ["Responsive design", "Primary CTA is 'Get Started'"]
  },
  
  "createdAt": "2025-10-27T12:00:00.000Z",
  "completedAt": "2025-10-27T12:00:15.234Z"
}
```

**Error Responses**:
- `400` - Invalid URL format
- `401` - Authentication required
- `422` - Zod validation error
- `500` - Scan failed (check error message)

---

### Apply Admin Theme

Apply extracted theme to admin interface.

```http
POST /api/brand-scanner/apply-admin-theme
Authorization: Required
Content-Type: application/json
```

**Request Body**:
```json
{
  "tokens": {
    "primary": {
      "hex": "#10A37F",
      "hsl": "158 84% 35%",
      "name": "Primary Green",
      "usage": "Buttons, links, primary actions"
    },
    "secondary": {
      "hex": "#8B5CF6",
      "hsl": "258 90% 66%",
      "name": "Secondary Purple",
      "usage": "Secondary actions, accents"
    },
    "fontPrimary": {
      "family": "Inter",
      "weights": [400, 600, 700],
      "fallback": "sans-serif",
      "usage": "Body text, headings"
    },
    "borderRadius": "0.375rem",
    "spacing": {
      "xs": "0.25rem",
      "sm": "0.5rem",
      "md": "1rem",
      "lg": "1.5rem",
      "xl": "2rem"
    },
    "sourceUrl": "https://example.com",
    "generatedAt": "2025-10-27T12:00:00.000Z"
  }
}
```

**Response** (`200 OK`):
```json
{
  "themeFile": "./.storage/theme.json",
  "cssFile": "./.storage/generated.css"
}
```

**Files Created**:
- `.storage/theme.json` - Complete theme configuration
- `.storage/generated.css` - CSS variables

**Example CSS Output**:
```css
:root {
  --primary: 158 84% 35%;
  --secondary: 258 90% 66%;
  --font-primary: 'Inter', sans-serif;
  --border-radius: 0.375rem;
}
```

---

### Clone to Marketplace

Publish assets to CDN and create marketplace manifest.

```http
POST /api/brand-scanner/clone-to-marketplace
Authorization: Required
Content-Type: application/json
```

**Request Body**:
```json
{
  "manifest": {
    "siteUrl": "https://example.com",
    "tokens": { /* Complete ThemeTokens object */ },
    "assets": [
      {
        "localPath": ".storage/brand-scanner/job-123/assets/hero.jpg",
        "originalUrl": "https://example.com/hero.jpg",
        "type": "image",
        "hash": "abc123...",
        "bytes": 123456
      }
    ],
    "pages": [
      {
        "url": "https://example.com/",
        "route": "/",
        "layout": [
          { "kind": "hero" },
          { "kind": "section", "notes": "Features" },
          { "kind": "gallery" },
          { "kind": "footer" }
        ]
      }
    ],
    "notes": ["Mobile-first design", "Dark mode supported"]
  }
}
```

**Response** (`200 OK`):
```json
{
  "assetsPublished": 42,
  "manifestUrl": "/public/marketplace/manifest.json",
  "publishedAt": "2025-10-27T12:34:56.789Z"
}
```

**CDN Structure**:
```
.storage/public/marketplace/
├── assets/
│   ├── abc123-hero.jpg
│   ├── def456-logo.png
│   └── ghi789-gallery1.webp
└── manifest.json
```

**Security**:
- Path traversal prevention using `path.relative()`
- SHA256 deduplication
- Atomic file writes

---

## Marketplace API

### Get Products (Public)

Get paginated list of products for `/shop`.

```http
GET /api/products?page=1&limit=20&category=electronics
Authorization: Not Required (Public)
```

**Query Parameters**:
- `page` (number) - Page number (default: 1)
- `limit` (number) - Items per page (default: 20, max: 100)
- `category` (string) - Filter by category slug
- `search` (string) - Search in name/description
- `minPrice` (number) - Minimum price
- `maxPrice` (number) - Maximum price

**Response** (`200 OK`):
```json
{
  "products": [
    {
      "id": "prod-123",
      "name": "Wireless Headphones",
      "slug": "wireless-headphones",
      "description": "Premium noise-canceling headphones",
      "basePrice": 299.99,
      "images": ["/uploads/products/headphones-1.jpg"],
      "category": {
        "id": "cat-1",
        "name": "Electronics",
        "slug": "electronics"
      },
      "variants": [
        {
          "id": "var-1",
          "sku": "WH-BLK-001",
          "options": { "color": "Black", "size": "Standard" },
          "price": 299.99,
          "stockQuantity": 50
        }
      ]
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 100,
    "itemsPerPage": 20
  }
}
```

---

### Add to Cart

Add product variant to shopping cart.

```http
POST /api/cart/add
Authorization: Optional (uses sessionId or user auth)
Content-Type: application/json
```

**Request Body**:
```json
{
  "productVariantId": "var-123",
  "quantity": 2
}
```

**Response** (`200 OK`):
```json
{
  "cart": {
    "id": "cart-abc",
    "items": [
      {
        "id": "item-1",
        "productVariantId": "var-123",
        "quantity": 2,
        "product": {
          "name": "Wireless Headphones",
          "images": ["/uploads/products/headphones-1.jpg"]
        },
        "variant": {
          "sku": "WH-BLK-001",
          "options": { "color": "Black" },
          "price": 299.99
        },
        "subtotal": 599.98
      }
    ],
    "subtotal": 599.98,
    "total": 599.98
  }
}
```

---

### Stripe Checkout

Create Stripe checkout session.

```http
POST /api/stripe/create-checkout-session
Authorization: Optional
Content-Type: application/json
```

**Request Body**:
```json
{
  "cartId": "cart-abc123",
  "successUrl": "https://your-domain.com/success",
  "cancelUrl": "https://your-domain.com/cart"
}
```

**Response** (`200 OK`):
```json
{
  "sessionId": "cs_test_abc123...",
  "url": "https://checkout.stripe.com/c/pay/cs_test_abc123..."
}
```

**Client Redirect**:
```javascript
window.location.href = response.url;
```

---

## CRM API

### Create Lead

Create new CRM lead.

```http
POST /api/crm/leads
Authorization: Required (agent, manager, tenant_admin)
Content-Type: application/json
```

**Request Body**:
```json
{
  "fullName": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+1234567890",
  "company": "Acme Corp",
  "leadSource": "website",
  "status": "new",
  "assignedToId": "user-123"
}
```

**Response** (`201 Created`):
```json
{
  "id": "lead-abc",
  "fullName": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+1234567890",
  "company": "Acme Corp",
  "leadSource": "website",
  "status": "new",
  "leadScore": 0,
  "assignedToId": "user-123",
  "createdAt": "2025-10-27T12:00:00.000Z"
}
```

---

### Update Pipeline Position

Move lead/deal in pipeline (drag & drop).

```http
PATCH /api/crm/leads/:id/pipeline
Authorization: Required
Content-Type: application/json
```

**Request Body**:
```json
{
  "pipelineStageId": "stage-qualified",
  "position": 2
}
```

**Response** (`200 OK`):
```json
{
  "id": "lead-abc",
  "pipelineStageId": "stage-qualified",
  "position": 2,
  "updatedAt": "2025-10-27T12:05:00.000Z"
}
```

**Transaction Safety**: Uses database transaction to reorder positions atomically.

---

## AI Knowledge Base API

### Create Knowledge Entry

Add new knowledge base entry for AI.

```http
POST /api/ai-knowledge
Authorization: Required (manager, tenant_admin)
Content-Type: application/json
```

**Request Body**:
```json
{
  "question": "What are your business hours?",
  "answer": "We are open Monday-Friday 9AM-5PM EST",
  "category": "general",
  "isActive": true,
  "priority": 5
}
```

**Response** (`201 Created`):
```json
{
  "id": "kb-123",
  "question": "What are your business hours?",
  "answer": "We are open Monday-Friday 9AM-5PM EST",
  "category": "general",
  "isActive": true,
  "priority": 5,
  "createdAt": "2025-10-27T12:00:00.000Z"
}
```

---

### Search Knowledge Base

Search knowledge base with hybrid RAG scoring.

```http
GET /api/ai-knowledge/search?q=business+hours&limit=5
Authorization: Required
```

**Response** (`200 OK`):
```json
{
  "results": [
    {
      "id": "kb-123",
      "question": "What are your business hours?",
      "answer": "We are open Monday-Friday 9AM-5PM EST",
      "score": 0.95,
      "category": "general"
    }
  ],
  "query": "business hours",
  "totalResults": 1
}
```

---

## Omnichat API

### Get Conversations

Get WhatsApp conversations for admin dashboard.

```http
GET /api/omnichat/conversations?status=active&page=1&limit=20
Authorization: Required (agent, manager, tenant_admin)
```

**Query Parameters**:
- `status` - `active`, `archived`, `all`
- `assignedToId` - Filter by assigned agent
- `page` - Page number
- `limit` - Items per page

**Response** (`200 OK`):
```json
{
  "conversations": [
    {
      "id": "conv-123",
      "phoneNumber": "+1234567890",
      "customerName": "John Doe",
      "status": "active",
      "lastMessage": "Hello, I need help with my order",
      "lastMessageAt": "2025-10-27T12:00:00.000Z",
      "assignedToId": "agent-1",
      "unreadCount": 3,
      "isAiActive": true
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 3,
    "totalItems": 45
  }
}
```

---

### Send Message (Manual Takeover)

Agent sends message (takes over from AI).

```http
POST /api/omnichat/conversations/:id/send
Authorization: Required (agent, manager, tenant_admin)
Content-Type: application/json
```

**Request Body**:
```json
{
  "message": "Hi! I'm a human agent. How can I help you?"
}
```

**Response** (`200 OK`):
```json
{
  "id": "msg-456",
  "conversationId": "conv-123",
  "message": "Hi! I'm a human agent. How can I help you?",
  "direction": "outbound",
  "sentBy": "agent",
  "sentAt": "2025-10-27T12:05:00.000Z"
}
```

**Side Effects**:
- Sets `isAiActive` to `false` (manual takeover)
- Sends WhatsApp message via Twilio
- Logs interaction in CRM

---

### Release to AI

Let AI take over conversation again.

```http
POST /api/omnichat/conversations/:id/release-to-ai
Authorization: Required
```

**Response** (`200 OK`):
```json
{
  "conversationId": "conv-123",
  "isAiActive": true,
  "releasedAt": "2025-10-27T12:10:00.000Z"
}
```

---

## ERP APIs

### Inventory Management

#### Get Stock Levels

```http
GET /api/inventory/stock?warehouseId=wh-1&lowStock=true
Authorization: Required (manager, tenant_admin)
```

**Response**:
```json
{
  "items": [
    {
      "id": "stock-1",
      "productVariantId": "var-123",
      "warehouseId": "wh-1",
      "quantity": 5,
      "reorderPoint": 10,
      "isLowStock": true,
      "product": {
        "name": "Wireless Headphones",
        "sku": "WH-BLK-001"
      }
    }
  ]
}
```

---

### HR Management

#### Create Employee

```http
POST /api/hr/employees
Authorization: Required (tenant_admin)
Content-Type: application/json
```

**Request Body**:
```json
{
  "fullName": "Alice Smith",
  "email": "alice@example.com",
  "phone": "+1234567890",
  "position": "Sales Manager",
  "department": "Sales",
  "salary": 75000,
  "hireDate": "2025-10-27",
  "employmentType": "full-time"
}
```

**Response** (`201 Created`):
```json
{
  "id": "emp-123",
  "fullName": "Alice Smith",
  "email": "alice@example.com",
  "position": "Sales Manager",
  "department": "Sales",
  "salary": 75000,
  "hireDate": "2025-10-27",
  "employmentType": "full-time",
  "status": "active",
  "createdAt": "2025-10-27T12:00:00.000Z"
}
```

---

### Financial Management

#### Get DRE Report

```http
GET /api/financial/dre?startDate=2025-10-01&endDate=2025-10-31
Authorization: Required (manager, tenant_admin)
```

**Response**:
```json
{
  "period": {
    "start": "2025-10-01",
    "end": "2025-10-31"
  },
  "revenue": {
    "total": 125000,
    "items": [
      { "category": "Product Sales", "amount": 100000 },
      { "category": "Services", "amount": 25000 }
    ]
  },
  "expenses": {
    "total": 65000,
    "items": [
      { "category": "Payroll", "amount": 45000 },
      { "category": "Marketing", "amount": 15000 },
      { "category": "Rent", "amount": 5000 }
    ]
  },
  "netIncome": 60000,
  "margin": 0.48
}
```

---

## Webhooks

### Stripe Webhook

Stripe sends webhook events to this endpoint.

```http
POST /webhook/stripe
Content-Type: application/json
Stripe-Signature: t=...,v1=...
```

**Events Handled**:
- `checkout.session.completed` - Order completion
- `payment_intent.succeeded` - Payment successful
- `payment_intent.payment_failed` - Payment failed

**Security**:
- Signature verification using `STRIPE_WEBHOOK_SECRET`
- Idempotency via `stripeEventId` in database
- Transaction safety for order processing

**Response** (`200 OK`):
```json
{ "received": true }
```

---

## Pagination

All list endpoints support pagination:

**Request**:
```http
GET /api/products?page=2&limit=50
```

**Response**:
```json
{
  "data": [...],
  "pagination": {
    "currentPage": 2,
    "totalPages": 10,
    "totalItems": 500,
    "itemsPerPage": 50,
    "hasNextPage": true,
    "hasPrevPage": true
  }
}
```

---

## Zod Validation

All POST/PUT/PATCH endpoints use Zod validation:

**Validation Error** (`422 Unprocessable Entity`):
```json
{
  "error": "Validation failed",
  "issues": [
    {
      "path": ["email"],
      "message": "Invalid email address"
    },
    {
      "path": ["phone"],
      "message": "Phone number must be in E.164 format"
    }
  ]
}
```

---

## CORS & Security

**CORS Headers**:
```http
Access-Control-Allow-Origin: https://your-domain.com
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
```

**Security Headers** (via Helmet.js):
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000`

---

## Testing with cURL

### Brand Scanner Example

```bash
# 1. Login
curl -X POST https://your-domain.replit.app/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"admin@example.com","password":"SecurePass123"}'

# 2. Scan URL
curl -X POST https://your-domain.replit.app/api/brand-scanner/scan \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"url":"https://stripe.com"}'

# 3. Apply theme (use tokens from scan response)
curl -X POST https://your-domain.replit.app/api/brand-scanner/apply-admin-theme \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d @theme-tokens.json
```

---

## SDK Examples

### JavaScript/TypeScript

```typescript
// Using fetch with session cookies
const response = await fetch('/api/brand-scanner/scan', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include', // Include cookies
  body: JSON.stringify({ url: 'https://example.com' })
});

const job = await response.json();
console.log(job.advancedPalette);
```

### TanStack Query (React)

```tsx
const { data, isLoading, error } = useQuery({
  queryKey: ['/api/products'],
  queryFn: async () => {
    const res = await fetch('/api/products');
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json();
  }
});
```

---

## Resources

- **OpenAPI Spec**: Coming soon (`docs/openapi.yaml`)
- **Postman Collection**: Coming soon
- **GraphQL**: Not currently supported (REST only)

---

**Questions?** Check [BRAND_SCANNER.md](./BRAND_SCANNER.md) for detailed Brand Scanner documentation or open an issue on GitHub.

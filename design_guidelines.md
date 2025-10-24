# EAAS 360 Design Guidelines

## Design Approach

**Selected Approach**: Modern Enterprise SaaS Design System - Drawing inspiration from Linear's precision, Stripe's restraint, and Notion's modularity.

**Design Philosophy**: 
The EAAS 360 interface embodies "silent sophistication" - a system that feels inevitable and timeless. Every element serves a clear purpose in managing complexity with clarity. The design should never compete with data; it should elevate it.

**Core Principles**:
- **Clarity Over Decoration**: Information density without visual noise
- **Consistent Rhythm**: Predictable patterns across all modules
- **Hierarchical Precision**: Clear visual weight for decision-making
- **Adaptive Complexity**: Progressive disclosure of advanced features
- **Universal Neutrality**: Business-agnostic aesthetic that works for any sector

---

## Typography System

**Font Stack**:
- **Primary**: Inter (via Google Fonts CDN) - weights 400, 500, 600, 700
- **Monospace**: JetBrains Mono - for data, codes, and technical content

**Type Scale**:
- **Display**: text-4xl (36px) / font-bold - Dashboard headers, module titles
- **Headline**: text-2xl (24px) / font-semibold - Section headers, card titles
- **Subheading**: text-lg (18px) / font-medium - Subsections, table headers
- **Body**: text-base (16px) / font-normal - Primary content, form labels
- **Small**: text-sm (14px) / font-normal - Secondary info, metadata
- **Micro**: text-xs (12px) / font-medium - Badges, tags, timestamps

**Line Heights**: Use leading-tight for headings, leading-normal for body text, leading-relaxed for long-form content.

---

## Layout System

**Spacing Primitives**: Use Tailwind units of **2, 4, 6, 8, 12, 16** consistently.

**Grid Foundation**:
- **Dashboard Layouts**: 12-column grid (grid-cols-12) with responsive breakpoints
- **Card Grids**: 1-3 columns (grid-cols-1 md:grid-cols-2 lg:grid-cols-3)
- **Sidebar Width**: Fixed 64px (collapsed) / 256px (expanded)
- **Content Max-Width**: max-w-7xl for primary content areas

**Container Strategy**:
- Full-width backgrounds with max-w-7xl inner containers
- Consistent horizontal padding: px-6 on mobile, px-8 on desktop
- Vertical section spacing: py-12 to py-16

**Vertical Rhythm**:
- Component spacing: space-y-6 for related elements
- Section breaks: mb-12 between major sections
- Form field spacing: space-y-4

---

## Component Library

### Navigation & Structure

**Top Navigation Bar**:
- Height: h-16 (64px)
- Contains: Logo, global search, notifications, user menu
- Background: Subtle border-b with minimal shadow
- Layout: Flex with justify-between

**Sidebar Navigation**:
- Collapsible design (icon-only ↔ full labels)
- Module groupings: Marketplace, CRM, ERP, AI, Payments, Calendar, Settings
- Active state: Subtle background highlight
- Icons: Heroicons outline (default), solid (active)

**Breadcrumbs**: 
- Above page headers for deep navigation
- Separator: Heroicons chevron-right (size-4)

### Data Display

**Tables**:
- Sticky headers with subtle shadow on scroll
- Alternating row backgrounds for readability (optional subtle stripe)
- Column sorting indicators
- Row hover states for interactivity
- Compact padding: px-4 py-3
- Action columns (right-aligned): dropdowns, quick actions

**Cards**:
- Rounded corners: rounded-lg
- Borders: border with subtle shadow (shadow-sm)
- Padding: p-6
- Header/Body/Footer sections with clear separation
- Hover state: subtle shadow elevation (shadow-md)

**Stats/Metrics**:
- Large number display: text-3xl font-bold
- Label below: text-sm with muted treatment
- Trend indicators: arrows with percentage change
- 2-4 column grids for dashboard KPIs

**Charts & Graphs**:
- Use Recharts or similar library
- Clean, minimal grid lines
- Tooltips with precise data
- Legend placement: top-right or bottom

### Forms & Inputs

**Input Fields**:
- Height: h-10 (40px) for text inputs
- Rounded: rounded-md
- Border: border with focus ring (ring-2)
- Padding: px-4 py-2
- Labels: text-sm font-medium, mb-2
- Helper text: text-xs, mt-1

**Buttons**:
- **Primary**: Solid background, white text, shadow-sm, h-10, px-6, rounded-md
- **Secondary**: Border style, hover with subtle background
- **Tertiary**: Text only, hover underline
- Loading states with spinner
- Icon + Text combinations with gap-2

**Dropdowns/Select**:
- Match input field height and styling
- Chevron indicator (Heroicons chevron-down)
- Dropdown menu: shadow-lg, rounded-md, py-2

**Search**:
- Prominent placement in top nav
- Icon prefix (Heroicons magnifying-glass)
- Placeholder: "Search across all modules..."
- Keyboard shortcut hint (⌘K)

### Interactive Elements

**Modals/Dialogs**:
- Overlay: backdrop-blur with opacity
- Container: max-w-2xl, rounded-lg, shadow-2xl
- Header with title and close button
- Footer with action buttons (right-aligned)
- Padding: p-8

**Toasts/Notifications**:
- Corner placement: top-right
- Auto-dismiss after 5s
- Icon + Message + Close button
- Types: Success, Error, Warning, Info

**Tabs**:
- Underline style (border-b active state)
- Horizontal layout with equal spacing
- Active indicator: border-b-2 with accent
- Text: font-medium

**Badges/Tags**:
- Small, rounded-full or rounded-md
- Padding: px-3 py-1
- Text: text-xs font-medium
- Variants: Status (success, warning, error), Category, Count

---

## Module-Specific Patterns

### Marketplace
- Product cards with image placeholder, title, price, CTA
- Grid layout: 3-4 columns on desktop
- Filters sidebar (left) with category tree
- Large hero section with search overlay (if landing page)

### CRM 360°
- Kanban board for pipeline stages (drag-drop)
- Contact detail panels (slide-out from right)
- Activity timeline (vertical, chronological)
- Quick actions toolbar above tables

### ERP Modules
- Dashboard with metric cards and charts
- Data-dense tables with sorting, filtering, pagination
- Form-heavy interfaces with clear section breaks
- Multi-step wizards for complex workflows

### AI Chat Interface
- Chat bubbles: User (right-aligned), AI (left-aligned)
- Message timestamps (text-xs, muted)
- Typing indicator animation
- Knowledge base editor: Monaco or similar code editor

### Omnichat
- Channel switcher (WhatsApp, Facebook, Instagram, Web)
- Conversation list (left panel, 320px width)
- Message thread (center, full height)
- Customer info panel (right, collapsible)

### Calendar
- Monthly/Weekly/Daily views
- Event blocks with status indicators
- Resource allocation visualization
- Drag-to-create and resize events

---

## Visual Treatment

**Elevation/Depth**:
- Level 1: shadow-sm (cards, inputs)
- Level 2: shadow-md (dropdowns, hover states)
- Level 3: shadow-lg (modals, popovers)
- Level 4: shadow-2xl (critical alerts)

**Borders & Dividers**:
- Subtle borders throughout (border opacity ~10-20%)
- Section dividers: border-t with py-6 spacing
- Card outlines instead of heavy shadows

**Iconography**:
- Heroicons (outline for inactive, solid for active)
- Size: w-5 h-5 for inline, w-6 h-6 for standalone
- Consistent stroke weight across interface

**Empty States**:
- Centered illustration/icon (w-48)
- Headline + description + CTA
- Encouraging tone ("Get started by...")

---

## Responsive Behavior

**Breakpoints**:
- Mobile: < 768px - Stack layouts, full-width cards, bottom navigation
- Tablet: 768px - 1024px - 2-column grids, condensed sidebars
- Desktop: > 1024px - Full experience, 3-4 column grids

**Mobile Adaptations**:
- Hamburger menu for navigation
- Swipeable tabs and cards
- Bottom sheet modals instead of centered
- Touch-friendly tap targets (min 44px)

---

## Accessibility

- ARIA labels on all interactive elements
- Keyboard navigation support (Tab, Enter, Escape)
- Focus indicators (ring-2) on all focusable elements
- Sufficient contrast ratios (WCAG AA minimum)
- Screen reader announcements for dynamic content
- Form validation messages programmatically linked to inputs

---

## Images

**Hero Section** (Marketing/Landing Pages Only):
- Large hero image: Full-width, 60-80vh height
- Abstract tech/business imagery or dashboard mockup
- Gradient overlay for text readability
- Blurred background buttons (backdrop-blur-sm bg-white/20)

**Product/Feature Imagery**:
- Dashboard screenshots with subtle shadow
- Icon illustrations for feature cards (256x256px)
- Team photos in About/Team sections (circular crop, 160x160px)

**No hero images needed** for internal application dashboards - focus on data density and functionality.
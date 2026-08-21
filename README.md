# TESS - Sales Order Management System

A full-stack web application for managing sales orders with role-based access control, pricing management, ETL pipelines, and advanced analytics.

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local development without Docker)

### Run with Docker (Recommended)

```bash
# Start all services
docker compose up --build

# Access the application:
# - Frontend: http://localhost:3000
# - Backend API: http://localhost:5000
# - PostgreSQL: localhost:5432
```

### Run Locally (Development)

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (in another terminal)
cd frontend
npm install
npm run dev
```

## Demo Users

| Role    | Username | Password   |
| ------- | -------- | ---------- |
| Admin   | admin    | admin123   |
| Analyse | analyse  | analyse123 |
| Kunde   | K001     | kunde123   |

## Architecture

```
├── backend/              # Node.js + Express API
│   └── src/
│       ├── routes/       # API endpoints
│       ├── controllers/
│       ├── middleware/
│       ├── models/
│       ├── db/           # Database connection
│       ├── etl/          # ETL pipelines
│       └── scheduler/
├── frontend/             # React + Vite + Tailwind
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── context/
│       ├── hooks/
│       └── lib/
├── docker-compose.yml
├── init.sql              # Database schema
└── seed-dev.sql          # Seed data
```

## Features by Role

### Kunde (Customer)

- Dashboard with order statistics & charts
- **Place orders from a product catalog** (cart with live customer-specific pricing, order references, confirmation step)
- Orders enter an approval workflow (`pending_approval` → approved/rejected) with cancel-before-processing
- Search orders by ordrenr, date, references
- Sortable order tables with saved views
- View order details with line items
- Read-only price list (Mine priser)
- Company profile page (Min konto)
- Order status notifications with deep links
- Global order search (Ctrl+K)
- Mobile-friendly order cards
- Advanced analytics
- Export charts to PDF/Image

### Analyse (Analysis)

- Comprehensive statistics dashboard
- Charts by kunde, varegruppe, vare, lager, firma
- Time range filters
- Export statistics to PDF/Image

### Admin (Administrator)

- Full system dashboard with all statistics
- **Approval queue widget** — approve/reject customer orders (or deep-link into the filtered order list)
- **Product base-price management** — set the catalog price customers' discounts apply to
- Order management & order line CRUD
- Pricing module (customer groups, price lists, rules, simulator)
- ETL pipelines for data import
- User management (CRUD)
- System health monitoring
- Database status & import/extraction status
- Advanced analytics

## Tech Stack

- **Backend**: Node.js, Express, TypeScript, pg, pino, zod
- **Frontend**: React, Vite, TypeScript, Tailwind CSS, Recharts, TanStack Query, Framer Motion, Lucide React
- **Database**: PostgreSQL
- **Auth**: JWT + bcrypt
- **Export**: jsPDF + html2canvas
- **Container**: Docker + docker compose

## API Endpoints

| Endpoint | Description |
| -------- | ----------- |
| **Auth** | |
| POST /api/auth/login | User login |
| POST /api/auth/login/kunde | Kunde login with kundenr |
| **Orders** | |
| GET /api/orders | List orders with filters |
| GET /api/orders/:ordrenr | Get order details |
| POST /api/orders | Place a customer order (kunde; idempotent, server-side repricing) |
| PATCH /api/orders/:ordrenr/cancel | Cancel an order awaiting approval (owning kunde or admin) |
| **Catalog** | |
| GET /api/catalog/products | Product catalog with per-customer effective prices |
| **Products** | |
| PATCH /api/products/:varekode/price | Set product base price (admin) |
| **Statistics** | |
| GET /api/statistics/* | Statistics endpoints |
| **Pricing** | |
| GET/POST/PUT/DELETE /api/pricing/groups | Customer groups |
| GET/POST/PUT/DELETE /api/pricing/lists | Price lists |
| GET/POST/PUT/DELETE /api/pricing/rules | Price rules |
| POST /api/pricing/simulate | Price simulation |
| POST /api/pricing/calculate | Calculate prices |
| **Admin** | |
| GET /api/status | System status |
| GET /api/users | List users |
| GET/POST/PUT/DELETE /api/users/:id | User CRUD |
| GET /api/audit | Audit logs |
| **Assistant** | |
| GET /api/assistant/status | Whether AI help chat is enabled |
| POST /api/assistant/chat | Project help chat (JWT, rate limited) |

### AI help assistant (optional)

Server-side AI for in-app help about TESS (not live order data). **Gemini Flash** is the default (cheaper); OpenAI is also supported.

```bash
ENABLE_ASSISTANT=true
ASSISTANT_PROVIDER=gemini
GEMINI_API_KEY=your-key-from-aistudio.google.com
GEMINI_MODEL=gemini-2.5-flash-lite   # optional; cheap default
```

For OpenAI instead: `ASSISTANT_PROVIDER=openai` and `OPENAI_API_KEY=sk-...`.

API keys must never be exposed to the browser. Disabled by default in production (see `.env.prod.example`).

### Customer order placement (approval workflow)

Kunde users browse the catalog (`Ny bestilling`), fill a cart with their effective prices, and submit. The server re-prices every line via the pricing engine (client prices are never trusted), creates the order atomically in a `pending_approval` state using a dedicated ordrenr sequence, and notifies admins. Admins approve or reject from the dashboard queue; customers can cancel until processing starts. Submissions carry an idempotency key so double-clicks and retries never create duplicates.

Workflow statuses: `new → pending_approval → approved/rejected → processing → shipped → invoiced` (+ `cancelled`).

## License

MIT

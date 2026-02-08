# Tess Architecture

This document describes the high-level architecture of the Tess Sales Order System, intended for developers who are onboarding or performing maintenance.

## System Overview

Tess is a full-stack web application for managing and analysing sales orders, customers, products, and pricing rules. It is composed of two main services:

- **Backend** – Express.js REST API (TypeScript, Node.js)
- **Frontend** – React SPA (TypeScript, Vite, Tailwind CSS)
- **Database** – PostgreSQL with connection pooling

Both services are containerised with Docker.

## Directory Structure

```
Tess/
├── backend/
│   └── src/
│       ├── index.ts              # Express app bootstrap & route mounting
│       ├── controllers/          # Request handlers (thin layer)
│       ├── models/               # Data access layer (SQL queries)
│       ├── routes/               # Express router definitions
│       ├── middleware/            # Auth, validation, error handling, metrics
│       ├── services/             # Business logic (pricing, audit, conflicts)
│       ├── etl/                  # Data generation, bulk import, CSV upload
│       ├── db/                   # Connection pool, transaction helpers, COPY
│       └── lib/                  # Logger, shared utilities
├── frontend/
│   └── src/
│       ├── App.tsx               # Root component, routing
│       ├── main.tsx              # Vite entry point
│       ├── context/              # React Context (AuthContext)
│       ├── components/           # Shared UI components
│       │   ├── admin/            # Reusable admin components (Pagination, etc.)
│       │   ├── Charts/           # Recharts wrappers (Bar, Line, Pie)
│       │   ├── DataTable.tsx     # Generic sortable/paginated table
│       │   └── Layout.tsx        # App shell (sidebar, header, nav)
│       ├── pages/
│       │   ├── admin/            # Admin pages (Dashboard, Orders, Users, etc.)
│       │   ├── kunde/            # Customer-facing pages
│       │   └── analyse/          # Analyst pages
│       └── lib/
│           ├── api/              # Axios-based API clients (one file per resource)
│           ├── formatters.ts     # Number / currency formatting helpers
│           └── apiErrors.ts      # Global error notification handler
├── docs/
│   ├── API.md                    # Full API endpoint reference
│   └── ARCHITECTURE.md           # This file
└── docker-compose.yml
```

## Backend Architecture

### Request Lifecycle

```
Client Request
  → Rate Limiter
  → API Metrics Middleware (timing)
  → Auth Middleware (JWT verification)
  → Role Guard (admin / kunde / analyse)
  → Validation Middleware (Zod schema)
  → Controller (orchestration)
  → Model (SQL queries)
  → Controller (response shaping)
  → JSON Response
  → Global Error Handler (if any error thrown)
```

### Key Design Decisions

1. **Thin controllers, fat models** – Controllers handle HTTP concerns (parsing params, shaping responses). Models own the SQL and return plain objects.

2. **`asyncHandler` wrapper** – Every async route handler is wrapped so rejected Promises are automatically forwarded to the global error handler.

3. **Zod validation** – Request bodies, query strings, and URL params are validated declaratively via Zod schemas defined in `middleware/validation.ts`.

4. **Typed error classes** – `AppError`, `ValidationError`, `NotFoundError`, etc. carry their own HTTP status codes. The global error handler serialises them consistently.

5. **Parameterised SQL** – All user-supplied values go through `$1`, `$2`, … placeholders to prevent SQL injection.

6. **Bulk data operations** – Two tiers: `batchInsert` (multi-value INSERT, good for 10k rows) and `bulkCopy` (PostgreSQL COPY protocol, good for 100k+ rows).

### Database

- PostgreSQL with `pg` driver and connection pooling (`max: 50`, `min: 10`)
- Slow query logging (> 100 ms)
- Transaction helper (`db/index.ts → transaction()`)
- Tables: `users`, `ordre`, `ordrelinje`, `kunde`, `vare`, `firma`, `lager`, `ordre_henvisning`, `customer_group`, `price_list`, `price_rule`, `audit_log`, `saved_report`

### Authentication & Authorisation

- JWT tokens with configurable secret (`JWT_SECRET`)
- Three roles: `admin`, `kunde`, `analyse`
- `authMiddleware` verifies the token and attaches `req.user`
- `roleGuard(…roles)` restricts access to specific roles
- Customer users (`kunde`) only see their own orders (row-level filtering in models)

## Frontend Architecture

### Stack

| Concern | Library |
|---------|---------|
| UI framework | React 18 |
| Routing | React Router v6 |
| Server state | TanStack React Query |
| HTTP client | Axios |
| Styling | Tailwind CSS (custom dark theme) |
| Charts | Recharts |
| Notifications | react-hot-toast |
| Build tool | Vite |

### Data Flow

```
User Interaction
  → React Component (page / form)
  → React Query (useQuery / useMutation)
  → API Client (lib/api/*.ts → Axios)
  → Backend REST API
  → React Query Cache (automatic invalidation)
  → Re-render
```

### Key Patterns

1. **API client barrel** – All API modules are re-exported from `lib/api/index.ts`. Each resource has its own file (`users.ts`, `orders.ts`, etc.) containing typed request functions.

2. **Reusable admin components** – Shared building blocks live in `components/admin/`:
   - `Pagination` – Three variants (full / simple / minimal)
   - `PageHeader` – Consistent count + action layout
   - `FilterBar` – Declarative filter form builder
   - `FormModal` – Create/edit modal shell
   - `ConfirmModal` – Delete / action confirmation

3. **Role-based routing** – `<ProtectedRoute>` wraps every route, checking the user's role against an allowlist. Unauthorised users are redirected to `/login`.

4. **Layout component** – Single `<Layout>` component provides the sidebar, header, and content area. Navigation items are role-dependent.

5. **Query key conventions** – Keys follow `['domain', 'resource', ...params]`, e.g. `['admin', 'users', page]`. Invalidation targets the domain prefix.

## Roles & Permissions

| Role | Access |
|------|--------|
| `admin` | Full access to all features, ETL, user management |
| `kunde` | Own orders, own analytics, own dashboard |
| `analyse` | Statistics dashboard, read-only analytics |

## Development Workflow

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend
cd frontend && npm install && npm run dev

# Docker (full stack)
docker compose up --build
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/tess` |
| `JWT_SECRET` | Secret for signing JWT tokens | (required) |
| `PORT` | Backend server port | `3000` |
| `NODE_ENV` | Environment mode | `development` |

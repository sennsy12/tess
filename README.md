# TESS - Sales Order Management System

A full-stack web application for managing sales orders with role-based access control.

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local development without Docker)

### Run with Docker (Recommended)

```bash
# Start all services
docker-compose up --build

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

## 🔐 Demo Users

| Role    | Username | Password   |
| ------- | -------- | ---------- |
| Admin   | admin    | admin123   |
| Analyse | analyse  | analyse123 |
| Kunde   | K001     | kunde123   |

## 🏗️ Architecture

```
├── backend/          # Node.js + Express API
│   └── src/
│       ├── routes/   # API endpoints
│       ├── middleware/
│       └── db/       # Database connection
├── frontend/         # React + Vite + Tailwind
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── context/
│       └── lib/
├── docker-compose.yml
└── init.sql          # Database schema + seed data
```

## 📊 Features by Role

### Kunde (Customer)

- Dashboard with order statistics & charts
- Search orders by ordrenr, date, references
- Sortable order tables
- View order details with line items
- Export charts to PDF/Image

### Analyse (Analysis)

- Comprehensive statistics dashboard
- Charts by kunde, varegruppe, vare, lager, firma
- Time range filters
- Export statistics to PDF/Image

### Admin (Administrator)

- Full system dashboard with all statistics
- Order line CRUD operations
- System health monitoring
- Database status pages
- Import/extraction status

## 🛠️ Tech Stack

- **Backend**: Node.js, Express, TypeScript, pg
- **Frontend**: React, Vite, TypeScript, Tailwind CSS, Recharts
- **Database**: PostgreSQL
- **Auth**: JWT + bcrypt
- **Export**: jsPDF + html2canvas
- **Container**: Docker + docker-compose

## 📝 API Endpoints

| Endpoint                   | Description              |
| -------------------------- | ------------------------ |
| POST /api/auth/login       | User login               |
| POST /api/auth/login/kunde | Kunde login with kundenr |
| GET /api/orders            | List orders with filters |
| GET /api/orders/:ordrenr   | Get order details        |
| GET /api/statistics/\*     | Statistics endpoints     |
| GET /api/status            | System status (admin)    |

## 📄 License

MIT

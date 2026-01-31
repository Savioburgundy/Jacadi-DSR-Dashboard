# Jacadi DSR Dashboard - Product Requirements Document

## Original Problem Statement
Build a premium "Jacadi Daily Sales Report (DSR) Dashboard" with the following requirements:
- Tech Stack: Node.js/Express/TypeScript backend + React/Vite/TypeScript frontend + SQLite database
- Multi-store CSV data ingestion from Olabi portal
- Real-time analytics dashboards with filters
- JWT authentication with role-based access
- 6:00 AM daily cron job for automated data sync
- Premium dark-mode/glassmorphism aesthetic

## Current Status: MIGRATION COMPLETE ✅

### What's Been Implemented (Jan 31, 2026)

#### Infrastructure Migration
- ✅ Migrated from incorrect Python/FastAPI/MongoDB stack to user's Node.js/Express/SQLite stack
- ✅ Extracted and deployed user's source code from `Jacadi DSR_latest.rar`
- ✅ Configured supervisor for Node.js backend (ts-node-dev)
- ✅ Configured Vite frontend with proper host/port settings
- ✅ Fixed database path from Windows to Linux relative path
- ✅ Copied populated database with 4,793 transactions and sales data

#### Authentication System
- ✅ JWT-based authentication working
- ✅ Login with email (admin@example.com / password)
- ✅ Role-based access control (admin role)
- ✅ Auth routes: POST /api/auth/login, GET /api/auth/me

#### Dashboard Features
- ✅ Real-time sales analytics
- ✅ Total Revenue display (₹59,73,700+)
- ✅ Transaction count (495)
- ✅ Average Transaction Value (₹12,068)
- ✅ Multi-store breakdown:
  - Jacadi Palladium
  - Jacadi MOA
  - Shopify Webstore
- ✅ MTD vs PM comparisons
- ✅ YTD sales tracking
- ✅ Multiple dashboard views:
  - Retail + Whatsapp Sales
  - Whatsapp Sales (Conversions)
  - Omni Channel TM vs LM
  - Analytics

#### Database Schema
- `users` - User authentication
- `sales_transactions` - Sales data
- `location_efficiency` - Store efficiency metrics
- `footfall` - Store footfall data
- `whatsapp_sales_report` - WhatsApp channel sales
- Multiple views for aggregated analytics

### Login Credentials
- Email: `admin@example.com`
- Password: `password`

### API Endpoints
- `GET /api/health` - Health check
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Current user
- `GET /api/analytics/summary` - Dashboard summary
- `GET /api/dashboards/*` - Dashboard data
- `POST /api/ingest/*` - Data ingestion

### Architecture
```
/app/
├── backend/           # Node.js/Express/TypeScript
│   ├── src/
│   │   ├── app.ts           # Main entry
│   │   ├── config/db.ts     # SQLite connection
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic
│   │   └── middleware/      # Auth middleware
│   ├── data.db              # SQLite database
│   └── package.json
├── frontend/          # React/Vite/TypeScript
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   └── services/api.ts
│   └── package.json
└── memory/PRD.md
```

## Upcoming Tasks (P1)

### 1. Playwright Automation for Olabi Portal
- Implement automated CSV download from https://login.olabi.ooo/
- Credentials: JPHO@JP / jPHO@JP@657
- Historical data fetch from Feb 26, 2025

### 2. Data Ingestion Pipeline
- Incremental upsert logic (delete existing, insert new)
- CSV parsing and validation
- Database backup before ingestion

### 3. Cron Job Scheduler
- 6:00 AM daily automation trigger
- DB backup → Download CSV → Ingest data flow

## Future Tasks (P2)
- Dashboard drill-down filters
- Database backup automation
- User management UI improvements
- Export to Excel functionality

## Technical Notes
- Frontend URL: https://sales-metrics-97.preview.emergentagent.com
- Backend internal port: 8001
- Frontend internal port: 3000
- Database: SQLite at /app/backend/data.db

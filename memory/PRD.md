# Jacadi DSR Dashboard - Product Requirements Document

## Original Problem Statement
Build a premium "Jacadi Daily Sales Report (DSR) Dashboard" with automated data sync from Olabi portal.

## Current Status: FUNCTIONAL ✅

### What's Been Implemented (Jan 31, 2026)

#### Core Dashboard
- ✅ Full-width responsive layout
- ✅ Dark/glassmorphism UI theme
- ✅ Multi-store sales breakdown:
  - Jacadi Palladium
  - Jacadi MOA
  - Shopify Webstore
- ✅ KPI Cards: Revenue, Transactions, ATV, Active Stores
- ✅ Multiple dashboard views:
  - Retail + Whatsapp Sales
  - Retail + Whatsapp Sales (Conversions)
  - Whatsapp Sale
  - Omni Channel TM vs LM
  - Omni Channel
  - Retail + Omni
  - Analytics

#### Authentication
- ✅ JWT-based login
- ✅ Role-based access (admin role for sync)
- ✅ Credentials: `admin@example.com` / `password`

#### Data Sync Automation (Sync Data Button)
- ✅ Playwright automation script for Olabi portal
- ✅ Login, navigate to Reports, download Invoice Detail CSV
- ✅ DB backup before ingestion
- ✅ CSV parsing and ingestion pipeline
- ✅ 6:00 AM daily cron job configured

#### Technical Stack
- **Backend**: Node.js + Express + TypeScript
- **Frontend**: React + Vite + TypeScript + TailwindCSS
- **Database**: SQLite (13MB with historical data)
- **Automation**: Python + Playwright

### Olabi Portal Credentials
- URL: https://login.olabi.ooo/
- Username: JPHO@JP
- Password: jPHO@JP@657

### Key API Endpoints
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Current user
- `POST /api/ingest/run` - Trigger manual sync (Admin only)
- `POST /api/ingest/download` - Download CSV only
- `GET /api/dashboards/default/*` - Dashboard data
- `GET /api/analytics/summary` - KPI summary

### Database Schema (SQLite)
- `users` - Authentication
- `sales_transactions` - Sales data
- `footfall` - Store footfall
- `location_efficiency` - Efficiency metrics
- `whatsapp_sales_report` - WhatsApp channel
- `ingestion_logs` - Sync history
- Multiple views for analytics

### File Structure
```
/app/
├── backend/                    # Node.js/Express/TypeScript
│   ├── src/
│   │   ├── app.ts              # Main entry
│   │   ├── config/db.ts        # SQLite connection
│   │   ├── routes/             # API routes
│   │   ├── services/           # Business logic
│   │   │   ├── etl.service.ts  # CSV processing
│   │   │   ├── ingestion.service.ts
│   │   │   ├── backup.service.ts
│   │   │   └── scheduler.service.ts
│   │   └── middleware/
│   ├── scripts/
│   │   └── fetch_jacadi_report.py  # Playwright automation
│   ├── data.db                 # SQLite database
│   ├── data_input/             # Downloaded CSVs
│   ├── data_archive/           # Processed CSVs
│   └── backups/                # DB backups
├── frontend/                   # React/Vite/TypeScript
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/dashboard/
│   │   └── services/api.ts
│   └── package.json
└── memory/PRD.md
```

### Sync Data Flow
1. User clicks "Sync Data" button (Admin only)
2. Backend creates DB restore point
3. Playwright script logs into Olabi portal
4. Downloads Invoice Detail CSV for yesterday
5. CSV moved to data_input folder
6. ETL service processes and ingests data
7. File archived after successful ingestion

### Completed This Session
- Migrated from Python/FastAPI/MongoDB to Node.js/Express/SQLite
- Fixed Windows paths to Linux paths
- Configured Playwright automation
- Tested full sync flow
- Fixed layout to fit screen properly
- Added Sync History panel with stats and log table

## Upcoming Tasks (P1)
- Historical data backfill (Feb 26, 2025 onwards)
- Error handling improvements for sync
- Sync status notifications in UI

## Future Tasks (P2)
- Email alerts on sync completion/failure
- Dashboard drill-down filters enhancement
- Export to Excel functionality
- User management improvements

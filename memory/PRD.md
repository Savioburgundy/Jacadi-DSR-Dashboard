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
- ✅ MongoDB backup before ingestion (via mongodump if available)
- ✅ CSV parsing and ingestion pipeline
- ✅ 6:00 AM daily cron job configured

### Database Migration (Jan 31, 2026) ✅
- **Migrated from SQLite to MongoDB** for deployment compatibility
- All data successfully transferred:
  - 15,204 sales transactions
  - 6,627 footfall records
  - 4 users
  - 9 ingestion logs
  - 2 location efficiency records
- All SQL queries converted to MongoDB aggregation pipelines
- Indexes created for optimal query performance

#### Technical Stack
- **Backend**: Node.js + Express + TypeScript
- **Frontend**: React + Vite + TypeScript + TailwindCSS
- **Database**: MongoDB (migrated from SQLite)
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
- `GET /api/ingest/logs` - Get ingestion history
- `GET /api/dashboards/latest-date` - Get latest data date
- `GET /api/dashboards/:id/*` - Dashboard data endpoints
- `GET /api/analytics/*` - Analytics endpoints

### Database Schema (MongoDB Collections)
- `users` - Authentication (email, password_hash, full_name, role)
- `sales_transactions` - Sales data (invoice_no, invoice_date, location_name, nett_invoice_value, etc.)
- `footfall` - Store footfall (date, location_name, footfall_count)
- `location_efficiency` - Efficiency metrics
- `ingestion_logs` - Sync history (filename, status, rows_added)

### File Structure
```
/app/
├── backend/                    # Node.js/Express/TypeScript + MongoDB
│   ├── src/
│   │   ├── app.ts              # Main entry (with MongoDB init)
│   │   ├── config/
│   │   │   ├── db.ts           # Old SQLite config (deprecated)
│   │   │   └── mongodb.ts      # MongoDB connection
│   │   ├── routes/             # API routes
│   │   ├── services/           # Business logic
│   │   │   ├── etl.service.ts  # MongoDB aggregations
│   │   │   ├── ingestion.service.ts
│   │   │   ├── backup.service.ts
│   │   │   └── scheduler.service.ts
│   │   └── middleware/
│   ├── scripts/
│   │   ├── fetch_jacadi_report.py  # Playwright automation
│   │   └── migrate_sqlite_to_mongo.ts # Migration script
│   ├── data.db                 # Old SQLite database (archived)
│   ├── data_input/             # Downloaded CSVs
│   ├── data_archive/           # Processed CSVs
│   └── backups/                # DB backups
├── frontend/                   # React/Vite/TypeScript
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/dashboard/
│   │   └── services/api.ts
│   └── vite.config.ts          # With /api proxy to backend
└── memory/PRD.md
```

### Sync Data Flow
1. User clicks "Sync Data" button (Admin only)
2. Backend creates MongoDB backup point (if mongodump available)
3. Playwright script logs into Olabi portal
4. Downloads Invoice Detail CSV for yesterday
5. CSV moved to data_input folder
6. ETL service processes and ingests data
7. File archived after successful ingestion

### Completed This Session
- ✅ SQLite to MongoDB database migration
- ✅ Created migration script (`migrate_sqlite_to_mongo.ts`)
- ✅ Fixed MongoDB aggregation projection errors ($literal for constants)
- ✅ Updated all route files for MongoDB
- ✅ Updated ingestion service for MongoDB
- ✅ Updated backup service for MongoDB (mongodump)
- ✅ Added Vite proxy configuration for /api routes
- ✅ All APIs tested and working

### Testing Results (Jan 31, 2026)
- **Backend**: 100% success rate (21/21 tests passed)
- **Frontend**: 95% (all major features working)
- All 7 dashboard tabs verified functional
- Authentication working correctly
- Admin features (Sync History, Manage Users) working

## Upcoming Tasks (P1)
- Historical data backfill (if needed)
- Error handling improvements for sync
- Sync status notifications in UI

## Future Tasks (P2)
- Email alerts on sync completion/failure
- Dashboard drill-down filters enhancement
- Export to Excel functionality
- User management improvements

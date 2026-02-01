# Jacadi DSR Dashboard - Product Requirements Document

## Original Problem Statement
Build a premium "Jacadi Daily Sales Report (DSR) Dashboard" with automated data sync from Olabi portal.

## Current Status: DEPLOYMENT READY ✅

### Latest Fixes Applied (Feb 1, 2026)
- ✅ **Fixed All TypeScript Compilation Errors** - Backend now compiles cleanly with `npx tsc --noEmit`
  - Fixed MongoDB `WithId<Document>` type issues in routes
  - Fixed duplicate `$ne` property errors in aggregation queries (changed to `$nin`)
  - Removed unused `id` field from insertOne operations (MongoDB auto-generates `_id`)
- ✅ **Deployment Agent Verified** - Application passes all deployment checks
- ✅ **Backend & Frontend Running** - Both services operational

### Previous Deployment Fixes Applied
- ✅ Removed SQLite and PostgreSQL dependencies from package.json
- ✅ Removed local MongoDB from supervisor config (using managed MongoDB)
- ✅ Deleted all legacy SQLite scripts and database file
- ✅ Fixed JWT_SECRET fallback warnings
- ✅ Fixed PORT fallback to 8001
- ✅ Added Manual CSV Upload feature as backup for automation

### What's Implemented

#### Core Dashboard
- Full-width responsive layout with dark/glassmorphism UI
- Multi-store sales breakdown: Jacadi Palladium, Jacadi MOA, Shopify Webstore
- KPI Cards: Revenue, Transactions, ATV, Active Stores
- 7 Dashboard views: Retail+Whatsapp Sales, Conversions, Whatsapp Sale, Omni Channel TM vs LM, Omni Channel, Retail+Omni, Analytics

#### Authentication
- JWT-based login with role-based access
- Credentials: `admin@example.com` / `password`

#### Data Ingestion Options
1. **Automated Sync (Sync Data button)** - Playwright automation for Olabi portal
   - Status: Requires Olabi portal UI updates (locators need fixing)
2. **Manual Upload (Upload CSV button)** - NEW
   - Upload Invoice Details CSV
   - Upload Footfall Data CSV
   - Files processed, logged, and archived

### Technical Stack
- **Backend**: Node.js + Express + TypeScript
- **Frontend**: React + Vite + TypeScript + TailwindCSS
- **Database**: MongoDB (managed)
- **Automation**: Python + Playwright

### Key API Endpoints
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Current user
- `POST /api/ingest/run` - Trigger automated sync
- `POST /api/ingest/upload/invoice` - Manual invoice upload
- `POST /api/ingest/upload/footfall` - Manual footfall upload
- `GET /api/ingest/logs` - Sync history
- `GET /api/dashboards/*` - Dashboard data endpoints

### Database Schema (MongoDB Collections)
- `users` - Authentication
- `sales_transactions` - Sales data
- `footfall` - Store footfall
- `location_efficiency` - Efficiency metrics
- `ingestion_logs` - Sync history

### File Structure
```
/app/
├── backend/                    # Node.js/Express/TypeScript + MongoDB
│   ├── src/
│   │   ├── app.ts              # Main entry
│   │   ├── config/mongodb.ts   # MongoDB connection
│   │   ├── routes/             # API routes
│   │   └── services/           # Business logic
│   └── scripts/
│       └── fetch_jacadi_report.py # Playwright automation
└── frontend/                   # React/Vite/TypeScript
    └── src/
        └── components/dashboard/
            ├── Dashboard.tsx
            ├── ManualUpload.tsx    # NEW
            └── SyncHistory.tsx
```

### Environment Variables Required for Deployment
```
# Backend
PORT=8001
JWT_SECRET=<secure-random-string>
MONGO_URL=<managed-mongodb-url>
DB_NAME=jacadi_dsr
DATA_INPUT_DIR=/app/backend/data_input
DATA_ARCHIVE_DIR=/app/backend/data_archive
OLABI_USERNAME=<olabi-credentials>
OLABI_PASSWORD=<olabi-credentials>
```

### Data Summary (Current)
- 15,204 sales transactions
- 6,627 footfall records  
- 4 users
- 3 store locations

## Known Issues
1. **Playwright Automation for Olabi Portal** - Selector timeout on 'Selection Criteria' link
   - Workaround: Use Manual Upload feature
   - Script: `/app/backend/scripts/fetch_jacadi_report.py`

## Next Steps (P1)
1. Fix Playwright script to match current Olabi Portal UI
2. Set up daily cron jobs for both Olabi & Surecount automation
3. Test manual upload with actual Olabi export files

## Future Enhancements (P2)
- Toast notifications for sync operations (using sonner)
- MongoDB backup mechanism (using mongodump)
- Export to Excel functionality
- User management improvements
- Dashboard drill-down filter enhancements

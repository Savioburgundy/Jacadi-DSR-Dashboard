# Jacadi DSR Dashboard - Product Requirements Document

## Original Problem Statement
Build a premium "Jacadi Daily Sales Report (DSR) Dashboard" - a high-performance retail analytics tool that automates data ingestion from a portal and visualizes efficiency metrics with dark glassmorphism design.

## Architecture
- **Frontend**: React with Tailwind CSS, Recharts for visualization
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Authentication**: JWT-based custom auth

## User Personas
1. **Admin User**: Full access to upload CSV data, view all metrics, manage sync operations
2. **Regular User**: View-only access to dashboard metrics and performance data

## Core Requirements (Static)
- [x] JWT authentication with admin/user roles
- [x] Dashboard with 7 key metrics (Net Revenue, Net Units, Transactions, ATV, Basket Size, Multies %, Conversion %)
- [x] MTD vs Last Month and YTD vs Last Year comparisons
- [x] Revenue trend charts with Recharts
- [x] Store and channel filters
- [x] Sales CSV upload with deduplication by invoice number
- [x] Footfall CSV upload for conversion calculation
- [x] Dark glassmorphism premium design

## What's Been Implemented (Jan 31, 2026)
### Backend
- FastAPI server with /api prefix routing
- JWT authentication (register, login, verify)
- Dashboard metrics endpoints with filtering
- Sales CSV upload with deduplication logic (IV, IR transaction types)
- Footfall CSV upload
- Sync logs tracking
- Store/channel breakdown endpoints

### Frontend
- Login/Register page with glassmorphism design
- Protected routes with AuthContext
- Executive Dashboard with 7 metric cards
- MTD/YTD comparison cards
- Revenue trend area chart
- Pie charts for store/channel breakdown
- Performance analysis page with tables
- Data Management page with CSV upload buttons
- Sidebar navigation with active states

## Store/Channel Configuration
- **Stores**: Jacadi Palladium, Jacadi MOA, Shopify Webstore
- **Channels**: Store, E-com, WhatsApp

## Prioritized Backlog

### P0 (Critical) - DONE
- [x] Core authentication flow
- [x] Dashboard metrics calculation
- [x] CSV upload functionality
- [x] Basic filtering

### P1 (High Priority) - Next Phase
- [ ] Olabi portal automation with Playwright
- [ ] Database backup before sync
- [ ] 6:00 AM daily cron job for automation
- [ ] Export reports to PDF/Excel

### P2 (Medium Priority)
- [ ] Date range preset buttons (Today, Last 7 days, MTD, YTD)
- [ ] Drill-down to individual transactions
- [ ] Email notifications on sync completion
- [ ] User management panel for admin

## Next Tasks
1. Implement Playwright automation for Olabi portal scraping
2. Add backup functionality before data sync
3. Set up node-cron for scheduled daily automation
4. Add export functionality for reports

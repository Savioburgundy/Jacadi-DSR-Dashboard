-- Drop existing views first to avoid dependency issues
DROP VIEW IF EXISTS v_retail_whatsapp_sales;
DROP VIEW IF EXISTS v_whatsapp_sales;
DROP VIEW IF EXISTS v_omni_channel_tm_lm;
DROP VIEW IF EXISTS v_omni_channel_details;
DROP VIEW IF EXISTS retail_whatsapp_sales; -- Old name cleanup

-- Drop tables
DROP TABLE IF EXISTS sales_transactions;
DROP TABLE IF EXISTS location_efficiency;
DROP TABLE IF EXISTS footfall;
DROP TABLE IF EXISTS raw_sales;
DROP TABLE IF EXISTS gold_daily_sales;

-- Main sales fact table matching CSV structure
CREATE TABLE IF NOT EXISTS location_efficiency (
    id TEXT PRIMARY KEY,
    location_name TEXT NOT NULL,
    report_date DATE NOT NULL,
    footfall INTEGER DEFAULT 0,
    conversion_pct REAL DEFAULT 0,
    multies_pct REAL DEFAULT 0,
    pm_footfall INTEGER DEFAULT 0,
    pm_conversion_pct REAL DEFAULT 0,
    pm_multies_pct REAL DEFAULT 0,
    UNIQUE(location_name, report_date)
);
-- Main sales fact table matching CSV structure
CREATE TABLE IF NOT EXISTS sales_transactions (
    id TEXT PRIMARY KEY,
    invoice_no TEXT,
    invoice_date DATE,
    invoice_month TEXT,
    invoice_time TEXT,
    transaction_type TEXT,
    
    -- Channel information
    order_channel_code TEXT,
    order_channel_name TEXT,
    invoice_channel_code TEXT,
    invoice_channel_name TEXT,
    sub_channel_code TEXT,
    sub_channel_name TEXT,
    
    -- Location information
    location_code TEXT,
    location_name TEXT,
    store_type TEXT,
    city TEXT,
    state TEXT,
    
    -- Financial data
    total_sales_qty INTEGER,
    unit_mrp REAL,
    invoice_mrp_value REAL,
    invoice_discount_value REAL,
    invoice_discount_pct REAL,
    invoice_basic_value REAL,
    total_tax_pct REAL,
    total_tax_amt REAL,
    nett_invoice_value REAL,
    
    -- Sales person
    sales_person_code TEXT,
    sales_person_name TEXT,
    
    -- Customer info
    consumer_code TEXT,
    consumer_name TEXT,
    consumer_mobile TEXT,
    
    -- Product info
    product_code TEXT,
    product_name TEXT,
    category_name TEXT,
    brand_name TEXT,
    
    -- New column for filtering consumers
    mh1_description TEXT,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Unique index commented out due to existing duplicates in data
-- Will use INSERT OR IGNORE in ETL instead
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_invoice_line 
-- ON sales_transactions(invoice_no, invoice_date, product_code, location_name);

-- Footfall data for conversion calculations
CREATE TABLE IF NOT EXISTS footfall (
    id TEXT PRIMARY KEY,
    date DATE,
    location_name TEXT,
    footfall_count INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- File tracking for incremental ingestion
CREATE TABLE IF NOT EXISTS processed_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT UNIQUE NOT NULL,
    file_date DATE,
    processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    record_count INTEGER,
    file_type TEXT DEFAULT 'invoice'
);

-- Whatsapp Sales Report (Direct Ingestion)
CREATE TABLE IF NOT EXISTS whatsapp_sales_report (
    id TEXT PRIMARY KEY,
    location_name TEXT,
    retail_mtd_sales REAL,
    whatsapp_mtd_sales REAL,
    pm_retail_mtd_sales REAL,
    pm_whatsapp_mtd_sales REAL,
    retail_sale_pct REAL,
    whatsapp_sale_pct REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(location_name)
);

-- Aggregated view: Retail + Whatsapp Sales (matching Power BI table)
CREATE VIEW IF NOT EXISTS v_retail_whatsapp_sales AS
SELECT 
    location_name as Location,
    
    -- MTD (Month To Date)
    COALESCE(SUM(CASE 
        WHEN DATE(invoice_date) >= DATE('now', 'start of month') 
        AND invoice_channel_name != 'E-Commerce'
        THEN nett_invoice_value ELSE 0 END), 0) as MTD_RETAIL_SALE,
    
    COALESCE(SUM(CASE 
        WHEN DATE(invoice_date) >= DATE('now', 'start of month') 
        AND invoice_channel_name = 'E-Commerce'
        THEN nett_invoice_value ELSE 0 END), 0) as MTD_WHATSAPP_SALE,
    
    COALESCE(COUNT(DISTINCT CASE 
        WHEN DATE(invoice_date) >= DATE('now', 'start of month') 
        AND invoice_channel_name != 'E-Commerce'
        THEN invoice_no ELSE NULL END), 0) as MTD_RETAIL_TRX,
    
    COALESCE(COUNT(DISTINCT CASE 
        WHEN DATE(invoice_date) >= DATE('now', 'start of month') 
        AND invoice_channel_name = 'E-Commerce'
        THEN invoice_no ELSE NULL END), 0) as MTD_WHATSAPP_TRX,
    
    -- PM (Previous Month)
    COALESCE(SUM(CASE 
        WHEN DATE(invoice_date) >= DATE('now', '-1 month', 'start of month') 
        AND DATE(invoice_date) < DATE('now', 'start of month')
        AND invoice_channel_name != 'E-Commerce'
        THEN nett_invoice_value ELSE 0 END), 0) as PM_RETAIL_SALE,
    
    COALESCE(SUM(CASE 
        WHEN DATE(invoice_date) >= DATE('now', '-1 month', 'start of month') 
        AND DATE(invoice_date) < DATE('now', 'start of month')
        AND invoice_channel_name = 'E-Commerce'
        THEN nett_invoice_value ELSE 0 END), 0) as PM_WHATSAPP_SALE,
    
    -- YTD (Year To Date)
    COALESCE(SUM(CASE 
        WHEN DATE(invoice_date) >= DATE('now', 'start of year')
        THEN nett_invoice_value ELSE 0 END), 0) as YTD_SALE,
    
    COALESCE(COUNT(DISTINCT CASE 
        WHEN DATE(invoice_date) >= DATE('now', 'start of year')
        THEN invoice_no ELSE NULL END), 0) as YTD_TRX

FROM sales_transactions
GROUP BY location_name;

-- Whatsapp Sales breakdown view
CREATE VIEW IF NOT EXISTS v_whatsapp_sales AS
SELECT 
    location_name as Location,
    
    -- MTD Retail vs Whatsapp
    COALESCE(SUM(CASE 
        WHEN DATE(invoice_date) >= DATE('now', 'start of month') 
        AND invoice_channel_name != 'E-Commerce'
        THEN nett_invoice_value ELSE 0 END), 0) as MTD_RETAIL_SALES,
    
    COALESCE(SUM(CASE 
        WHEN DATE(invoice_date) >= DATE('now', 'start of month') 
        AND invoice_channel_name = 'E-Commerce'
        THEN nett_invoice_value ELSE 0 END), 0) as MTD_WHATSAPP_SALES,
    
    -- PM Retail vs Whatsapp
    COALESCE(SUM(CASE 
        WHEN DATE(invoice_date) >= DATE('now', '-1 month', 'start of month') 
        AND DATE(invoice_date) < DATE('now', 'start of month')
        AND invoice_channel_name != 'E-Commerce'
        THEN nett_invoice_value ELSE 0 END), 0) as PM_RETAIL_SALES,
    
    COALESCE(SUM(CASE 
        WHEN DATE(invoice_date) >= DATE('now', '-1 month', 'start of month') 
        AND DATE(invoice_date) < DATE('now', 'start of month')
        AND invoice_channel_name = 'E-Commerce'
        THEN nett_invoice_value ELSE 0 END), 0) as PM_WHATSAPP_SALES

FROM sales_transactions
GROUP BY location_name;

-- Omni Channel TM vs LM view
CREATE VIEW IF NOT EXISTS v_omni_channel_tm_lm AS
SELECT 
    location_name as Location,
    
    -- This Month (MTD)
    COALESCE(SUM(CASE 
        WHEN DATE(invoice_date) >= DATE('now', 'start of month')
        THEN nett_invoice_value ELSE 0 END), 0) as MTD_SALE,
    
    COALESCE(COUNT(DISTINCT CASE 
        WHEN DATE(invoice_date) >= DATE('now', 'start of month')
        THEN invoice_no ELSE NULL END), 0) as MTD_TRX,
    
    COALESCE(SUM(CASE 
        WHEN DATE(invoice_date) >= DATE('now', 'start of month')
        THEN total_sales_qty ELSE 0 END), 0) as MTD_UNITS,
    
    -- Previous Month (PM)
    COALESCE(SUM(CASE 
        WHEN DATE(invoice_date) >= DATE('now', '-1 month', 'start of month') 
        AND DATE(invoice_date) < DATE('now', 'start of month')
        THEN nett_invoice_value ELSE 0 END), 0) as PM_SALE,
    
    COALESCE(COUNT(DISTINCT CASE 
        WHEN DATE(invoice_date) >= DATE('now', '-1 month', 'start of month') 
        AND DATE(invoice_date) < DATE('now', 'start of month')
        THEN invoice_no ELSE NULL END), 0) as PM_TRX,
    
    COALESCE(SUM(CASE 
        WHEN DATE(invoice_date) >= DATE('now', '-1 month', 'start of month') 
        AND DATE(invoice_date) < DATE('now', 'start of month')
        THEN total_sales_qty ELSE 0 END), 0) as PM_UNITS

FROM sales_transactions
GROUP BY location_name;

-- Omni Channel detailed metrics view
CREATE VIEW IF NOT EXISTS v_omni_channel_details AS
SELECT 
    location_name as Location,
    
    COALESCE(SUM(CASE 
        WHEN DATE(invoice_date) >= DATE('now', 'start of month')
        THEN nett_invoice_value ELSE 0 END), 0) as MTD_SALE,
    
    COALESCE(COUNT(DISTINCT CASE 
        WHEN DATE(invoice_date) >= DATE('now', 'start of month')
        THEN invoice_no ELSE NULL END), 0) as MTD_TRX,
    
    COALESCE(SUM(CASE 
        WHEN DATE(invoice_date) >= DATE('now', 'start of month')
        THEN total_sales_qty ELSE 0 END), 0) as MTD_UNITS,
    
    -- ATV (Average Transaction Value)
    CASE 
        WHEN COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE('now', 'start of month') THEN invoice_no ELSE NULL END) > 0
        THEN SUM(CASE WHEN DATE(invoice_date) >= DATE('now', 'start of month') THEN nett_invoice_value ELSE 0 END) / 
             COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE('now', 'start of month') THEN invoice_no ELSE NULL END)
        ELSE 0 
    END as MTD_ATV,
    
    -- Basket Size (Units per Transaction)
    CASE 
        WHEN COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE('now', 'start of month') THEN invoice_no ELSE NULL END) > 0
        THEN CAST(SUM(CASE WHEN DATE(invoice_date) >= DATE('now', 'start of month') THEN total_sales_qty ELSE 0 END) AS REAL) / 
             COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE('now', 'start of month') THEN invoice_no ELSE NULL END)
        ELSE 0 
    END as MTD_BASKET_SIZE

FROM sales_transactions
GROUP BY location_name;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sales_invoice_date ON sales_transactions(invoice_date);
CREATE INDEX IF NOT EXISTS idx_sales_location ON sales_transactions(location_name);
CREATE INDEX IF NOT EXISTS idx_sales_channel ON sales_transactions(invoice_channel_name);
CREATE INDEX IF NOT EXISTS idx_footfall_date ON footfall(date);

-- Users table (keep existing)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'viewer',
    org_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Metrics table (keep existing)
CREATE TABLE IF NOT EXISTS metrics (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    formula TEXT NOT NULL,
    depends_on TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Ingestion logs
CREATE TABLE IF NOT EXISTS ingestion_logs (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    status TEXT NOT NULL,
    rows_added INTEGER DEFAULT 0,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

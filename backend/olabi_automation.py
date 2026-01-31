"""
Olabi Portal Automation Script
Fetches Invoice Detail reports from the Olabi portal
"""
import asyncio
import os
import sys
import csv
import io
from datetime import datetime, timezone
from pathlib import Path
from playwright.async_api import async_playwright

# Add parent directory for imports
sys.path.insert(0, str(Path(__file__).parent))

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / '.env')

# Portal credentials
PORTAL_URL = "https://login.olabi.ooo/"
USERNAME = "JPHO@JP"
PASSWORD = "jPHO@JP@657"

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'test_database')

# Store and channel mapping
STORE_MAPPING = {
    "JACADI PALLADIUM": "Jacadi Palladium",
    "JACADI MOA": "Jacadi MOA",
    "SHOPIFY WEBSTORE": "Shopify Webstore",
    "PALLADIUM": "Jacadi Palladium",
    "MOA": "Jacadi MOA",
    "WEBSTORE": "Shopify Webstore",
    "SHOPIFY": "Shopify Webstore"
}

CHANNEL_MAPPING = {
    "STORE": "Store",
    "E-COM": "E-com",
    "ECOM": "E-com",
    "WHATSAPP": "WhatsApp",
    "WA": "WhatsApp"
}

async def login_to_portal(page):
    """Login to Olabi portal"""
    print(f"[INFO] Navigating to {PORTAL_URL}")
    await page.goto(PORTAL_URL, wait_until="networkidle", timeout=60000)
    await page.wait_for_timeout(2000)
    
    # Fill login form
    print("[INFO] Filling login credentials...")
    
    # Try different selectors for username/email field
    username_selectors = [
        'input[name="username"]',
        'input[name="email"]',
        'input[type="email"]',
        'input[type="text"]',
        '#username',
        '#email'
    ]
    
    for selector in username_selectors:
        try:
            if await page.locator(selector).count() > 0:
                await page.fill(selector, USERNAME)
                print(f"[INFO] Username filled using selector: {selector}")
                break
        except:
            continue
    
    # Fill password
    password_selectors = [
        'input[name="password"]',
        'input[type="password"]',
        '#password'
    ]
    
    for selector in password_selectors:
        try:
            if await page.locator(selector).count() > 0:
                await page.fill(selector, PASSWORD)
                print(f"[INFO] Password filled using selector: {selector}")
                break
        except:
            continue
    
    await page.wait_for_timeout(1000)
    
    # Click login button
    login_selectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Login")',
        'button:has-text("Sign In")',
        '.login-btn',
        '#login-btn'
    ]
    
    for selector in login_selectors:
        try:
            if await page.locator(selector).count() > 0:
                await page.click(selector)
                print(f"[INFO] Login button clicked using selector: {selector}")
                break
        except:
            continue
    
    await page.wait_for_timeout(5000)
    print("[INFO] Login submitted, waiting for dashboard...")

async def navigate_to_invoice_detail(page):
    """Navigate to Retail -> Reports -> Invoice Detail"""
    print("[INFO] Navigating to Invoice Detail report...")
    
    # Wait for page to load after login
    await page.wait_for_load_state("networkidle")
    await page.wait_for_timeout(3000)
    
    # Try to find and click Retail menu
    retail_selectors = [
        'text="Retail"',
        'a:has-text("Retail")',
        '[data-menu="retail"]',
        '.menu-item:has-text("Retail")'
    ]
    
    for selector in retail_selectors:
        try:
            if await page.locator(selector).count() > 0:
                await page.click(selector)
                print(f"[INFO] Clicked Retail menu: {selector}")
                await page.wait_for_timeout(2000)
                break
        except:
            continue
    
    # Click Reports submenu
    reports_selectors = [
        'text="Reports"',
        'a:has-text("Reports")',
        '[data-menu="reports"]',
        '.submenu-item:has-text("Reports")'
    ]
    
    for selector in reports_selectors:
        try:
            if await page.locator(selector).count() > 0:
                await page.click(selector)
                print(f"[INFO] Clicked Reports: {selector}")
                await page.wait_for_timeout(2000)
                break
        except:
            continue
    
    # Click Invoice Detail
    invoice_selectors = [
        'text="Invoice Detail"',
        'a:has-text("Invoice Detail")',
        '[data-report="invoice-detail"]',
        '.report-item:has-text("Invoice Detail")'
    ]
    
    for selector in invoice_selectors:
        try:
            if await page.locator(selector).count() > 0:
                await page.click(selector)
                print(f"[INFO] Clicked Invoice Detail: {selector}")
                await page.wait_for_timeout(3000)
                break
        except:
            continue
    
    await page.wait_for_load_state("networkidle")

async def set_date_range_and_download(page, start_date: str, end_date: str):
    """Set date range and download the report"""
    print(f"[INFO] Setting date range: {start_date} to {end_date}")
    
    # Look for date input fields
    start_date_selectors = [
        'input[name="start_date"]',
        'input[name="from_date"]',
        'input[name="startDate"]',
        '#start_date',
        '#from_date',
        '[placeholder*="Start"]',
        '[placeholder*="From"]'
    ]
    
    for selector in start_date_selectors:
        try:
            if await page.locator(selector).count() > 0:
                await page.fill(selector, start_date)
                print(f"[INFO] Start date set: {selector}")
                break
        except:
            continue
    
    end_date_selectors = [
        'input[name="end_date"]',
        'input[name="to_date"]',
        'input[name="endDate"]',
        '#end_date',
        '#to_date',
        '[placeholder*="End"]',
        '[placeholder*="To"]'
    ]
    
    for selector in end_date_selectors:
        try:
            if await page.locator(selector).count() > 0:
                await page.fill(selector, end_date)
                print(f"[INFO] End date set: {selector}")
                break
        except:
            continue
    
    await page.wait_for_timeout(1000)
    
    # Click generate/search button
    generate_selectors = [
        'button:has-text("Generate")',
        'button:has-text("Search")',
        'button:has-text("Filter")',
        'button:has-text("Apply")',
        'button[type="submit"]',
        '.btn-search',
        '.btn-generate'
    ]
    
    for selector in generate_selectors:
        try:
            if await page.locator(selector).count() > 0:
                await page.click(selector)
                print(f"[INFO] Generate clicked: {selector}")
                await page.wait_for_timeout(5000)
                break
        except:
            continue
    
    await page.wait_for_load_state("networkidle")
    await page.wait_for_timeout(3000)
    
    # Download CSV
    download_path = Path("/tmp/olabi_invoice_detail.csv")
    
    download_selectors = [
        'button:has-text("Export")',
        'button:has-text("Download")',
        'button:has-text("CSV")',
        'a:has-text("Export")',
        'a:has-text("Download CSV")',
        '.export-btn',
        '.download-csv'
    ]
    
    async with page.expect_download(timeout=60000) as download_info:
        for selector in download_selectors:
            try:
                if await page.locator(selector).count() > 0:
                    await page.click(selector)
                    print(f"[INFO] Download initiated: {selector}")
                    break
            except:
                continue
        
    download = await download_info.value
    await download.save_as(str(download_path))
    print(f"[INFO] File downloaded to: {download_path}")
    
    return download_path

def parse_csv_row(row):
    """Parse a CSV row into a transaction record"""
    import uuid
    
    invoice_num = row.get("Invoice Number", row.get("invoice_number", row.get("InvoiceNumber", "")))
    if not invoice_num:
        return None
    
    trans_type = row.get("Transaction Type", row.get("trans_type", row.get("Type", "IV")))
    
    store_raw = row.get("Store", row.get("store_location", row.get("Location", ""))).upper()
    store_location = STORE_MAPPING.get(store_raw, store_raw.title() if store_raw else "Unknown")
    
    channel_raw = row.get("Channel", row.get("sales_channel", row.get("SalesChannel", "Store"))).upper()
    sales_channel = CHANNEL_MAPPING.get(channel_raw, channel_raw.title() if channel_raw else "Store")
    
    gross_qty = int(float(row.get("Gross Quantity", row.get("gross_quantity", row.get("Quantity", 0))) or 0))
    returned_qty = int(float(row.get("Returned Quantity", row.get("returned_quantity", row.get("Returns", 0))) or 0))
    net_qty = int(float(row.get("Net Quantity", row.get("net_quantity", gross_qty - returned_qty)) or 0))
    
    gross_val = float(row.get("Gross Value", row.get("gross_value", row.get("Amount", 0))) or 0)
    nett_val = float(row.get("Nett Invoice Value", row.get("nett_invoice_value", row.get("NetAmount", gross_val))) or 0)
    
    date_str = row.get("Transaction Date", row.get("transaction_date", row.get("Date", "")))
    if date_str:
        for fmt in ["%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y", "%Y/%m/%d"]:
            try:
                parsed_date = datetime.strptime(date_str, fmt)
                date_str = parsed_date.strftime("%Y-%m-%d")
                break
            except ValueError:
                continue
    
    return {
        "id": str(uuid.uuid4()),
        "invoice_number": invoice_num,
        "transaction_type": trans_type,
        "transaction_date": date_str,
        "store_location": store_location,
        "sales_channel": sales_channel,
        "gross_quantity": gross_qty,
        "returned_quantity": returned_qty,
        "net_quantity": net_qty,
        "gross_value": gross_val,
        "nett_invoice_value": nett_val,
        "customer_name": row.get("Customer", row.get("customer_name", "")),
        "product_sku": row.get("SKU", row.get("product_sku", "")),
        "product_name": row.get("Product", row.get("product_name", "")),
        "created_at": datetime.now(timezone.utc).isoformat()
    }

async def ingest_csv_to_db(csv_path: Path):
    """Ingest CSV data into MongoDB with deduplication"""
    print(f"[INFO] Ingesting data from {csv_path}")
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        
        records = []
        invoice_numbers = set()
        
        for row in reader:
            try:
                record = parse_csv_row(row)
                if record:
                    invoice_numbers.add(record["invoice_number"])
                    records.append(record)
            except Exception as e:
                print(f"[WARN] Error parsing row: {e}")
                continue
    
    if not records:
        print("[WARN] No valid records found in CSV")
        client.close()
        return 0
    
    # Deduplication: Delete existing records with same invoice numbers
    delete_result = await db.sales_transactions.delete_many({"invoice_number": {"$in": list(invoice_numbers)}})
    print(f"[INFO] Deleted {delete_result.deleted_count} existing records for deduplication")
    
    # Insert new records
    await db.sales_transactions.insert_many(records)
    print(f"[INFO] Inserted {len(records)} new records")
    
    # Log the sync
    sync_log = {
        "id": str(__import__('uuid').uuid4()),
        "sync_type": "portal_automation",
        "status": "completed",
        "records_processed": len(records),
        "triggered_by": "automation",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": datetime.now(timezone.utc).isoformat()
    }
    await db.sync_logs.insert_one(sync_log)
    
    client.close()
    return len(records)

async def run_automation(start_date: str = "2025-02-26", end_date: str = None):
    """Main automation function"""
    if end_date is None:
        end_date = datetime.now().strftime("%Y-%m-%d")
    
    print("=" * 60)
    print("OLABI PORTAL AUTOMATION")
    print(f"Date Range: {start_date} to {end_date}")
    print("=" * 60)
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        )
        page = await context.new_page()
        
        try:
            # Step 1: Login
            await login_to_portal(page)
            
            # Take screenshot after login
            await page.screenshot(path="/tmp/olabi_after_login.png")
            print("[INFO] Screenshot saved: /tmp/olabi_after_login.png")
            
            # Step 2: Navigate to Invoice Detail
            await navigate_to_invoice_detail(page)
            
            # Take screenshot of report page
            await page.screenshot(path="/tmp/olabi_report_page.png")
            print("[INFO] Screenshot saved: /tmp/olabi_report_page.png")
            
            # Step 3: Set date range and download
            csv_path = await set_date_range_and_download(page, start_date, end_date)
            
            # Step 4: Ingest to database
            records_count = await ingest_csv_to_db(csv_path)
            
            print("=" * 60)
            print(f"SUCCESS: Ingested {records_count} records")
            print("=" * 60)
            
            return records_count
            
        except Exception as e:
            print(f"[ERROR] Automation failed: {e}")
            await page.screenshot(path="/tmp/olabi_error.png")
            raise
        finally:
            await browser.close()

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Olabi Portal Automation")
    parser.add_argument("--start-date", default="2025-02-26", help="Start date (YYYY-MM-DD)")
    parser.add_argument("--end-date", default=None, help="End date (YYYY-MM-DD), defaults to today")
    
    args = parser.parse_args()
    
    asyncio.run(run_automation(args.start_date, args.end_date))

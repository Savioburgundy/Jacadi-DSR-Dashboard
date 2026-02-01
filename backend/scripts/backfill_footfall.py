#!/usr/bin/env python3
"""
Surecount Footfall Backfill Script
Downloads footfall data for a date range to fill gaps in the database
"""

import os
import sys
import logging
from datetime import datetime, timedelta
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Configuration
SURECOUNT_URL = "https://deki.surecount.in"
SURECOUNT_USERNAME = os.environ.get("SURECOUNT_USERNAME", "JPAdmin")
SURECOUNT_PASSWORD = os.environ.get("SURECOUNT_PASSWORD", "JP192228")
DOWNLOAD_DIR = os.environ.get("DATA_INPUT_DIR", "/app/backend/data_input")

def convert_xlsx_to_csv(xlsx_path, csv_path):
    """Convert XLSX file to CSV using openpyxl"""
    try:
        import openpyxl
        import csv
        
        wb = openpyxl.load_workbook(xlsx_path)
        sheet = wb.active
        
        with open(csv_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            for row in sheet.iter_rows(values_only=True):
                writer.writerow(row)
        
        return csv_path
    except Exception as e:
        logger.error(f"Failed to convert xlsx to csv: {e}")
        return xlsx_path

def download_footfall_for_date_range(start_date: str, end_date: str):
    """
    Downloads footfall report for a specific date range.
    Dates should be in DD-MM-YYYY format.
    """
    os.makedirs(DOWNLOAD_DIR, exist_ok=True)
    
    logger.info(f"Downloading Footfall for: {start_date} to {end_date}")
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(accept_downloads=True)
        page = context.new_page()
        
        try:
            # Navigate and login
            logger.info("Logging in...")
            page.goto(SURECOUNT_URL, timeout=60000)
            page.wait_for_timeout(3000)
            
            page.get_by_label("Login ID").fill(SURECOUNT_USERNAME)
            page.get_by_label("Password").fill(SURECOUNT_PASSWORD)
            page.wait_for_timeout(500)
            page.get_by_role("button", name="sign in").click()
            page.wait_for_timeout(5000)
            
            # Navigate to Tabular Report
            page.click('text=Tabular Report')
            page.wait_for_timeout(3000)
            
            # Select Footfall - Hourly
            logger.info("Selecting Footfall - Hourly...")
            selects = page.locator('select').all()
            for select in selects:
                try:
                    options = select.locator('option').all_text_contents()
                    if any('Hourly' in opt for opt in options):
                        select.select_option(label='Footfall - Hourly')
                        break
                except:
                    continue
            
            page.wait_for_timeout(1000)
            
            # Set date range
            logger.info(f"Setting dates: {start_date} to {end_date}")
            page.evaluate(f'''
                document.querySelector('input[id*="txtFrom"]').value = '{start_date}';
                document.querySelector('input[id*="txtTo"]').value = '{end_date}';
            ''')
            page.wait_for_timeout(500)
            
            # Update report
            page.click('text=Update Report', timeout=10000)
            page.wait_for_timeout(5000)
            
            # Download
            logger.info("Downloading...")
            with page.expect_download(timeout=60000) as download_info:
                page.click('text=Download', timeout=10000)
            
            download = download_info.value
            
            # Save file
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            xlsx_filename = f"footfall_backfill_{start_date.replace('-', '')}_{end_date.replace('-', '')}_{timestamp}.xlsx"
            xlsx_filepath = os.path.join(DOWNLOAD_DIR, xlsx_filename)
            download.save_as(xlsx_filepath)
            
            # Convert to CSV
            csv_filepath = xlsx_filepath.replace('.xlsx', '.csv')
            convert_xlsx_to_csv(xlsx_filepath, csv_filepath)
            
            if os.path.exists(xlsx_filepath):
                os.remove(xlsx_filepath)
            
            logger.info(f"✅ Downloaded: {csv_filepath}")
            return csv_filepath
            
        except Exception as e:
            logger.error(f"Failed: {e}")
            try:
                page.screenshot(path="/tmp/backfill_error.png")
            except:
                pass
            raise
        finally:
            browser.close()

def main():
    # Date range to backfill: 11-01-2026 to 30-01-2026
    start_date = "11-01-2026"  # DD-MM-YYYY format
    end_date = "30-01-2026"
    
    if len(sys.argv) >= 3:
        start_date = sys.argv[1]
        end_date = sys.argv[2]
    
    try:
        filepath = download_footfall_for_date_range(start_date, end_date)
        print(f"SUCCESS: Downloaded {filepath}")
        print(f"Now run the ingestion to process this file.")
    except Exception as e:
        print(f"FAILED: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()

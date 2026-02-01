#!/usr/bin/env python3
"""
Surecount Footfall Report Automation Script
Downloads hourly footfall data from deki.surecount.in portal
"""

import os
import logging
from datetime import datetime, timedelta
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Configuration from environment variables
SURECOUNT_URL = "https://deki.surecount.in"
SURECOUNT_USERNAME = os.environ.get("SURECOUNT_USERNAME", "JPAdmin")
SURECOUNT_PASSWORD = os.environ.get("SURECOUNT_PASSWORD", "JP192228")
DOWNLOAD_DIR = os.environ.get("DATA_INPUT_DIR", "/app/backend/data_input")

def get_yesterday_date():
    """Get yesterday's date in DD-MM-YYYY format for the portal"""
    yesterday = datetime.now() - timedelta(days=1)
    return yesterday.strftime("%d-%m-%Y")

def download_footfall_report():
    """
    Automates the download of hourly footfall report from Surecount portal.
    Returns the path to the downloaded file.
    """
    # Ensure download directory exists
    os.makedirs(DOWNLOAD_DIR, exist_ok=True)
    
    report_date = get_yesterday_date()
    logger.info(f"Starting Footfall Download for Date: {report_date}")
    
    with sync_playwright() as p:
        # Launch browser
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(accept_downloads=True)
        page = context.new_page()
        
        try:
            # Navigate to login page
            logger.info("Navigating to Surecount login page...")
            page.goto(SURECOUNT_URL, timeout=60000)
            page.wait_for_timeout(3000)
            
            # Login
            logger.info("Filling login credentials...")
            page.get_by_label("Login ID").fill(SURECOUNT_USERNAME)
            page.get_by_label("Password").fill(SURECOUNT_PASSWORD)
            page.wait_for_timeout(500)
            
            page.get_by_role("button", name="sign in").click()
            page.wait_for_timeout(5000)
            logger.info(f"Logged in. URL: {page.url}")
            
            # Navigate to Tabular Report
            logger.info("Navigating to Tabular Report...")
            page.click('text=Tabular Report')
            page.wait_for_timeout(3000)
            
            # Set date range (yesterday to yesterday for daily report)
            logger.info(f"Setting date range to: {report_date}")
            
            # Clear and fill From date
            from_input = page.locator('input[placeholder*="From"], input:near(:text("From"))').first
            await_clear_and_fill(page, from_input, report_date)
            
            # Clear and fill To date
            to_input = page.locator('input[placeholder*="To"], input:near(:text("To"))').first
            await_clear_and_fill(page, to_input, report_date)
            
            # Select "Footfall - Hourly" from Data Output dropdown
            logger.info("Selecting Footfall - Hourly output...")
            page.select_option('select:near(:text("Data Ouput"))', label='Footfall - Hourly')
            page.wait_for_timeout(500)
            
            # Click Update Report to refresh data
            logger.info("Updating report...")
            page.click('button:has-text("Update Report")')
            page.wait_for_timeout(5000)
            
            # Click Download button
            logger.info("Downloading report...")
            with page.expect_download(timeout=60000) as download_info:
                page.click('button:has-text("Download")')
            
            download = download_info.value
            
            # Save the file
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"footfall_hourly_{report_date.replace('-', '')}_{timestamp}.csv"
            filepath = os.path.join(DOWNLOAD_DIR, filename)
            download.save_as(filepath)
            
            logger.info(f"✅ Footfall report downloaded: {filepath}")
            return filepath
            
        except PlaywrightTimeout as e:
            logger.error(f"Timeout error: {e}")
            raise
        except Exception as e:
            logger.error(f"Automation Failed: {e}")
            raise
        finally:
            browser.close()

def await_clear_and_fill(page, locator, value):
    """Helper to clear and fill an input field"""
    try:
        locator.click()
        page.wait_for_timeout(200)
        locator.fill('')
        page.wait_for_timeout(200)
        locator.fill(value)
        page.wait_for_timeout(200)
        # Press Tab to trigger any date picker validation
        locator.press('Tab')
    except Exception as e:
        logger.warning(f"Could not fill date field: {e}")

if __name__ == "__main__":
    try:
        filepath = download_footfall_report()
        print(f"SUCCESS: Downloaded {filepath}")
    except Exception as e:
        print(f"FAILED: {e}")
        exit(1)

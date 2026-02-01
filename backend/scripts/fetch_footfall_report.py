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
            
            # The Data Output dropdown shows "Footfall - Summary" by default
            # We need to change it to "Footfall - Hourly"
            logger.info("Selecting Footfall - Hourly output...")
            
            # Try to find and click the Data Output dropdown
            # The dropdown label says "Data Ouput" (with typo in the portal)
            try:
                # Select by visible label text near the dropdown
                page.locator('select').filter(has_text='Footfall').first.select_option(label='Footfall - Hourly')
            except:
                try:
                    # Try finding all selects and select the one with Footfall options
                    selects = page.locator('select').all()
                    for select in selects:
                        try:
                            options = select.locator('option').all_text_contents()
                            if any('Hourly' in opt for opt in options):
                                select.select_option(label='Footfall - Hourly')
                                logger.info("Found and selected Footfall - Hourly")
                                break
                        except:
                            continue
                except Exception as e:
                    logger.warning(f"Could not select Footfall - Hourly: {e}")
            
            page.wait_for_timeout(1000)
            
            # Set date range using JavaScript (dates are readonly with datepicker)
            logger.info(f"Setting date range to: {report_date}")
            page.evaluate(f'''
                var fromInput = document.querySelector('input[id*="txtFrom"], input[name*="txtFrom"]');
                var toInput = document.querySelector('input[id*="txtTo"], input[name*="txtTo"]');
                if (fromInput) fromInput.value = '{report_date}';
                if (toInput) toInput.value = '{report_date}';
            ''')
            page.wait_for_timeout(500)
            
            # Click Update Report button
            logger.info("Clicking Update Report...")
            try:
                page.click('text=Update Report', timeout=10000)
            except:
                try:
                    page.click('input[value*="Update"]', timeout=5000)
                except:
                    page.click('button:has-text("Update")', timeout=5000)
            
            page.wait_for_timeout(5000)
            logger.info("Report updated, preparing download...")
            
            # Take screenshot before download
            page.screenshot(path="/tmp/surecount_before_download.png")
            
            # Click Download button
            logger.info("Downloading report...")
            with page.expect_download(timeout=60000) as download_info:
                try:
                    page.click('text=Download', timeout=10000)
                except:
                    try:
                        page.click('button:has-text("Download")', timeout=5000)
                    except:
                        page.click('a:has-text("Download")', timeout=5000)
            
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
            try:
                page.screenshot(path="/tmp/surecount_error.png")
                logger.info("Error screenshot saved to /tmp/surecount_error.png")
            except:
                pass
            raise
        except Exception as e:
            logger.error(f"Automation Failed: {e}")
            try:
                page.screenshot(path="/tmp/surecount_error.png")
            except:
                pass
            raise
        finally:
            browser.close()

if __name__ == "__main__":
    try:
        filepath = download_footfall_report()
        print(f"SUCCESS: Downloaded {filepath}")
    except Exception as e:
        print(f"FAILED: {e}")
        exit(1)

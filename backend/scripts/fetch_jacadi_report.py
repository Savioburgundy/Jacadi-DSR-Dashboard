import os
import time
import shutil
import logging
import sys
import argparse
from datetime import datetime, timedelta
from playwright.sync_api import sync_playwright

# --- CONFIG ---
USERNAME = "JPHO@JP"
PASSWORD = "jPHO@JP@657"
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INPUT_REPORTS_DIR = os.path.join(BASE_DIR, "input_reports")
DATA_INPUT_DIR = os.environ.get("DATA_INPUT_DIR", os.path.join(BASE_DIR, "data_input"))
DOCUMENT_TYPE = "Sales Including Returns"

# Setup Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def clean_input_dir():
    """Ensure directories exist"""
    for dir_path in [INPUT_REPORTS_DIR, DATA_INPUT_DIR]:
        if not os.path.exists(dir_path):
            os.makedirs(dir_path)
            logger.info(f"Created {dir_path}")

def run_download():
    clean_input_dir()
    
    parser = argparse.ArgumentParser(description='Download Jacadi Report')
    parser.add_argument('--date', type=str, help='Date in YYYY-MM-DD format', default=None)
    args = parser.parse_args()

    if args.date:
        try:
            target_date = datetime.strptime(args.date, "%Y-%m-%d")
        except ValueError:
            logger.error("Invalid date format. Use YYYY-MM-DD")
            sys.exit(1)
    else:
        target_date = datetime.now() - timedelta(days=1)
        
    date_str = target_date.strftime("%Y-%m-%d")
    dmy_str = target_date.strftime("%d/%m/%Y")
    
    logger.info(f"Starting Download for Date: {dmy_str}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(accept_downloads=True)
        page = context.new_page()
        page.set_default_timeout(60000)
        
        try:
            # 1. Navigate to login page
            logger.info("Navigating to login page...")
            page.goto("https://login.olabi.ooo/", wait_until="domcontentloaded")
            
            # Wait for page to load
            logger.info("Waiting for page to load...")
            page.wait_for_timeout(3000)
            
            # IMPORTANT: Click the arrow/continue button on splash page
            logger.info("Looking for splash page continue button...")
            try:
                # Try to find any button/arrow that proceeds to login
                continue_selectors = [
                    "button[type='button']",  # Generic button
                    ".btn-next",
                    ".continue-btn", 
                    "a.arrow",
                    "button.arrow",
                    "svg",  # Arrow icon might be SVG
                    ".fa-arrow-right",
                    "i.fa",
                ]
                
                # First try clicking any visible button
                buttons = page.locator("button").all()
                for btn in buttons:
                    if btn.is_visible():
                        logger.info(f"Found visible button, clicking...")
                        btn.click()
                        page.wait_for_timeout(2000)
                        break
                
            except Exception as e:
                logger.info(f"No splash button needed or error: {e}")
            
            # Now wait for login form to appear
            logger.info("Waiting for login form...")
            page.wait_for_selector("#username_id", state="visible", timeout=30000)
            
            # Fill login form
            logger.info("Filling login credentials...")
            page.fill("#username_id", USERNAME)
            page.fill("#password_id", PASSWORD)
            
            # Click login button
            logger.info("Clicking Sign In...")
            page.locator("#signUp").click()
            
            # Wait for login
            logger.info("Waiting for login to complete...")
            page.wait_for_timeout(8000)
            
            # Handle "Disconnect Previous Login" popup
            try:
                disconnect_btn = page.locator("button:has-text('Disconnect')")
                if disconnect_btn.is_visible(timeout=5000):
                    logger.info("Disconnecting previous session...")
                    disconnect_btn.click()
                    page.wait_for_timeout(3000)
            except:
                pass
            
            page.wait_for_load_state("networkidle")
            logger.info(f"Current URL: {page.url}")
            
            # Click Menu button
            logger.info("Looking for Menu button...")
            menu_btn = page.locator("button:has-text('Menu')").first
            menu_btn.wait_for(state="visible", timeout=30000)
            menu_btn.click()
            logger.info("Clicked Menu")
            page.wait_for_timeout(2000)
            
            # Click Retail in sidebar
            logger.info("Looking for Retail...")
            page.get_by_text("Retail", exact=True).first.click()
            logger.info("Clicked Retail")
            page.wait_for_timeout(2000)
            
            # Click Reports
            logger.info("Looking for Reports...")
            page.locator("a:has-text('Reports')").first.click()
            logger.info("Clicked Reports")
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(3000)
            
            # Find Invoice Detail
            logger.info("Looking for Invoice Detail...")
            all_links = page.locator("a").all()
            invoice_link = None
            for link in all_links:
                try:
                    if link.is_visible():
                        text = link.inner_text().strip().lower()
                        if "invoice detail" in text and "product" not in text:
                            invoice_link = link
                            logger.info(f"Found: {text}")
                            break
                except:
                    continue
            
            if invoice_link:
                invoice_link.click()
            else:
                raise Exception("Invoice Detail link not found")
            
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(2000)
            
            # Selection Criteria
            logger.info("Setting selection criteria...")
            page.locator("a:has-text('Selection Criteria')").first.click()
            page.wait_for_timeout(1000)
            
            # Set dates
            page.wait_for_function('() => typeof $ !== "undefined" && $("#startDate").data && $("#startDate").data("kendoDatePicker")', timeout=15000)
            page.evaluate(f"""
                const s = $("#startDate").data("kendoDatePicker");
                const e = $("#endDate").data("kendoDatePicker");
                if (s && e) {{
                    s.value(new Date("{date_str}"));
                    e.value(new Date("{date_str}"));
                    s.trigger("change");
                    e.trigger("change");
                }}
            """)
            logger.info(f"Date set to {date_str}")

            # Select Doc Type
            try:
                page.locator("button:has-text('select')").nth(3).click()
                page.wait_for_timeout(500)
                page.locator(f"li:has-text('{DOCUMENT_TYPE}')").first.click()
            except:
                pass

            # Add columns
            try:
                page.locator("a:has-text('Add Data Columns')").first.click()
                page.wait_for_timeout(1000)
                page.evaluate("""() => {
                    const cbs = Array.from(document.querySelectorAll("input[type='checkbox'][name='addoptions']"));
                    cbs.forEach(cb => { if (!cb.checked && !cb.disabled) cb.click(); });
                }""")
                page.locator("a:has-text('Selection Criteria')").first.click()
            except:
                pass

            # Generate report
            logger.info("Generating report...")
            page.locator("button:has-text('GO')").first.click()
            
            # Wait for download button
            logger.info("Waiting for report to generate...")
            page.wait_for_function("""() => {
                const btns = Array.from(document.querySelectorAll("button"));
                return btns.some(b => ((b.innerText || "").trim().toLowerCase() === "download"));
            }""", timeout=120000)
            
            # Download
            logger.info("Downloading...")
            with page.expect_download(timeout=120000) as download_info:
                page.locator("button:has-text('Download')").first.click()
            
            download = download_info.value
            original_name = download.suggested_filename
            temp_path = os.path.join(INPUT_REPORTS_DIR, original_name)
            download.save_as(temp_path)
            
            final_path = os.path.join(DATA_INPUT_DIR, original_name)
            shutil.move(temp_path, final_path)
            
            logger.info(f"SUCCESS: {final_path}")
            print(f"SUCCESS: {final_path}")
            
        except Exception as e:
            logger.error(f"Automation Failed: {e}")
            page.screenshot(path=os.path.join(BASE_DIR, "error_screenshot.png"))
            sys.exit(1)
        finally:
            browser.close()

if __name__ == "__main__":
    run_download()

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
            
            # Wait for page to fully load
            logger.info("Waiting for page to load...")
            page.wait_for_timeout(5000)
            
            # Wait for username field to be visible
            logger.info("Waiting for login form...")
            page.wait_for_selector("#username_id", state="visible", timeout=30000)
            
            # Fill login form
            logger.info("Filling login credentials...")
            page.fill("#username_id", USERNAME)
            page.fill("#password_id", PASSWORD)
            
            # Take screenshot before login
            page.screenshot(path=os.path.join(BASE_DIR, "before_login.png"))
            
            # Click login button
            logger.info("Clicking Sign In...")
            page.locator("#signUp").click()
            
            # Wait for navigation/page change
            logger.info("Waiting for login to complete...")
            page.wait_for_timeout(8000)
            
            # Handle "Disconnect Previous Login" popup if it appears
            try:
                disconnect_btn = page.locator("button:has-text('Disconnect')")
                if disconnect_btn.is_visible(timeout=5000):
                    logger.info("Found Disconnect button, clicking...")
                    disconnect_btn.click()
                    page.wait_for_timeout(3000)
            except:
                logger.info("No disconnect popup")
            
            # Take screenshot after login
            page.screenshot(path=os.path.join(BASE_DIR, "after_login.png"))
            logger.info(f"Current URL: {page.url}")
            
            # Wait for dashboard
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(3000)
            
            # Debug: Print page title and URL
            logger.info(f"Page title: {page.title()}")
            logger.info(f"Page URL: {page.url}")
            
            # Look for Menu button - the portal uses specific classes
            logger.info("Looking for navigation elements...")
            
            # Take screenshot to see current state
            page.screenshot(path=os.path.join(BASE_DIR, "dashboard.png"))
            
            # Try to find menu by inspecting visible elements
            all_buttons = page.locator("button").all()
            logger.info(f"Found {len(all_buttons)} buttons")
            for i, btn in enumerate(all_buttons[:15]):
                try:
                    if btn.is_visible():
                        text = btn.inner_text()
                        classes = btn.get_attribute("class") or ""
                        logger.info(f"  Button {i}: '{text[:30]}' class='{classes[:50]}'")
                except Exception as e:
                    pass
            
            # Try clicking Menu button
            menu_btn = page.locator("button:has-text('Menu')").first
            if menu_btn.is_visible(timeout=10000):
                logger.info("Found Menu button, clicking...")
                menu_btn.click()
                page.wait_for_timeout(2000)
            else:
                logger.error("Menu button not visible")
                raise Exception("Could not find Menu button after login")
            
            # Take screenshot of menu open
            page.screenshot(path=os.path.join(BASE_DIR, "menu_open.png"))
            
            # Find and click Retail
            logger.info("Looking for Retail in menu...")
            
            # Get all links/items in sidebar
            sidebar_items = page.locator(".sidebar a, .sidebar li, nav a").all()
            logger.info(f"Found {len(sidebar_items)} sidebar items")
            
            retail_clicked = False
            for item in sidebar_items:
                try:
                    if item.is_visible():
                        text = item.inner_text().strip()
                        if text == "Retail":
                            logger.info(f"Found Retail, clicking...")
                            item.click()
                            retail_clicked = True
                            break
                except:
                    continue
            
            if not retail_clicked:
                # Try alternative
                page.get_by_text("Retail", exact=True).first.click()
                logger.info("Clicked Retail via text match")
            
            page.wait_for_timeout(2000)
            page.screenshot(path=os.path.join(BASE_DIR, "retail_menu.png"))
            
            # Click Reports
            logger.info("Clicking Reports...")
            page.locator("a:has-text('Reports')").first.click()
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(3000)
            
            page.screenshot(path=os.path.join(BASE_DIR, "reports_page.png"))
            
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
            
            # Set dates using jQuery
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
                logger.info(f"Document type: {DOCUMENT_TYPE}")
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

            # Generate
            logger.info("Generating report...")
            page.locator("button:has-text('GO')").first.click()
            
            # Wait for download button
            logger.info("Waiting for report...")
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

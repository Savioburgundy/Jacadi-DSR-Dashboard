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

def safe_click(locator, desc="", timeout=40000):
    try:
        locator.wait_for(state="visible", timeout=timeout)
        locator.click(force=True)
        time.sleep(0.5)
        logger.info(f"Clicked: {desc}")
    except Exception as e:
        logger.error(f"Failed to click {desc}: {e}")
        raise

def close_any_modal(page):
    try:
        if page.locator("#closePopover").is_visible():
            page.locator("#closePopover").click()
    except: pass
    try:
        page.keyboard.press("Escape")
    except: pass

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
        
        try:
            # 1. Login
            logger.info("Logging in...")
            page.goto("https://login.olabi.ooo/", timeout=60000)
            
            try:
                page.get_by_role("button").first.click(timeout=3000)
            except: pass

            page.fill("#username_id", USERNAME)
            page.fill("#password_id", PASSWORD)
            safe_click(page.locator("#signUp"), "Sign In")

            # Handle dual session
            try:
                btn = page.get_by_role("button", name="Disconnect Prev Login")
                if btn.is_visible(timeout=5000):
                    safe_click(btn, "Disconnect Prev")
            except: pass

            # Verify Login
            page.wait_for_timeout(3000)
            logger.info("Login Successful - waiting for page to stabilize")

            # 2. Navigate to Reports via sidebar
            close_any_modal(page)
            time.sleep(2)
            
            # Click the Menu/hamburger button to open sidebar
            menu_btn = page.locator("button:has-text('Menu')").first
            if not menu_btn.is_visible(timeout=5000):
                menu_btn = page.locator(".navbar-toggle, .sidebar-toggle, button.btn-toggle").first
            
            safe_click(menu_btn, "Menu Button")
            time.sleep(2)

            # Look for Retail in the main menu - use more specific selector
            # The sidebar menu has specific structure, look for exact match
            retail_menu = page.locator("a.menu-toggle:has-text('Retail')").first
            if not retail_menu.is_visible(timeout=3000):
                retail_menu = page.locator("span:text-is('Retail')").first
            if not retail_menu.is_visible(timeout=3000):
                retail_menu = page.locator(".sidebar-menu a:has-text('Retail')").first
            if not retail_menu.is_visible(timeout=3000):
                # Try clicking on sidebar parent elements
                retail_menu = page.locator("li.menu-item > a:has-text('Retail')").first
            
            safe_click(retail_menu, "Retail Menu")
            time.sleep(1)
            
            close_any_modal(page)
            
            # Click on Reports tab/submenu
            reports_link = page.locator("a[href*='report'], a:has-text('Reports')").first
            if not reports_link.is_visible(timeout=5000):
                reports_link = page.get_by_role("tab", name="Reports")
            
            safe_click(reports_link, "Reports")
            page.wait_for_load_state("networkidle")
            time.sleep(3)

            # 3. Open Invoice Detail Report
            logger.info("Opening Invoice Detail Report...")
            
            invoice_link = None
            for attempt in range(3):
                # Try multiple selectors
                selectors = [
                    "a:has-text('Invoice Detail')",
                    "a[title*='Invoice Detail']",
                    "td a:has-text('Invoice Detail')",
                ]
                
                for sel in selectors:
                    links = page.locator(sel).all()
                    for link in links:
                        if link.is_visible():
                            text = link.text_content() or ""
                            if "invoice detail" in text.lower() and "product" not in text.lower():
                                invoice_link = link
                                break
                    if invoice_link:
                        break
                
                if invoice_link:
                    break
                    
                logger.warning(f"Attempt {attempt+1}: Invoice Detail link not found. Retrying...")
                page.reload()
                page.wait_for_load_state("networkidle")
                time.sleep(5)

            if not invoice_link:
                # Debug: list all visible links
                logger.error("Could not find Invoice Detail link. Available links:")
                all_links = page.locator("a").all()
                for link in all_links[:30]:
                    if link.is_visible():
                        logger.info(f"  - {link.text_content()}")
                raise Exception("Invoice Detail link not found")
            
            safe_click(invoice_link, "Invoice Detail Link")
            page.wait_for_load_state("networkidle")
            time.sleep(2)

            # 4. Set Selection Criteria
            criteria_tab = page.locator("a:has-text('Selection Criteria')").first
            safe_click(criteria_tab, "Selection Criteria Tab")
            time.sleep(1)
            
            # Set dates using Kendo DatePicker
            page.wait_for_function('() => typeof $ !== "undefined" && $("#startDate").data && $("#startDate").data("kendoDatePicker")', timeout=10000)
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

            # Select Document Type
            try:
                doc_dropdown = page.locator("button:has-text('select')").nth(3)
                safe_click(doc_dropdown, "Doc Type Dropdown", timeout=5000)
                time.sleep(0.5)
                doc_option = page.locator(f"li:has-text('{DOCUMENT_TYPE}')").first
                safe_click(doc_option, f"Option: {DOCUMENT_TYPE}")
            except Exception as e:
                logger.warning(f"Could not set document type: {e}")

            # Add Data Columns
            logger.info("Selecting All Data Columns...")
            try:
                columns_tab = page.locator("a:has-text('Add Data Columns')").first
                safe_click(columns_tab, "Add Data Columns Tab")
                time.sleep(1)
                
                count = page.evaluate("""() => {
                    const cbs = Array.from(document.querySelectorAll("input[type='checkbox'][name='addoptions']"));
                    let clicked = 0;
                    cbs.forEach(cb => {
                        if (!cb.checked && !cb.disabled) {
                            cb.click();
                            clicked++;
                        }
                    });
                    return clicked;
                }""")
                logger.info(f"Selected {count} additional columns.")
                
                # Go back to criteria
                safe_click(page.locator("a:has-text('Selection Criteria')").first, "Back to Criteria")
            except Exception as e:
                logger.warning(f"Could not select all columns: {e}")

            # 5. Generate Report
            go_btn = page.locator("button:has-text('GO')").first
            safe_click(go_btn, "GO Button")
            
            logger.info("Waiting for report to generate...")
            page.wait_for_function("""() => {
                const btns = Array.from(document.querySelectorAll("button"));
                return btns.some(b => ((b.innerText || "").trim().toLowerCase() === "download"));
            }""", timeout=90000)
            logger.info("Report generated, downloading...")

            # 6. Download
            with page.expect_download(timeout=120000) as download_info:
                download_btn = page.locator("button:has-text('Download')").first
                safe_click(download_btn, "Download Button")
            
            download = download_info.value
            original_name = download.suggested_filename
            temp_path = os.path.join(INPUT_REPORTS_DIR, original_name)
            
            download.save_as(temp_path)
            logger.info(f"Downloaded to: {temp_path}")

            # Move to data_input
            final_path = os.path.join(DATA_INPUT_DIR, original_name)
            shutil.move(temp_path, final_path)
            
            logger.info(f"SUCCESS: {final_path}")
            print(f"SUCCESS: {final_path}")
            
        except Exception as e:
            logger.error(f"Automation Failed: {e}")
            screenshot_path = os.path.join(BASE_DIR, "error_screenshot.png")
            page.screenshot(path=screenshot_path)
            logger.info(f"Screenshot saved to: {screenshot_path}")
            sys.exit(1)
        finally:
            browser.close()

if __name__ == "__main__":
    run_download()

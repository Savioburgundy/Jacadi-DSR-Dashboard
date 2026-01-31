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
            page.wait_for_timeout(3000)
            
            # Click splash/continue button
            logger.info("Clicking continue button...")
            buttons = page.locator("button").all()
            for btn in buttons:
                if btn.is_visible():
                    btn.click()
                    page.wait_for_timeout(2000)
                    break
            
            # Fill login
            logger.info("Filling login...")
            page.wait_for_selector("#username_id", state="visible", timeout=30000)
            page.fill("#username_id", USERNAME)
            page.fill("#password_id", PASSWORD)
            page.locator("#signUp").click()
            
            # Wait and handle disconnect
            page.wait_for_timeout(8000)
            try:
                disconnect_btn = page.locator("button:has-text('Disconnect')")
                if disconnect_btn.is_visible(timeout=5000):
                    disconnect_btn.click()
                    page.wait_for_timeout(3000)
            except:
                pass
            
            page.wait_for_load_state("networkidle")
            logger.info(f"Logged in. URL: {page.url}")
            
            # Take screenshot of dashboard
            page.screenshot(path=os.path.join(BASE_DIR, "dashboard.png"))
            
            # Click on the sidebar toggle (lightning bolt or similar)
            logger.info("Opening sidebar...")
            try:
                # Try clicking the sidebar toggle
                sidebar_toggle = page.locator(".sidebar-toggle, .menu-toggle, [class*='sidebar'], [class*='menu-toggle']").first
                if sidebar_toggle.is_visible(timeout=5000):
                    sidebar_toggle.click()
                    page.wait_for_timeout(2000)
            except:
                pass
            
            # Look for Reports/grid icon in top navigation
            logger.info("Looking for reports navigation...")
            
            # Try clicking on the reports/grid icon in header
            try:
                # Look for icon that looks like reports or grid
                header_icons = page.locator("header a, header button, .navbar a, .navbar button, .header-right a, .header-right button, .topbar a, .topbar button").all()
                logger.info(f"Found {len(header_icons)} header elements")
                
                for icon in header_icons:
                    if icon.is_visible():
                        title = icon.get_attribute("title") or ""
                        classes = icon.get_attribute("class") or ""
                        text = icon.inner_text()
                        logger.info(f"  Header element: title='{title}' class='{classes[:50]}' text='{text[:30]}'")
            except Exception as e:
                logger.info(f"Header inspection error: {e}")
            
            # Try navigating directly to reports URL
            logger.info("Trying direct navigation to retail reports...")
            page.goto("https://login.olabi.ooo/retail/reports", wait_until="domcontentloaded")
            page.wait_for_timeout(5000)
            page.screenshot(path=os.path.join(BASE_DIR, "reports_page.png"))
            
            current_url = page.url
            logger.info(f"Current URL: {current_url}")
            
            # If not on reports, try finding Retail in sidebar/menu
            if "reports" not in current_url.lower():
                logger.info("Direct navigation didn't work, trying sidebar...")
                
                # Look for any element with "Retail" text
                retail_elements = page.locator("*:has-text('Retail')").all()
                logger.info(f"Found {len(retail_elements)} elements with 'Retail'")
                
                # Filter for visible, clickable ones
                for elem in retail_elements[:20]:
                    try:
                        if elem.is_visible():
                            tag = elem.evaluate("el => el.tagName")
                            text = elem.inner_text()[:50]
                            if tag.lower() in ['a', 'button', 'li', 'div', 'span']:
                                if text.strip().lower() == 'retail' or text.strip() == 'Retail':
                                    logger.info(f"Clicking Retail: tag={tag} text='{text}'")
                                    elem.click()
                                    page.wait_for_timeout(2000)
                                    break
                    except:
                        continue
                
                # Now look for Reports
                page.screenshot(path=os.path.join(BASE_DIR, "after_retail.png"))
                
                reports_link = page.locator("a:has-text('Reports'), button:has-text('Reports'), *[role='tab']:has-text('Reports')").first
                if reports_link.is_visible(timeout=10000):
                    reports_link.click()
                    page.wait_for_timeout(3000)
            
            page.wait_for_load_state("networkidle")
            page.screenshot(path=os.path.join(BASE_DIR, "reports_loaded.png"))
            
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
                            logger.info(f"Found Invoice Detail: {text}")
                            break
                except:
                    continue
            
            if invoice_link:
                invoice_link.click()
            else:
                # List available links for debugging
                logger.info("Invoice Detail not found. Available links:")
                for link in all_links[:30]:
                    try:
                        if link.is_visible():
                            logger.info(f"  - {link.inner_text()[:50]}")
                    except:
                        pass
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

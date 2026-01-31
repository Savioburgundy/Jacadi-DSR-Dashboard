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
        locator.scroll_into_view_if_needed()
        locator.click(force=True)
        time.sleep(0.5)
        logger.info(f"Clicked: {desc}")
        return True
    except Exception as e:
        logger.error(f"Failed to click {desc}: {e}")
        return False

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
        page.set_default_timeout(60000)
        
        try:
            # 1. Login
            logger.info("Navigating to login page...")
            page.goto("https://login.olabi.ooo/", timeout=60000)
            page.wait_for_load_state("networkidle")
            
            # Fill login form
            logger.info("Filling login credentials...")
            page.fill("#username_id", USERNAME)
            page.fill("#password_id", PASSWORD)
            
            # Click login button
            logger.info("Clicking Sign In...")
            page.locator("#signUp").click()
            
            # Wait for page to change after login
            logger.info("Waiting for login to complete...")
            page.wait_for_timeout(5000)
            
            # Handle "Disconnect Previous Login" popup if it appears
            try:
                disconnect_btn = page.get_by_role("button", name="Disconnect Prev Login")
                if disconnect_btn.is_visible(timeout=5000):
                    logger.info("Found Disconnect button, clicking...")
                    disconnect_btn.click()
                    page.wait_for_timeout(3000)
            except:
                logger.info("No disconnect popup found")
            
            # Take screenshot to see current state
            page.screenshot(path=os.path.join(BASE_DIR, "after_login.png"))
            logger.info("Screenshot saved: after_login.png")
            
            # Check URL to confirm login success
            current_url = page.url
            logger.info(f"Current URL after login: {current_url}")
            
            # Wait for dashboard to load
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(5000)
            
            # Take another screenshot
            page.screenshot(path=os.path.join(BASE_DIR, "dashboard_state.png"))
            logger.info("Screenshot saved: dashboard_state.png")
            
            # Debug: List all visible buttons
            logger.info("Listing visible buttons on page...")
            buttons = page.locator("button").all()
            for i, btn in enumerate(buttons[:10]):
                try:
                    if btn.is_visible():
                        text = btn.text_content() or btn.get_attribute("aria-label") or "No text"
                        logger.info(f"  Button {i}: {text[:50]}")
                except:
                    pass
            
            # Try to find and click Menu
            logger.info("Looking for Menu button...")
            
            # Try multiple selectors for menu
            menu_selectors = [
                "button:has-text('Menu')",
                "#menuButton",
                ".menu-toggle",
                "button[aria-label='Menu']",
                ".navbar-toggle",
                "button.btn-menu",
            ]
            
            menu_clicked = False
            for selector in menu_selectors:
                try:
                    menu_btn = page.locator(selector).first
                    if menu_btn.is_visible(timeout=3000):
                        menu_btn.click()
                        menu_clicked = True
                        logger.info(f"Clicked menu using: {selector}")
                        break
                except:
                    continue
            
            if not menu_clicked:
                logger.error("Could not find Menu button")
                page.screenshot(path=os.path.join(BASE_DIR, "no_menu_error.png"))
                raise Exception("Menu button not found")
            
            page.wait_for_timeout(2000)
            
            # Look for Retail in sidebar
            logger.info("Looking for Retail menu...")
            retail_selectors = [
                "a:has-text('Retail'):not(:has-text('Invoice'))",
                ".sidebar a:has-text('Retail')",
                "nav a:has-text('Retail')",
                "#sidebar a:has-text('Retail')",
            ]
            
            retail_clicked = False
            for selector in retail_selectors:
                try:
                    links = page.locator(selector).all()
                    for link in links:
                        if link.is_visible():
                            text = link.text_content() or ""
                            # Only click if it's exactly "Retail" not "Retail Invoice"
                            if text.strip().lower() == "retail" or text.strip() == "Retail":
                                link.click()
                                retail_clicked = True
                                logger.info(f"Clicked Retail menu")
                                break
                    if retail_clicked:
                        break
                except:
                    continue
            
            if not retail_clicked:
                # Try clicking by exact text match
                try:
                    page.get_by_text("Retail", exact=True).first.click()
                    retail_clicked = True
                    logger.info("Clicked Retail using exact text match")
                except Exception as e:
                    logger.warning(f"Exact text match failed: {e}")
            
            page.wait_for_timeout(2000)
            
            # Click on Reports
            logger.info("Looking for Reports...")
            try:
                reports_link = page.locator("a:has-text('Reports')").first
                if reports_link.is_visible(timeout=5000):
                    reports_link.click()
                    logger.info("Clicked Reports")
                else:
                    # Try tab
                    page.get_by_role("tab", name="Reports").click()
                    logger.info("Clicked Reports tab")
            except Exception as e:
                logger.error(f"Could not click Reports: {e}")
            
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(3000)
            
            # Find Invoice Detail
            logger.info("Looking for Invoice Detail report...")
            invoice_link = None
            
            links = page.locator("a").all()
            for link in links:
                try:
                    if link.is_visible():
                        text = (link.text_content() or "").strip().lower()
                        if "invoice detail" in text and "product" not in text:
                            invoice_link = link
                            logger.info(f"Found Invoice Detail link: {text}")
                            break
                except:
                    continue
            
            if not invoice_link:
                logger.error("Invoice Detail link not found")
                page.screenshot(path=os.path.join(BASE_DIR, "no_invoice_link.png"))
                raise Exception("Invoice Detail link not found")
            
            invoice_link.click()
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(2000)
            
            # Set Selection Criteria
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

            # Select Document Type
            try:
                page.locator("button:has-text('select')").nth(3).click()
                page.wait_for_timeout(500)
                page.locator(f"li:has-text('{DOCUMENT_TYPE}')").first.click()
                logger.info(f"Document type set to {DOCUMENT_TYPE}")
            except Exception as e:
                logger.warning(f"Could not set document type: {e}")

            # Add all data columns
            try:
                page.locator("a:has-text('Add Data Columns')").first.click()
                page.wait_for_timeout(1000)
                page.evaluate("""() => {
                    const cbs = Array.from(document.querySelectorAll("input[type='checkbox'][name='addoptions']"));
                    cbs.forEach(cb => { if (!cb.checked && !cb.disabled) cb.click(); });
                }""")
                page.locator("a:has-text('Selection Criteria')").first.click()
            except Exception as e:
                logger.warning(f"Could not select columns: {e}")

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
            logger.info("Downloading report...")
            with page.expect_download(timeout=120000) as download_info:
                page.locator("button:has-text('Download')").first.click()
            
            download = download_info.value
            original_name = download.suggested_filename
            temp_path = os.path.join(INPUT_REPORTS_DIR, original_name)
            download.save_as(temp_path)
            
            # Move to final location
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

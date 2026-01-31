import os
import time
import shutil
import logging
import sys
import re
from datetime import datetime, timedelta
from playwright.sync_api import sync_playwright

# --- CONFIG ---
USERNAME = "JPHO@JP"
PASSWORD = "jPHO@JP@657"
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) # server directory
INPUT_REPORTS_DIR = os.path.join(BASE_DIR, "input_reports")
FINAL_DEST_DIR = os.path.abspath(os.path.join(BASE_DIR, "../data_input"))
DOCUMENT_TYPE = "Sales Including Returns"

# Setup Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def clean_input_dir():
    """Optional: Archive old files or ensure directory exists"""
    if not os.path.exists(INPUT_REPORTS_DIR):
        os.makedirs(INPUT_REPORTS_DIR)
        logger.info(f"Created {INPUT_REPORTS_DIR}")

def safe_click(locator, desc=""):
    try:
        locator.wait_for(state="visible", timeout=40000)
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

import argparse

def run_download():
    clean_input_dir()
    
    # Parse Arguments
    parser = argparse.ArgumentParser(description='Download Jacadi Report')
    parser.add_argument('--date', type=str, help='Date in YYYY-MM-DD format', default=None)
    args = parser.parse_args()

    if args.date:
        # User defined date
        try:
            target_date = datetime.strptime(args.date, "%Y-%m-%d")
        except ValueError:
            logger.error("Invalid date format. Use YYYY-MM-DD")
            sys.exit(1)
    else:
        # Default to Yesterday
        target_date = datetime.now() - timedelta(days=1)
        
    date_str = target_date.strftime("%Y-%m-%d") # API format
    dmy_str = target_date.strftime("%d/%m/%Y")   # UI format
    
    logger.info(f"Starting Download for Date: {dmy_str}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(accept_downloads=True)
        page = context.new_page()
        
        try:
            # 1. Login
            logger.info("Logging in...")
            page.goto("https://login.olabi.ooo/", timeout=60000)
            
            # Legacy/Continue button check
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
            page.get_by_role("button", name="Menu").wait_for(timeout=30000)
            logger.info("Login Successful")

            # 2. Navigate to Reports
            close_any_modal(page)
            
            # Try to find Menu button more robustly
            menu_btn = page.get_by_role("button", name="Menu")
            if not menu_btn.is_visible():
                menu_btn = page.locator(".sidebar-toggle") # Alternative common selector
            
            safe_click(menu_btn, "Menu")
            time.sleep(1) # Let menu open

            # Try to find Retail button more robustly
            retail_btn = page.get_by_role("button", name="Retail")
            if not retail_btn.is_visible():
                retail_btn = page.locator("li:has-text('Retail')")
            
            safe_click(retail_btn, "Retail")
            time.sleep(1) # Let submenu open
            
            close_any_modal(page)
            
            reports_tab = page.get_by_role("tab", name="Reports")
            if not reports_tab.is_visible():
                reports_tab = page.locator("a:has-text('Reports')")
            
            safe_click(reports_tab, "Reports Tab")
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(3000) # Wait for list to load

            # 3. Open Invoice Detail
            logger.info("Opening Invoice Detail Report...")
            
            # Helper to find link (Robust Strategy from Original Script)
            def find_report_link(name):
                # 1. Try exact matches and pick the visible one
                links = page.get_by_role("link", name=name, exact=True).all()
                for l in links:
                    if l.is_visible():
                        logger.info(f"Found visible exact link: {name}")
                        return l
                
                # 2. Try fuzzy matches
                links = page.locator(f"a:has-text('{name}')").all()
                for l in links:
                    if l.is_visible() and name.lower() in (l.text_content() or "").lower():
                        logger.info(f"Found visible fuzzy link: {l.text_content()}")
                        return l

                return None

            # Retry logic
            link = None
            for attempt in range(3):
                link = find_report_link("Invoice Detail")
                if link: break
                
                logger.warning(f"Attempt {attempt+1}: Visible link not found. Reloading...")
                page.reload()
                page.wait_for_load_state("networkidle")
                page.wait_for_timeout(8000)
                
                # Re-navigation
                safe_click(page.get_by_role("button", name="Menu"), "Menu")
                safe_click(page.get_by_role("button", name="Retail"), "Retail")
                close_any_modal(page)
                safe_click(page.get_by_role("tab", name="Reports"), "Reports Tab")
                page.wait_for_load_state("networkidle")
                page.wait_for_timeout(5000)

            # Retry logic for finding link
            link = None
            for attempt in range(3):
                link = find_report_link("Invoice Detail")
                if link: break
                logger.warning(f"Attempt {attempt+1}: Report link not found. Reloading...")
                page.reload()
                page.wait_for_load_state("networkidle")
                page.wait_for_timeout(5000)
                
                # Re-navigation needed after reload
                safe_click(page.get_by_role("button", name="Menu"), "Menu")
                safe_click(page.get_by_role("button", name="Retail"), "Retail")
                close_any_modal(page)
                safe_click(page.get_by_role("tab", name="Reports"), "Reports Tab")
                page.wait_for_load_state("networkidle")
                page.wait_for_timeout(10000)

            if not link:
                logger.error("Link not found. Dumping visible links...")
                links = page.locator("a").all()
                for l in links:
                    if l.is_visible():
                        logger.info(f"Link: {l.text_content()}")
                raise Exception("Could not find 'Invoice Detail' link after 3 attempts")
            
            # Ensure it is visible before clicking
            link.wait_for(state="visible", timeout=10000)
            safe_click(link, "Invoice Detail Link")

            # 4. Set Criteria
            safe_click(page.get_by_role("link", name="Selection Criteria"), "Selection Criteria Tab")
            
            # Set Date via Kendo UI Hack (Proven reliable)
            page.wait_for_function('() => $("#startDate").data("kendoDatePicker") && $("#endDate").data("kendoDatePicker")')
            page.evaluate(f"""
                const s = $("#startDate").data("kendoDatePicker");
                const e = $("#endDate").data("kendoDatePicker");
                s.value(new Date("{date_str}"));
                e.value(new Date("{date_str}"));
                s.trigger("change"); e.trigger("change");
            """)
            logger.info(f"Date set to {date_str}")

            # Select Doc Type
            safe_click(page.get_by_role("button", name="select").nth(3), "Doc Type Dropdown")
            safe_click(page.get_by_role("option", name=DOCUMENT_TYPE), f"Option: {DOCUMENT_TYPE}")

            # --- ADD DATA COLUMNS (CRITICAL) ---
            logger.info("Selecting All Data Columns...")
            try:
                safe_click(page.get_by_role("link", name="Add Data Columns"), "Add Data Columns Tab")
                page.wait_for_timeout(1000)
                
                # Check all unchecked boxes
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
                
                # Go back to main tab
                safe_click(page.get_by_role("link", name="Selection Criteria"), "Back to Criteria")
            except Exception as e:
                logger.error(f"Failed to select columns: {e}")

            # 5. Generate & Download
            safe_click(page.get_by_role("button", name="GO"), "GO Button")
            
            logger.info("Waiting for Download Button...")
            # Wait for any button with text "Download"
            page.wait_for_function("""() => {
                const btns = Array.from(document.querySelectorAll("button"));
                return btns.some(b => ((b.innerText || "").trim().toLowerCase() === "download"));
            }""", timeout=60000)

            with page.expect_download(timeout=120000) as download_info:
                safe_click(page.get_by_role("button", name="Download"), "Download Button")
            
            download = download_info.value
            # Save using original filename from portal
            original_name = download.suggested_filename
            final_path = os.path.join(INPUT_REPORTS_DIR, original_name)
            
            download.save_as(final_path)
            logger.info(f"Downloaded to temp: {final_path}")

            # Move to Data Input used by Backend
            if not os.path.exists(FINAL_DEST_DIR):
                os.makedirs(FINAL_DEST_DIR)
            
            dest_path = os.path.join(FINAL_DEST_DIR, original_name)
            shutil.move(final_path, dest_path)
            
            logger.info(f"Moved to Final: {dest_path}")
            print(f"SUCCESS: {dest_path}") # Signal for Node.js
            
        except Exception as e:
            logger.error(f"Automation Failed: {e}")
            page.screenshot(path=os.path.join(BASE_DIR, "error_screenshot.png"))
            sys.exit(1)
        finally:
            browser.close()

if __name__ == "__main__":
    run_download()

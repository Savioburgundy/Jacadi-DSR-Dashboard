#!/usr/bin/env python3
"""
Script to ingest historical data CSV files into SQLite database.
"""
import sqlite3
import csv
import os
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, 'data.db')
DATA_INPUT_DIR = os.path.join(BASE_DIR, 'data_input')

def ingest_sales_transactions(csv_path):
    """Ingest sales transactions from CSV"""
    print(f"Ingesting sales transactions from: {csv_path}")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Count existing records
    cursor.execute("SELECT COUNT(*) FROM sales_transactions")
    before_count = cursor.fetchone()[0]
    print(f"Records before: {before_count}")
    
    inserted = 0
    skipped = 0
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            try:
                # Check if record already exists
                cursor.execute("SELECT id FROM sales_transactions WHERE id = ?", (row['id'],))
                if cursor.fetchone():
                    skipped += 1
                    continue
                
                cursor.execute("""
                    INSERT INTO sales_transactions (
                        id, invoice_no, invoice_date, invoice_month, invoice_time, transaction_type,
                        order_channel_code, order_channel_name, invoice_channel_code, invoice_channel_name,
                        sub_channel_code, sub_channel_name, location_code, location_name, store_type,
                        city, state, total_sales_qty, unit_mrp, invoice_mrp_value, invoice_discount_value,
                        invoice_discount_pct, invoice_basic_value, total_tax_pct, total_tax_amt,
                        nett_invoice_value, sales_person_code, sales_person_name, consumer_code,
                        consumer_name, consumer_mobile, product_code, product_name, category_name,
                        brand_name, created_at, mh1_description
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    row['id'], row['invoice_no'], row['invoice_date'], row['invoice_month'], row['invoice_time'],
                    row['transaction_type'], row['order_channel_code'], row['order_channel_name'],
                    row['invoice_channel_code'], row['invoice_channel_name'], row['sub_channel_code'],
                    row['sub_channel_name'], row['location_code'], row['location_name'], row['store_type'],
                    row['city'], row['state'],
                    int(float(row['total_sales_qty'])) if row['total_sales_qty'] else 0,
                    float(row['unit_mrp']) if row['unit_mrp'] else 0,
                    float(row['invoice_mrp_value']) if row['invoice_mrp_value'] else 0,
                    float(row['invoice_discount_value']) if row['invoice_discount_value'] else 0,
                    float(row['invoice_discount_pct']) if row['invoice_discount_pct'] else 0,
                    float(row['invoice_basic_value']) if row['invoice_basic_value'] else 0,
                    float(row['total_tax_pct']) if row['total_tax_pct'] else 0,
                    float(row['total_tax_amt']) if row['total_tax_amt'] else 0,
                    float(row['nett_invoice_value']) if row['nett_invoice_value'] else 0,
                    row['sales_person_code'], row['sales_person_name'], row['consumer_code'],
                    row['consumer_name'], row['consumer_mobile'], row['product_code'], row['product_name'],
                    row['category_name'], row['brand_name'], row['created_at'], row.get('mh1_description', '')
                ))
                inserted += 1
                
                if inserted % 1000 == 0:
                    print(f"  Inserted {inserted} records...")
                    conn.commit()
                    
            except Exception as e:
                print(f"  Error on row: {e}")
                continue
    
    conn.commit()
    
    # Count after
    cursor.execute("SELECT COUNT(*) FROM sales_transactions")
    after_count = cursor.fetchone()[0]
    
    conn.close()
    
    print(f"Records after: {after_count}")
    print(f"Inserted: {inserted}, Skipped (duplicates): {skipped}")
    return inserted

def ingest_location_efficiency(csv_path):
    """Ingest location efficiency from CSV"""
    print(f"\nIngesting location efficiency from: {csv_path}")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    inserted = 0
    updated = 0
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            try:
                # Use INSERT OR REPLACE for upsert
                cursor.execute("""
                    INSERT OR REPLACE INTO location_efficiency (
                        id, location_name, report_date, footfall, conversion_pct, multies_pct,
                        pm_footfall, pm_conversion_pct, pm_multies_pct
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    row['id'], row['location_name'], row['report_date'],
                    int(row['footfall']) if row['footfall'] else 0,
                    float(row['conversion_pct']) if row['conversion_pct'] else 0,
                    float(row['multies_pct']) if row['multies_pct'] else 0,
                    int(row['pm_footfall']) if row['pm_footfall'] else 0,
                    float(row['pm_conversion_pct']) if row['pm_conversion_pct'] else 0,
                    float(row['pm_multies_pct']) if row['pm_multies_pct'] else 0
                ))
                inserted += 1
                
            except Exception as e:
                print(f"  Error on row: {e}")
                continue
    
    conn.commit()
    conn.close()
    
    print(f"Inserted/Updated: {inserted}")
    return inserted

if __name__ == "__main__":
    print("=" * 60)
    print("Historical Data Ingestion")
    print("=" * 60)
    
    sales_csv = os.path.join(DATA_INPUT_DIR, 'historical_sales_transactions.csv')
    efficiency_csv = os.path.join(DATA_INPUT_DIR, 'historical_location_efficiency.csv')
    
    if os.path.exists(sales_csv):
        sales_count = ingest_sales_transactions(sales_csv)
    else:
        print(f"Sales CSV not found: {sales_csv}")
        sales_count = 0
    
    if os.path.exists(efficiency_csv):
        efficiency_count = ingest_location_efficiency(efficiency_csv)
    else:
        print(f"Efficiency CSV not found: {efficiency_csv}")
        efficiency_count = 0
    
    print("\n" + "=" * 60)
    print(f"TOTAL: {sales_count} sales transactions, {efficiency_count} efficiency records")
    print("=" * 60)

# Jacadi DSR Dashboard Logic Summary

This document provides a comprehensive breakdown of the logic used in each tab and column of the Jacadi DSR Dashboard.

## Global Logic & Definitions

| Metric | Logic / Definition |
| :--- | :--- |
| **Total Sales Value** | Sum of net bill amounts (Sales minus Returns). This value includes taxes and is net of discounts. |
| **MTD (Month to Date)** | Total from the **1st of the month** up to the **Selected End Date**. |
| **PM (Prior Month)** | Same date range, but in the previous month (e.g., Jan 1-15 vs Dec 1-15). |
| **YTD (Year to Date)** | Cumulative totals from the **start of the Financial Year (April 1st)** to the selected date. |
| **Total Bills (TRX)** | Count of unique **Bill Numbers** for sales transactions. |

---

## Tab-Specific Logic

### 1. Retail + Whatsapp Sales
This tab focuses on the performance of brick-and-mortar stores, splitting their revenue into direct retail and Whatsapp-assisted sales.

| Column | Logic / Derivation |
| :--- | :--- |
| **MTD SALE** | Total sales from stores (excluding online), including Whatsapp. |
| **MTD QTY** | Total pieces sold (Net of returns). |
| **MTD TRX** | Total number of bills generated. |
| **PM SALE / QTY / TRX** | Same logic as above, but for the previous month's period. |
| **SALE % (Growth)** | `((Current Sale - Previous Sale) ÷ Previous Sale) × 100` |
| **TRX % (Growth)** | `((Current Bills - Previous Bills) ÷ Previous Bills) × 100` |
| **YTD SALE / TRX** | Cumulative totals from April 1st (Start of Financial Year) to the selected date. |

### 2. Retail + Whatsapp Sales (Conversions)
This tab tracks efficiency and store performance metrics.

| Column | Logic / Derivation |
| :--- | :--- |
| **MTD CONVERSION %** | `(Total Bills ÷ Total Walk-ins) × 100`. |
| **MTD ATV** | `Total Sales ÷ Total Bills` (Average Bill Value). |
| **MTD BASKET SIZE** | `Total Quantity ÷ Total Bills` (Average items per bill). |
| **MTD MULTIES %** | `(Bills with 2 or more items ÷ Total Bills) × 100`. |
| **MTD FOOTFALL** | Total walk-ins recorded during the period. |

### 3. Omni Channel (Details)
Focuses exclusively on E-Commerce (Shopify) performance.

| Column | Logic / Derivation |
| :--- | :--- |
| **MTD SALE** | Total sales value from Shopify online store. |
| **MTD TRX** | Total number of online bills. |
| **MTD UNITS** | Total quantity sold online. |
| **MTD ATV** | `Online Sales ÷ Online Bills`. |
| **MTD BASKET** | `Online Units ÷ Online Bills`. |

### 4. Omni Channel TM vs LM
A comparison of current month vs last month performance for the E-Commerce channel.

| Column | Logic / Derivation |
| :--- | :--- |
| **MTD SALE / TRX** | Current Month E-Commerce performance. |
| **PM SALE / TRX** | Prior Month E-Commerce performance. |
| **SALE % / TRX %** | Growth percentage comparing TM vs LM. |

### 5. Retail + Omni (Total)
Consolidated view of all sales channels (Retail + Whatsapp + E-Commerce).

| Column | Logic / Derivation |
| :--- | :--- |
| **MTD SALE / TRX** | Combined totals for all locations and channels. |
| **PM SALE / TRX** | Combined totals for the prior month period. |
| **YTD SALE / TRX** | Combined brand-level totals since April 1st. |

### 6. Whatsapp Sales (Breakdown)
A detailed split of B&M store sales into Retail and Whatsapp shares.

| Column | Logic / Derivation |
| :--- | :--- |
| **Retail Sales** | Sales where channel ≠ 'E-Commerce' and Sales Person ≠ 'Whatsapp'. |
| **Whatsapp Sales** | Sales where Sales Person contains 'Whatsapp'. |
| **Retail / WA %** | The percentage share of each sub-channel within that store's total sales. |

---

## Summary View (KPI Cards)
The four cards at the top of the dashboard are derived as follows:

1. **Total Revenue**: Sum of `nett_invoice_value` for all channels in the selected range.
2. **Transactions**: Distinct count of `invoice_no` (Sales items only) in the selected range.
3. **Avg Transaction (ATV)**: `Total Revenue / Total Transactions`.
4. **Active Stores**: Count of unique `location_name` that have recorded sales in the selected period.

---
> [!NOTE]
> All calculations use **Net Quantity** (Sales - Returns) and **Nett Invoice Value** to ensure the dashboard reflects the real revenue landing in the bank, matching accounting expectations.

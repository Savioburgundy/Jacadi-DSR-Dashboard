
import db from '../config/db';

const run = async () => {
    try {
        console.log("Searching for 403 TRX and 2.64 Basket Size...");

        const sql = `
            WITH InvoiceSummary AS (
                SELECT 
                    s.location_name,
                    s.invoice_no,
                    s.invoice_date,
                    s.transaction_type,
                    SUM(CASE WHEN mh1_description = 'Sales' THEN total_sales_qty ELSE 0 END) as total_qty,
                    MAX(CASE WHEN mh1_description = 'Sales' THEN 1 ELSE 0 END) as is_sales_trx
                FROM sales_transactions s
                GROUP BY s.location_name, s.invoice_no, s.invoice_date, s.transaction_type
            )
            SELECT 
                Location,
                SUM(CASE WHEN DATE(invoice_date) >= DATE('2026-01-01') AND DATE(invoice_date) <= DATE('2026-01-25') THEN total_qty ELSE 0 END) as MTD_QTY,
                COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE('2026-01-01') AND DATE(invoice_date) <= DATE('2026-01-25') AND transaction_type IN ('IV', 'IR') AND is_sales_trx = 1 THEN invoice_no ELSE NULL END) as MTD_TRX,
                SUM(CASE WHEN DATE(invoice_date) >= DATE('2025-12-01') AND DATE(invoice_date) <= DATE('2025-12-25') THEN total_qty ELSE 0 END) as PM_QTY,
                COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE('2025-12-01') AND DATE(invoice_date) <= DATE('2025-12-25') AND transaction_type IN ('IV', 'IR') AND is_sales_trx = 1 THEN invoice_no ELSE NULL END) as PM_TRX
            FROM (
                SELECT 'Jacadi Palladium' as Location, * FROM InvoiceSummary WHERE location_name = 'Jacadi Palladium'
                UNION ALL
                SELECT 'Jacadi MOA' as Location, * FROM InvoiceSummary WHERE location_name = 'Jacadi MOA'
                UNION ALL
                SELECT 'Shopify Webstore' as Location, * FROM InvoiceSummary WHERE location_name = 'Shopify Webstore'
                UNION ALL
                SELECT 'TOTAL' as Location, * FROM InvoiceSummary
            )
            GROUP BY Location
        `;
        const res = await db.query(sql);
        console.log("RESULTS:");
        res.rows.forEach((row: any) => {
            const mtd_basket = row.MTD_TRX > 0 ? (row.MTD_QTY / row.MTD_TRX).toFixed(4) : '0';
            const pm_basket = row.PM_TRX > 0 ? (row.PM_QTY / row.PM_TRX).toFixed(4) : '0';
            console.log(`${row.Location.padEnd(20)} | MTD Qty: ${row.MTD_QTY.toString().padEnd(5)} | MTD TRX: ${row.MTD_TRX.toString().padEnd(5)} | MTD Basket: ${mtd_basket}`);
            console.log(`${''.padEnd(20)} | PM Qty:  ${row.PM_QTY.toString().padEnd(5)} | PM TRX:  ${row.PM_TRX.toString().padEnd(5)} | PM Basket:  ${pm_basket}`);
            console.log('-'.repeat(80));
        });

    } catch (e) {
        console.error(e);
    }
};

run();

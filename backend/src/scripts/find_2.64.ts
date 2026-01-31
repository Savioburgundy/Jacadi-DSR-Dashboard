
import db from '../config/db';

const run = async () => {
    try {
        console.log("Searching for 403 TRX and 2.64 Basket Size in Totals (Jan 1-25)...");

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
                -- MTD
                SUM(CASE WHEN DATE(invoice_date) >= DATE('2026-01-01') AND DATE(invoice_date) <= DATE('2026-01-25') THEN total_qty ELSE 0 END) as MTD_QTY,
                COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE('2026-01-01') AND DATE(invoice_date) <= DATE('2026-01-25') AND transaction_type IN ('IV', 'IR') AND is_sales_trx = 1 THEN invoice_no ELSE NULL END) as MTD_TRX,
                -- PM
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
        const rows = res.rows.map((row: any) => ({
            ...row,
            MTD_BASKET: row.MTD_TRX > 0 ? (row.MTD_QTY / row.MTD_TRX).toFixed(2) : '0.00',
            PM_BASKET: row.PM_TRX > 0 ? (row.PM_QTY / row.PM_TRX).toFixed(2) : '0.00'
        }));
        console.table(rows);

    } catch (e) {
        console.error(e);
    }
};

run();

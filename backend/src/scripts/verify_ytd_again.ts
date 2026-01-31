
import db from '../config/db';

const run = async () => {
    try {
        console.log("Re-verifying YTD Aggregation...");

        // 1. Count rows per year
        const sql1 = `
            SELECT substr(invoice_date, 1, 4) as year, COUNT(*) as count, SUM(nett_invoice_value) as revenue
            FROM sales_transactions
            GROUP BY year
        `;
        const res1 = await db.query(sql1);
        console.log("Annual Totals:");
        console.table(res1.rows);

        // 2. Fiscal Year (Apr 2025 - Mar 2026)
        const sql2 = `
            SELECT 
                SUM(nett_invoice_value) as ytd_revenue,
                COUNT(DISTINCT invoice_no) as ytd_trx
            FROM sales_transactions
            WHERE DATE(invoice_date) >= DATE('2025-04-01')
        `;
        const res2 = await db.query(sql2);
        console.log("Fiscal YTD (Since Apr 1, 2025):", res2.rows[0]);

    } catch (e) {
        console.error(e);
    }
};

run();

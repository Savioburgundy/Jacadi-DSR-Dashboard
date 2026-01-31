
import db from '../config/db';

const run = async () => {
    try {
        console.log("Verifying TRX Count Change...");

        // 1. Current logic (Sales only)
        const sql1 = `
            SELECT COUNT(DISTINCT invoice_no) as count
            FROM sales_transactions
            WHERE DATE(invoice_date) >= DATE('2025-04-01')
            AND transaction_type IN ('IV', 'IR')
            AND mh1_description = 'Sales'
        `;
        const res1 = await db.query(sql1);
        console.log("YTD TRX (Sales Only):", res1.rows[0].count);

        // 2. Unfiltered logic (Everything)
        const sql2 = `
            SELECT COUNT(DISTINCT invoice_no) as count
            FROM sales_transactions
            WHERE DATE(invoice_date) >= DATE('2025-04-01')
        `;
        const res2 = await db.query(sql2);
        console.log("YTD TRX (All Types):", res2.rows[0].count);

    } catch (e) {
        console.error(e);
    }
};

run();

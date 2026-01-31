
import db from '../config/db';

const run = async () => {
    try {
        console.log("Checking SR Transactions...");

        // 1. Sample SR values
        const sql1 = `SELECT nett_invoice_value FROM sales_transactions WHERE transaction_type = 'SR' LIMIT 5`;
        const res1 = await db.query(sql1);
        console.log("SR Samples:", res1.rows);

        // 2. Total SR Value (Absolute sum of negatives)
        const sql2 = `
            SELECT SUM(nett_invoice_value) as total_returns
            FROM sales_transactions
            WHERE DATE(invoice_date) >= DATE('2025-04-01')
            AND transaction_type = 'SR'
        `;
        const res2 = await db.query(sql2);
        console.log("Total YTD Returns (Negative impact):", res2.rows[0].total_returns);

        // 3. Gross Sales (Excluding SR)
        const sql3 = `
            SELECT SUM(nett_invoice_value) as gross_sales
            FROM sales_transactions
            WHERE DATE(invoice_date) >= DATE('2025-04-01')
            AND transaction_type != 'SR'
        `;
        const res3 = await db.query(sql3);
        console.log("Hypothetical Gross Sales (No SR):", res3.rows[0].gross_sales);

    } catch (e) {
        console.error(e);
    }
};

run();

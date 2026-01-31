
import db from '../config/db';

const run = async () => {
    try {
        console.log("Verifying YTD Gross Implementation...");

        // 1. Simulate the new Logic (Gross YTD)
        const sql = `
            SELECT 
                SUM(CASE 
                    WHEN DATE(invoice_date) >= DATE('2025-04-01') AND transaction_type != 'SR'
                    THEN nett_invoice_value ELSE 0 END) as YTD_GROSS_SALE
            FROM sales_transactions
        `;
        const res = await db.query(sql);
        console.log(`NEW YTD REVENUE (Gross): ${res.rows[0].YTD_GROSS_SALE}`);
        console.log(`(Expected: ~55,159,446)`);

    } catch (e) {
        console.error(e);
    }
};

run();

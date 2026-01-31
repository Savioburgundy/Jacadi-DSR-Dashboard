
import db from '../config/db';

const run = async () => {
    try {
        console.log("Inspecting Invoice Date Formats...");

        // Get random sample
        const sql = `SELECT invoice_date, invoice_no FROM sales_transactions ORDER BY RANDOM() LIMIT 20`;
        const res = await db.query(sql);
        console.log(JSON.stringify(res.rows, null, 2));

        // Check for non-standard formats specifically
        // Standard expected: YYYY-MM-DD
        const sql2 = `
            SELECT invoice_date, COUNT(*) as count 
            FROM sales_transactions 
            WHERE invoice_date NOT LIKE '202%' 
            GROUP BY invoice_date 
            LIMIT 10
        `;
        const res2 = await db.query(sql2);
        console.log("Suspicious Date Formats:", JSON.stringify(res2.rows, null, 2));

    } catch (e) {
        console.error(e);
    }
};

run();

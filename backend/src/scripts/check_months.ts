
import db from '../config/db';

const run = async () => {
    try {
        console.log("Checking Available Months in sales_transactions...");
        const sql = `
            SELECT substr(invoice_date, 1, 7) as month, count(*) as count 
            FROM sales_transactions 
            GROUP BY month 
            ORDER BY month
        `;
        const res = await db.query(sql);
        console.log("Found Data For Months:");
        console.table(res.rows);

        console.log("\nChecking Processed Files Log (LIMIT 20)...");
        const sql2 = `SELECT filename, file_date, processed_at FROM processed_files ORDER BY processed_at DESC LIMIT 20`;
        const res2 = await db.query(sql2);
        console.table(res2.rows);

        console.log("\nChecking Raw Invoice Count (No Date Filter):");
        const res3 = await db.query("SELECT COUNT(*) as total FROM sales_transactions");
        console.log("Total Rows:", res3.rows[0].total);

    } catch (e) {
        console.error(e);
    }
};

run();

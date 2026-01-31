
import db from '../config/db';

const run = async () => {
    try {
        console.log("Checking Invoice Years...");

        // Check ISO format years
        const sql = `
            SELECT substr(invoice_date, 1, 4) as year_iso, count(*) 
            FROM sales_transactions 
            GROUP BY year_iso
        `;
        const res = await db.query(sql);
        console.log("ISO Years (YYYY):");
        console.table(res.rows);

        // Check for DD/MM/YYYY format where year is at the end? 
        // Or DD-MM-YYYY
        const sql2 = `
            SELECT substr(invoice_date, 7, 4) as year_end, count(*) 
            FROM sales_transactions 
            WHERE invoice_date LIKE '__-__-____'
            GROUP BY year_end
        `;
        const res2 = await db.query(sql2);
        console.log("Possible DD-MM-YYYY Years:");
        console.table(res2.rows);

        // Check for what the user said "26th feb 2025" -> '26-02-2025' ?? 
        const sql3 = `SELECT invoice_date FROM sales_transactions WHERE invoice_date LIKE '%2025%' LIMIT 5`;
        const res3 = await db.query(sql3);
        console.log("Sample 2025 dates:", res3.rows);

    } catch (e) {
        console.error(e);
    }
};

run();

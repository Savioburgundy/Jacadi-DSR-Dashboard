
import db from '../config/db';

const run = async () => {
    try {
        console.log("Checking DB stats...");
        const sql = `
            SELECT 
                location_name,
                mh1_description,
                COUNT(*) as row_count,
                COUNT(DISTINCT invoice_no) as distinct_invoices
            FROM sales_transactions
            GROUP BY location_name, mh1_description
            ORDER BY location_name;
        `;
        const res = await db.query(sql);
        console.table(res.rows);
    } catch (e) {
        console.error("Error:", e);
    }
};

run();

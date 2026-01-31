
import db from '../config/db';

const run = async () => {
    try {
        console.log("Checking Sales Person Names for E-Commerce...");

        const sql = `
            SELECT 
                sales_person_name,
                COUNT(*) as count
            FROM sales_transactions
            WHERE order_channel_name = 'E-Commerce'
            GROUP BY sales_person_name
        `;
        const res = await db.query(sql);
        console.table(res.rows);

        console.log("\nTop 20 Sales Person Names (All Channels):");
        const sql2 = `
            SELECT 
                sales_person_name,
                COUNT(*) as count
            FROM sales_transactions
            GROUP BY sales_person_name
            ORDER BY count DESC
            LIMIT 20
        `;
        const res2 = await db.query(sql2);
        console.table(res2.rows);

    } catch (e) {
        console.error(e);
    }
};

run();

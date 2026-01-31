
import db from '../config/db';

const run = async () => {
    try {
        console.log("Analyzing Sales Person Names for Whatsapp...");

        const sql = `
            SELECT 
                sales_person_name,
                COUNT(*) as trx_count,
                SUM(nett_invoice_value) as total_sales
            FROM sales_transactions
            WHERE sales_person_name LIKE '%what%' OR sales_person_name LIKE '%app%'
            GROUP BY sales_person_name
            ORDER BY total_sales DESC
        `;
        const res = await db.query(sql);
        console.table(res.rows);

        // Also check if any exist currently under 'E-Commerce' channel
        console.log("\nChecking intersection with E-Commerce Channel:");
        const sql2 = `
            SELECT 
                sales_person_name,
                COUNT(*) as count
            FROM sales_transactions
            WHERE order_channel_name = 'E-Commerce'
            GROUP BY sales_person_name
        `;
        const res2 = await db.query(sql2);
        console.table(res2.rows);

    } catch (e) {
        console.error(e);
    }
};

run();

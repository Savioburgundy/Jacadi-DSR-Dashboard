
import db from '../config/db';

const run = async () => {
    try {
        console.log("Checking Channel for Whatsapp Sales Persons...");

        const sql = `
            SELECT 
                order_channel_name,
                COUNT(*) as count
            FROM sales_transactions
            WHERE sales_person_name LIKE '%Whatsapp%'
            GROUP BY order_channel_name
        `;
        const res = await db.query(sql);
        console.table(res.rows);

    } catch (e) {
        console.error(e);
    }
};

run();

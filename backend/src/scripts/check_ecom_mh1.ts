
import db from '../config/db';

const run = async () => {
    try {
        const sql = `
            SELECT 
                order_channel_name,
                mh1_description,
                COUNT(*) as row_count
            FROM sales_transactions
            WHERE order_channel_name = 'E-Commerce'
            GROUP BY order_channel_name, mh1_description
        `;
        const res = await db.query(sql);
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    }
};

run();

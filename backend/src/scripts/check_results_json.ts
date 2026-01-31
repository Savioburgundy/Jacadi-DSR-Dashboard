
import db from '../config/db';

const run = async () => {
    try {
        const sql = `
            SELECT 
                location_name,
                COUNT(DISTINCT invoice_no) as MTD_TRX
            FROM sales_transactions
            WHERE 
                DATE(invoice_date) >= '2026-01-01' 
                AND DATE(invoice_date) <= '2026-01-25'
                AND order_channel_name = 'Brick and Mortar'
                AND transaction_type IN ('IV', 'IR')
                AND mh1_description = 'Sales'
            GROUP BY location_name
        `;
        const res = await db.query(sql);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    }
};

run();

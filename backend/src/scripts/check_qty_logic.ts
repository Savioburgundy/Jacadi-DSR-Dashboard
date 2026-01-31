
import db from '../config/db';

const run = async () => {
    try {
        console.log("Checking SR Quantities...");

        const sql = `
            SELECT transaction_type, total_sales_qty 
            FROM sales_transactions 
            WHERE transaction_type = 'SR' 
            LIMIT 5
        `;
        const res = await db.query(sql);
        console.table(res.rows);

        const sql2 = `
            SELECT SUM(total_sales_qty) as total_qty
            FROM sales_transactions
            WHERE DATE(invoice_date) >= DATE('2026-01-01') AND DATE(invoice_date) <= DATE('2026-01-25')
            AND location_name = 'Jacadi Palladium'
        `;
        const res2 = await db.query(sql2);
        console.log("Palladium Total Qty (All Types):", res2.rows[0].total_qty);

    } catch (e) {
        console.error(e);
    }
};

run();

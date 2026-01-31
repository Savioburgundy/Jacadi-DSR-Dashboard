
import db from '../config/db';

const run = async () => {
    try {
        const sql = `
            SELECT 
                SUM(nett_invoice_value) as ytd_revenue,
                COUNT(DISTINCT invoice_no) as ytd_trx
            FROM sales_transactions
            WHERE DATE(invoice_date) >= DATE('2025-04-01')
        `;
        const res = await db.query(sql);
        console.log(`YTD REVENUE: ${res.rows[0].ytd_revenue}`);
        console.log(`YTD TRX: ${res.rows[0].ytd_trx}`);
    } catch (e) {
        console.error(e);
    }
};

run();


import db from '../config/db';

const run = async () => {
    try {
        console.log("Checking Various YTD Sums (Since Apr 1, 2025)...");

        const sql = `
            SELECT 
                SUM(nett_invoice_value) as total_nett,
                SUM(invoice_basic_value) as total_basic,
                SUM(invoice_mrp_value) as total_mrp,
                SUM(invoice_discount_value) as total_discount,
                SUM(total_tax_amt) as total_tax
            FROM sales_transactions
            WHERE DATE(invoice_date) >= DATE('2025-04-01')
        `;
        const res = await db.query(sql);
        console.table(res.rows);

    } catch (e) {
        console.error(e);
    }
};

run();

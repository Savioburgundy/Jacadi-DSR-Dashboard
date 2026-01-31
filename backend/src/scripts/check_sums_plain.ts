
import db from '../config/db';

const run = async () => {
    try {
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
        console.log(`NETT: ${res.rows[0].total_nett}`);
        console.log(`BASIC: ${res.rows[0].total_basic}`);
        console.log(`MRP: ${res.rows[0].total_mrp}`);
        console.log(`DISC: ${res.rows[0].total_discount}`);
        console.log(`TAX: ${res.rows[0].total_tax}`);

    } catch (e) {
        console.error(e);
    }
};

run();


import db from '../config/db';

const run = async () => {
    try {
        console.log("Checking for duplicates...");

        const countSql = `SELECT COUNT(*) as total FROM sales_transactions`;
        const countRes = await db.query(countSql);
        console.log("Total Rows:", countRes.rows[0].total);

        // Check for duplicate invoice lines?
        // Let's check if the same invoice_no + product_code appears multiple times for *different* IDs.
        // Actually, let's just count total Invoices vs Distinct Invoices
        const invSql = `SELECT COUNT(invoice_no) as total_inv_rows, COUNT(DISTINCT invoice_no) as distinct_inv FROM sales_transactions`;
        const invRes = await db.query(invSql);
        console.log("Invoice Stats:", invRes.rows[0]);

        // Detailed check for one sample invoice
        const sampleSql = `SELECT * FROM sales_transactions LIMIT 1`;
        const sampleRes = await db.query(sampleSql);
        if (sampleRes.rows.length > 0) {
            const sampleInv = sampleRes.rows[0].invoice_no;
            console.log(`Checking sample invoice: ${sampleInv}`);

            const detailSql = `SELECT id, product_code, mh1_description, nett_invoice_value FROM sales_transactions WHERE invoice_no = '${sampleInv}'`;
            const detailRes = await db.query(detailSql);
            console.table(detailRes.rows);
        }

    } catch (e) {
        console.error("Error:", e);
    }
};

run();

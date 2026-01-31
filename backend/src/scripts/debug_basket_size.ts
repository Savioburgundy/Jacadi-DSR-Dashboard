
import db from '../config/db';

const run = async () => {
    try {
        console.log("Investigating Palladium Numbers (Jan 1-25)...");

        // 1. Total Distinct Invoices (IV, IR, SR) regardless of items
        const sql1 = `
            SELECT COUNT(DISTINCT invoice_no) as count
            FROM sales_transactions
            WHERE location_name = 'Jacadi Palladium'
            AND DATE(invoice_date) >= DATE('2026-01-01') AND DATE(invoice_date) <= DATE('2026-01-25')
        `;
        const res1 = await db.query(sql1);
        console.log("Total Distinct Invoices (All Types, All Items):", res1.rows[0].count);

        // 2. Count of IV/IR only
        const sql2 = `
            SELECT COUNT(DISTINCT invoice_no) as count
            FROM sales_transactions
            WHERE location_name = 'Jacadi Palladium'
            AND DATE(invoice_date) >= DATE('2026-01-01') AND DATE(invoice_date) <= DATE('2026-01-25')
            AND transaction_type IN ('IV', 'IR')
        `;
        const res2 = await db.query(sql2);
        console.log("Total IV/IR Invoices (All Items):", res2.rows[0].count);

        // 3. Total Qty (All items)
        const sql3 = `
            SELECT SUM(total_sales_qty) as total_qty
            FROM sales_transactions
            WHERE location_name = 'Jacadi Palladium'
            AND DATE(invoice_date) >= DATE('2026-01-01') AND DATE(invoice_date) <= DATE('2026-01-25')
        `;
        const res3 = await db.query(sql3);
        console.log("Total Quantity (All Items, Incl SR):", res3.rows[0].total_qty);

        // 4. Calculate possible ratios
        const qty = res3.rows[0].total_qty;
        const count1 = res1.rows[0].count;
        const count2 = res2.rows[0].count;

        console.log(`Ratio (Qty / All Invoices): ${qty} / ${count1} = ${qty / count1}`);
        console.log(`Ratio (Qty / IV-IR Invoices): ${qty} / ${count2} = ${qty / count2}`);

        // 5. Try to find where 403 comes from
        const sql4 = `
            SELECT count(*) as row_count
            FROM sales_transactions
            WHERE location_name = 'Jacadi Palladium'
            AND DATE(invoice_date) >= DATE('2026-01-01') AND DATE(invoice_date) <= DATE('2026-01-25')
        `;
        const res4 = await db.query(sql4);
        console.log("Total Sales Transaction Rows:", res4.rows[0].row_count);

    } catch (e) {
        console.error(e);
    }
};

run();

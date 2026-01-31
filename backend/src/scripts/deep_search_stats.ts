
import db from '../config/db';

const run = async () => {
    try {
        console.log("Deep Searching for 403 and 2.64 (Palladium Jan 1-25)...");

        // 1. Qty where mh1 = 'Sales'
        const sql1 = `
            SELECT SUM(total_sales_qty) as qty
            FROM sales_transactions
            WHERE location_name = 'Jacadi Palladium'
            AND DATE(invoice_date) >= DATE('2026-01-01') AND DATE(invoice_date) <= DATE('2026-01-25')
            AND mh1_description = 'Sales'
        `;
        const res1 = await db.query(sql1);
        const salesQty = res1.rows[0].qty;
        console.log("Sales Qty (Sales Items only):", salesQty);

        // 2. Qty where mh1 = 'Sales' AND type = IV/IR
        const sql2 = `
            SELECT SUM(total_sales_qty) as qty
            FROM sales_transactions
            WHERE location_name = 'Jacadi Palladium'
            AND DATE(invoice_date) >= DATE('2026-01-01') AND DATE(invoice_date) <= DATE('2026-01-25')
            AND mh1_description = 'Sales'
            AND transaction_type IN ('IV', 'IR')
        `;
        const res2 = await db.query(sql2);
        const posSalesQty = res2.rows[0].qty;
        console.log("Pos Sales Qty (IV/IR + Sales Items):", posSalesQty);

        // 3. Transactions where mh1 = 'Sales' (Invoices with at least one sales item)
        const sql3 = `
            SELECT COUNT(DISTINCT invoice_no) as count
            FROM sales_transactions
            WHERE location_name = 'Jacadi Palladium'
            AND DATE(invoice_date) >= DATE('2026-01-01') AND DATE(invoice_date) <= DATE('2026-01-25')
            AND mh1_description = 'Sales'
            AND transaction_type IN ('IV', 'IR')
        `;
        const res3 = await db.query(sql3);
        const salesTrx = res3.rows[0].count;
        console.log("Sales TRX (IV/IR + at least one Sales item):", salesTrx);

        // 4. Invoices with ONLY sales items?
        // 5. Invoices including consumables?

        console.log(`Ratio: ${salesQty} / ${salesTrx} = ${salesQty / salesTrx}`);
        console.log(`Ratio: ${posSalesQty} / ${salesTrx} = ${posSalesQty / salesTrx}`);

        // 6. Check for 403 in ANY store
        const sql4 = `
            SELECT location_name, COUNT(DISTINCT invoice_no) as count
            FROM sales_transactions
            WHERE DATE(invoice_date) >= DATE('2026-01-01') AND DATE(invoice_date) <= DATE('2026-01-25')
            GROUP BY location_name
        `;
        const res4 = await db.query(sql4);
        console.table(res4.rows);

        // 7. Check for 403 as sum of something
        const totalTrx = res4.rows.reduce((acc: number, row: any) => acc + row.count, 0);
        console.log("Total Distinct Invoices (All Stores):", totalTrx);

        // 8. What if 403 is quantity of something?
        // What if 1064 / 403 = 2.64?
        // Let's search for 1064 or 1067 in the database outputs.

    } catch (e) {
        console.error(e);
    }
};

run();


import db from '../config/db';

const run = async () => {
    try {
        console.log("Analyzing global counts for 2026-01-01 to 2026-01-25...");

        // 1. Raw Count (IV, IR, SR, all MH1)
        const sql1 = `
            SELECT COUNT(DISTINCT invoice_no) as raw_count
            FROM sales_transactions
            WHERE 
                DATE(invoice_date) BETWEEN '2026-01-01' AND '2026-01-25'
                AND order_channel_name = 'Brick and Mortar'
        `;
        const res1 = await db.query(sql1);
        console.log("1. Brick & Mortar (Any Type, Any MH1):", res1.rows[0].raw_count);

        // 2. IV + IR + SR
        const sql2 = `
            SELECT COUNT(DISTINCT invoice_no) as count
            FROM sales_transactions
            WHERE 
                DATE(invoice_date) BETWEEN '2026-01-01' AND '2026-01-25'
                AND order_channel_name = 'Brick and Mortar'
                AND transaction_type IN ('IV', 'IR', 'SR')
        `;
        const res2 = await db.query(sql2);
        console.log("2. B&M (IV+IR+SR):", res2.rows[0].count);

        // 3. IV + IR only (Existing Filter applied?)
        const sql3 = `
            SELECT COUNT(DISTINCT invoice_no) as count
            FROM sales_transactions
            WHERE 
                DATE(invoice_date) BETWEEN '2026-01-01' AND '2026-01-25'
                AND order_channel_name = 'Brick and Mortar'
                AND transaction_type IN ('IV', 'IR')
        `;
        const res3 = await db.query(sql3);
        console.log("3. B&M (IV+IR only):", res3.rows[0].count);

        // 4. E-Commerce included?
        const sql4 = `
            SELECT COUNT(DISTINCT invoice_no) as count
            FROM sales_transactions
            WHERE 
                DATE(invoice_date) BETWEEN '2026-01-01' AND '2026-01-25'
        `;
        const res4 = await db.query(sql4);
        console.log("4. All Channels (Any Type):", res4.rows[0].count);

        // 5. Check if 436 corresponds to distinct invoices with ANY 'Sales' item?
        const sql5 = `
            SELECT COUNT(DISTINCT invoice_no) as count
            FROM sales_transactions
            WHERE 
                DATE(invoice_date) BETWEEN '2026-01-01' AND '2026-01-25'
                AND transaction_type IN ('IV', 'IR')
        `;
        const res5 = await db.query(sql5);
        console.log("5. All Channels (IV+IR):", res5.rows[0].count);

    } catch (e) {
        console.error(e);
    }
};

run();

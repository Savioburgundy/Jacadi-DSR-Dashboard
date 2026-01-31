
import db from '../config/db';

const run = async () => {
    try {
        console.log("Verifying Global Fix for '436' Issue...");

        // 1. Original (Unfiltered for MH1) -> Should be 436
        const sql1 = `
            SELECT COUNT(DISTINCT invoice_no) as original_count
            FROM sales_transactions
            WHERE 
                DATE(invoice_date) BETWEEN '2026-01-01' AND '2026-01-25'
                AND transaction_type IN ('IV', 'IR')
        `;
        const res1 = await db.query(sql1);
        console.log("Original Count (should be 436):", res1.rows[0].original_count);

        // 2. Fixed (With MH1 Filter)
        const sql2 = `
            SELECT COUNT(DISTINCT invoice_no) as fixed_count
            FROM sales_transactions
            WHERE 
                DATE(invoice_date) BETWEEN '2026-01-01' AND '2026-01-25'
                AND transaction_type IN ('IV', 'IR')
                AND mh1_description = 'Sales'
        `;
        const res2 = await db.query(sql2);
        console.log("Fixed Count (Expected < 436):", res2.rows[0].fixed_count);

        // 3. Verify Palladium Count specifically (Should be 154)
        const sql3 = `
             SELECT COUNT(DISTINCT invoice_no) as palladium_count
            FROM sales_transactions
            WHERE 
                DATE(invoice_date) BETWEEN '2026-01-01' AND '2026-01-25'
                AND transaction_type IN ('IV', 'IR')
                AND mh1_description = 'Sales'
                AND location_name LIKE '%Palladium%'
        `;
        const res3 = await db.query(sql3);
        console.log("Palladium Fixed Count (Should be 154):", res3.rows[0].palladium_count);

    } catch (e) {
        console.error(e);
    }
};

run();


import { processInvoiceCSV } from '../services/etl.service';
import db from '../config/db';
import path from 'path';

// Need to shim console.log or just run it. 
// Assuming ts-node or similar execution.

const run = async () => {
    try {
        console.log("Starting re-ingestion...");
        const filePath = String.raw`d:\Jacadi DSR\JPHO@JPinvoicedetailreport29012026034439.csv`;

        // Ensure column exists (fallback since CLI failed)
        try {
            await db.query("ALTER TABLE sales_transactions ADD COLUMN mh1_description TEXT;");
            console.log("Added column mh1_description.");
        } catch (e: any) {
            console.log("Column likely exists or error:", e.message);
        }

        await processInvoiceCSV(filePath);
        console.log("Ingestion complete.");

        // Verification Check - All Locations
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
        console.log("VERIFICATION RESULT (Jan 1-25, 'Sales' only):");
        console.table(res.rows);

    } catch (e) {
        console.error("Error:", e);
    }
};

run();

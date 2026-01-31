
import db from '../config/db';

const run = async () => {
    try {
        console.log("Verifying Whatsapp Logic Fix...");

        // 1. Count Transactions that ARE Whatsapp but channel is B&M
        const sql1 = `
            SELECT COUNT(*) as count, SUM(nett_invoice_value) as val
            FROM sales_transactions
            WHERE sales_person_name LIKE '%Whatsapp%'
            AND order_channel_name != 'E-Commerce'
        `;
        const res1 = await db.query(sql1);
        console.log("Transactions moved from Retail to Whatsapp:", res1.rows[0]);

        // 2. Simulate API Logic for MTD Whatsapp Sales
        // Check if these are captured
        const sql2 = `
            SELECT 
                SUM(CASE 
                    WHEN (order_channel_name = 'E-Commerce' OR sales_person_name LIKE '%Whatsapp%')
                    THEN nett_invoice_value ELSE 0 
                END) as MTD_WHATSAPP_SALE_NEW,

                 SUM(CASE 
                    WHEN order_channel_name = 'E-Commerce'
                    THEN nett_invoice_value ELSE 0 
                END) as MTD_WHATSAPP_SALE_OLD
            FROM sales_transactions
            WHERE DATE(invoice_date) >= DATE('2026-01-01')
        `;
        const res2 = await db.query(sql2);
        console.log("Whatsapp Sales Verification:", res2.rows[0]);

    } catch (e) {
        console.error(e);
    }
};

run();


import db from '../config/db';

const run = async () => {
    try {
        console.log("Comparing Efficiency Metrics (Excluded vs Included)...");

        const start = '2026-01-01';
        const end = '2026-01-25';
        const loc = 'Jacadi Palladium';

        // 1. Logic WITH Consumables
        const sqlWith = `
            WITH InvoiceSummary AS (
                SELECT 
                    s.invoice_no,
                    SUM(total_sales_qty) as total_qty,
                    MAX(CASE WHEN mh1_description = 'Sales' THEN 1 ELSE 0 END) as is_sales_trx
                FROM sales_transactions s
                WHERE s.location_name = ? AND DATE(s.invoice_date) >= DATE(?) AND DATE(s.invoice_date) <= DATE(?)
                GROUP BY s.invoice_no
            )
            SELECT 
                COUNT(DISTINCT CASE WHEN is_sales_trx = 1 THEN invoice_no ELSE NULL END) as trx,
                SUM(CASE WHEN is_sales_trx = 1 THEN total_qty ELSE 0 END) as qty,
                COUNT(DISTINCT CASE WHEN is_sales_trx = 1 AND total_qty > 1 THEN invoice_no ELSE NULL END) as multi_trx
            FROM InvoiceSummary
        `;
        const resWith = await db.query(sqlWith, [loc, start, end]);
        const withData = resWith.rows[0];
        console.log("WITH Consumables:");
        console.log(`- TRX: ${withData.trx}`);
        console.log(`- QTY: ${withData.qty}`);
        console.log(`- Multi TRX: ${withData.multi_trx}`);
        console.log(`- Basket Size: ${withData.qty / withData.trx}`);
        console.log(`- Multies %: ${(withData.multi_trx * 100 / withData.trx).toFixed(2)}%`);

        // 2. Logic EXCLUDING Consumables
        const sqlExcl = `
            WITH InvoiceSummary AS (
                SELECT 
                    s.invoice_no,
                    SUM(CASE WHEN mh1_description = 'Sales' THEN total_sales_qty ELSE 0 END) as total_qty,
                    MAX(CASE WHEN mh1_description = 'Sales' THEN 1 ELSE 0 END) as is_sales_trx
                FROM sales_transactions s
                WHERE s.location_name = ? AND DATE(s.invoice_date) >= DATE(?) AND DATE(s.invoice_date) <= DATE(?)
                GROUP BY s.invoice_no
            )
            SELECT 
                COUNT(DISTINCT CASE WHEN is_sales_trx = 1 THEN invoice_no ELSE NULL END) as trx,
                SUM(CASE WHEN is_sales_trx = 1 THEN total_qty ELSE 0 END) as qty,
                COUNT(DISTINCT CASE WHEN is_sales_trx = 1 AND total_qty > 1 THEN invoice_no ELSE NULL END) as multi_trx
            FROM InvoiceSummary
        `;
        const resExcl = await db.query(sqlExcl, [loc, start, end]);
        const exclData = resExcl.rows[0];
        console.log("\nEXCLUDING Consumables (New Logic):");
        console.log(`- TRX: ${exclData.trx}`);
        console.log(`- QTY: ${exclData.qty}`);
        console.log(`- Multi TRX: ${exclData.multi_trx}`);
        console.log(`- Basket Size: ${exclData.qty / exclData.trx}`);
        console.log(`- Multies %: ${(exclData.multi_trx * 100 / exclData.trx).toFixed(2)}%`);

    } catch (e) {
        console.error(e);
    }
};

run();

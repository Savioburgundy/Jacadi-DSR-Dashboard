
import db from '../config/db';

const check = async () => {
    try {
        const range = await db.query('SELECT MIN(invoice_date) as min_date, MAX(invoice_date) as max_date FROM sales_transactions');
        console.log('Date Range:', range.rows[0]);

        const locs = await db.query('SELECT DISTINCT location_name FROM sales_transactions');
        console.log('Locations:', locs.rows);

        const retail2026 = await db.query("SELECT COUNT(*) as c FROM sales_transactions WHERE invoice_date >= '2026-01-01' AND order_channel_name = 'Brick and Mortar'");
        console.log("Retail 2026:", retail2026.rows[0].c);

        const wa2026 = await db.query("SELECT COUNT(*) as c FROM sales_transactions WHERE invoice_date >= '2026-01-01' AND order_channel_name = 'E-Commerce'");
        console.log("Whatsapp 2026:", wa2026.rows[0].c);

        // Full Query Test
        const sql = `
        WITH InvoiceSummary AS (
            SELECT 
                s.location_name,
                s.invoice_no,
                s.invoice_date,
                s.order_channel_name,
                s.invoice_channel_name,
                SUM(nett_invoice_value) as total_nett
            FROM sales_transactions s
            WHERE 1=1 
            GROUP BY s.location_name, s.invoice_no, s.invoice_date, s.order_channel_name, s.invoice_channel_name
        )
        SELECT 
            location_name as Location,
            COALESCE(SUM(CASE 
                WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) 
                AND order_channel_name = 'Brick and Mortar'
                THEN total_nett ELSE 0 END), 0) as MTD_Sale
        FROM InvoiceSummary
        GROUP BY location_name
        `;

        const params = ['2026-01-01', '2026-01-10'];
        const res = await db.query(sql, params);
        console.log('Query Result:', res.rows);

        console.log('--- Invoking ETL Function ---');
        const { getRetailPerformance } = require('../services/etl.service');
        const perf = await getRetailPerformance('2026-01-10', undefined, '2026-01-01');
        console.log('ETL Result:', perf);

    } catch (e) {
        console.error(e);
    }
};

check();

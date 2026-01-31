import { Router } from 'express';
import db from '../config/db';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

// Apply Authentication
router.use(authenticateJWT);

// GET /api/analytics/trends - Sales Trend (Last 30 Days)
router.get('/trends', async (req, res) => {
    try {
        const query = `
            SELECT 
                DATE(invoice_date) as date,
                SUM(nett_invoice_value) as sales
            FROM sales_transactions
            WHERE invoice_date >= DATE('now', '-90 days')
            GROUP BY DATE(invoice_date)
            ORDER BY date ASC
        `;
        const result = await db.query(query);
        res.json(result.rows);
    } catch (error: any) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// GET /api/analytics/hourly - Hourly Heatmap (All Time or Last 30 Days)
router.get('/hourly', async (req, res) => {
    try {
        const query = `
            SELECT 
                CASE 
                    WHEN instr(invoice_time, ':') > 0 THEN substr(invoice_time, 1, 2)
                    ELSE '00' 
                END as hour,
                COUNT(DISTINCT invoice_no) as trx_count,
                SUM(nett_invoice_value) as total_sales
            FROM sales_transactions
            WHERE invoice_time IS NOT NULL AND invoice_time != ''
            GROUP BY hour
            ORDER BY hour ASC
        `;
        const result = await db.query(query);
        res.json(result.rows);
    } catch (error: any) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// GET /api/analytics/summary - KPI Cards
router.get('/summary', async (req, res) => {
    try {
        const query = `
            SELECT 
                SUM(nett_invoice_value) as total_sales,
                COUNT(DISTINCT invoice_no) as total_trx,
                SUM(total_sales_qty) as total_units
            FROM sales_transactions
        `;
        const result = await db.query(query);
        const { total_sales, total_trx, total_units } = result.rows[0];

        res.json({
            total_sales: total_sales || 0,
            total_trx: total_trx || 0,
            atv: total_trx > 0 ? Math.round(total_sales / total_trx) : 0,
            upt: total_trx > 0 ? (total_units / total_trx).toFixed(2) : 0
        });
    } catch (error: any) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// GET /api/analytics/channel-split - Pie Chart
router.get('/channel-split', async (req, res) => {
    try {
        const query = `
            SELECT 
                COALESCE(order_channel_name, 'Unknown') as name,
                SUM(nett_invoice_value) as value
            FROM sales_transactions
            GROUP BY order_channel_name
            ORDER BY value DESC
        `;
        const result = await db.query(query);
        res.json(result.rows);
    } catch (error: any) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// GET /api/analytics/store-performance - Bar Chart
router.get('/store-performance', async (req, res) => {
    try {
        const query = `
            SELECT 
                location_name as name,
                SUM(nett_invoice_value) as sales,
                COUNT(DISTINCT invoice_no) as trx
            FROM sales_transactions
            GROUP BY location_name
            ORDER BY sales DESC
        `;
        const result = await db.query(query);
        res.json(result.rows);
    } catch (error: any) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});



export default router;

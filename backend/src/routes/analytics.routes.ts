import { Router } from 'express';
import { getCollection } from '../config/mongodb';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

// Apply Authentication
router.use(authenticateJWT);

// GET /api/analytics/trends - Sales Trend (Last 90 Days)
router.get('/trends', async (req, res) => {
    try {
        const salesTx = getCollection('sales_transactions');
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        
        const result = await salesTx.aggregate([
            { $match: { invoice_date: { $gte: ninetyDaysAgo.toISOString().split('T')[0] } } },
            { 
                $group: {
                    _id: '$invoice_date',
                    sales: { $sum: '$nett_invoice_value' }
                }
            },
            { $sort: { _id: 1 } },
            { $project: { date: '$_id', sales: 1, _id: 0 } }
        ]).toArray();
        
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// GET /api/analytics/hourly - Hourly Heatmap
router.get('/hourly', async (req, res) => {
    try {
        const salesTx = getCollection('sales_transactions');
        
        const result = await salesTx.aggregate([
            { $match: { invoice_time: { $exists: true, $ne: '' } } },
            {
                $addFields: {
                    hour: { $substr: ['$invoice_time', 0, 2] }
                }
            },
            {
                $group: {
                    _id: '$hour',
                    trx_count: { $addToSet: '$invoice_no' },
                    total_sales: { $sum: '$nett_invoice_value' }
                }
            },
            {
                $project: {
                    hour: '$_id',
                    trx_count: { $size: '$trx_count' },
                    total_sales: 1,
                    _id: 0
                }
            },
            { $sort: { hour: 1 } }
        ]).toArray();
        
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// GET /api/analytics/summary - KPI Cards
router.get('/summary', async (req, res) => {
    try {
        const salesTx = getCollection('sales_transactions');
        
        const result = await salesTx.aggregate([
            {
                $group: {
                    _id: null,
                    total_sales: { $sum: '$nett_invoice_value' },
                    unique_invoices: { $addToSet: '$invoice_no' },
                    total_units: { $sum: '$total_sales_qty' }
                }
            },
            {
                $project: {
                    total_sales: 1,
                    total_trx: { $size: '$unique_invoices' },
                    total_units: 1,
                    _id: 0
                }
            }
        ]).toArray();
        
        const data = result[0] || { total_sales: 0, total_trx: 0, total_units: 0 };

        res.json({
            total_sales: data.total_sales || 0,
            total_trx: data.total_trx || 0,
            atv: data.total_trx > 0 ? Math.round(data.total_sales / data.total_trx) : 0,
            upt: data.total_trx > 0 ? (data.total_units / data.total_trx).toFixed(2) : '0'
        });
    } catch (error: any) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// GET /api/analytics/channel-split - Pie Chart
router.get('/channel-split', async (req, res) => {
    try {
        const salesTx = getCollection('sales_transactions');
        
        const result = await salesTx.aggregate([
            {
                $group: {
                    _id: { $ifNull: ['$order_channel_name', 'Unknown'] },
                    value: { $sum: '$nett_invoice_value' }
                }
            },
            { $sort: { value: -1 } },
            { $project: { name: '$_id', value: 1, _id: 0 } }
        ]).toArray();
        
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// GET /api/analytics/store-performance - Bar Chart
router.get('/store-performance', async (req, res) => {
    try {
        const salesTx = getCollection('sales_transactions');
        
        const result = await salesTx.aggregate([
            {
                $group: {
                    _id: '$location_name',
                    sales: { $sum: '$nett_invoice_value' },
                    unique_invoices: { $addToSet: '$invoice_no' }
                }
            },
            {
                $project: {
                    name: '$_id',
                    sales: 1,
                    trx: { $size: '$unique_invoices' },
                    _id: 0
                }
            },
            { $sort: { sales: -1 } }
        ]).toArray();
        
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

export default router;

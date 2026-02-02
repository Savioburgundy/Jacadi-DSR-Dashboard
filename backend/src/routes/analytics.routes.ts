import { Router } from 'express';
import { getCollection } from '../config/mongodb';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

// Apply Authentication
router.use(authenticateJWT);

// Helper to build date filter
const buildDateFilter = (startDate?: string, endDate?: string) => {
    const filter: any = {};
    if (startDate && endDate) {
        filter.invoice_date = { $gte: startDate, $lte: endDate };
    } else if (startDate) {
        filter.invoice_date = { $gte: startDate };
    } else if (endDate) {
        filter.invoice_date = { $lte: endDate };
    }
    return filter;
};

// GET /api/analytics/trends - Sales Trend
router.get('/trends', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const salesTx = getCollection('sales_transactions');
        
        const dateFilter = buildDateFilter(startDate as string, endDate as string);
        
        const result = await salesTx.aggregate([
            { $match: dateFilter },
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
        const { startDate, endDate } = req.query;
        const salesTx = getCollection('sales_transactions');
        
        const dateFilter = buildDateFilter(startDate as string, endDate as string);
        dateFilter.invoice_time = { $exists: true, $ne: '' };
        // Only count actual sales transactions (IV, IR) with mh1_description = 'Sales'
        dateFilter.transaction_type = { $in: ['IV', 'IR'] };
        dateFilter.mh1_description = 'Sales';
        
        const result = await salesTx.aggregate([
            { $match: dateFilter },
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

// GET /api/analytics/summary - KPI Cards (matching main dashboard logic)
router.get('/summary', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const salesTx = getCollection('sales_transactions');
        
        const dateFilter = buildDateFilter(startDate as string, endDate as string);
        
        // Use the same logic as main dashboard KPI cards
        // Transactions: Only count invoices where transaction_type IN ('IV', 'IR') AND mh1_description = 'Sales'
        // Revenue: Sum all nett_invoice_value (includes returns for net calculation)
        // Units: Sum total_sales_qty for actual sales only
        
        const result = await salesTx.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: null,
                    // Total revenue is the sum of all (net of returns)
                    total_sales: { $sum: '$nett_invoice_value' },
                    // Only count unique invoices that are actual sales (IV or IR) with mh1_description = 'Sales'
                    unique_invoices: { 
                        $addToSet: { 
                            $cond: [
                                { 
                                    $and: [
                                        { $in: ['$transaction_type', ['IV', 'IR']] }, 
                                        { $eq: ['$mh1_description', 'Sales'] }
                                    ] 
                                }, 
                                '$invoice_no', 
                                null
                            ] 
                        } 
                    },
                    // Sum units only for sales transactions
                    total_units: { 
                        $sum: { 
                            $cond: [
                                { 
                                    $and: [
                                        { $in: ['$transaction_type', ['IV', 'IR']] }, 
                                        { $eq: ['$mh1_description', 'Sales'] }
                                    ] 
                                }, 
                                '$total_sales_qty', 
                                0
                            ] 
                        } 
                    }
                }
            },
            {
                $project: {
                    total_sales: 1,
                    // Filter out null values from unique_invoices
                    unique_invoices: {
                        $filter: {
                            input: '$unique_invoices',
                            as: 'inv',
                            cond: { $ne: ['$$inv', null] }
                        }
                    },
                    total_units: 1,
                    _id: 0
                }
            }
        ]).toArray();
        
        const data = result[0] || { total_sales: 0, unique_invoices: [], total_units: 0 };
        const total_trx = data.unique_invoices ? data.unique_invoices.length : 0;
        const total_sales = data.total_sales || 0;
        const total_units = data.total_units || 0;

        res.json({
            total_sales: total_sales,
            total_trx: total_trx,
            atv: total_trx > 0 ? Math.round(total_sales / total_trx) : 0,
            upt: total_trx > 0 ? parseFloat((total_units / total_trx).toFixed(2)) : 0
        });
    } catch (error: any) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// GET /api/analytics/channel-split - Pie Chart
router.get('/channel-split', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const salesTx = getCollection('sales_transactions');
        
        const dateFilter = buildDateFilter(startDate as string, endDate as string);
        
        const result = await salesTx.aggregate([
            { $match: dateFilter },
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
        const { startDate, endDate } = req.query;
        const salesTx = getCollection('sales_transactions');
        
        const dateFilter = buildDateFilter(startDate as string, endDate as string);
        
        const result = await salesTx.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: '$location_name',
                    sales: { $sum: '$nett_invoice_value' },
                    // Only count unique invoices that are actual sales
                    unique_invoices: { 
                        $addToSet: { 
                            $cond: [
                                { 
                                    $and: [
                                        { $in: ['$transaction_type', ['IV', 'IR']] }, 
                                        { $eq: ['$mh1_description', 'Sales'] }
                                    ] 
                                }, 
                                '$invoice_no', 
                                null
                            ] 
                        } 
                    }
                }
            },
            {
                $project: {
                    name: '$_id',
                    sales: 1,
                    trx: { 
                        $size: {
                            $filter: {
                                input: '$unique_invoices',
                                as: 'inv',
                                cond: { $ne: ['$$inv', null] }
                            }
                        }
                    },
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

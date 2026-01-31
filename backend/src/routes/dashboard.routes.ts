import { Router } from 'express';
import {
    getRetailPerformance,
    getWhatsappSalesBreakdown,
    getOmniChannelTmLm,
    getOmniChannelDetails,
    getDashboardSummary,
    getLocations,
    getBrands,
    getCategories,
    getRetailEfficiency,
    getRetailOmniTotal,
    getLatestInvoiceDate
} from '../services/etl.service';

import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

// Apply Authentication to ALL dashboard routes
router.use(authenticateJWT);

// Get latest available date
router.get('/latest-date', async (req, res) => {
    try {
        const date = await getLatestInvoiceDate();
        res.json({ date });
    } catch (error: any) {
        console.error('Error fetching latest date:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

const getBaseParams = (req: any) => {
    // Check if we have a range or single date
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string || req.query.date as string || new Date().toISOString().split('T')[0];

    const parseQueryParam = (val: any): string[] | undefined => {
        if (!val) return undefined;
        if (Array.isArray(val)) return val as string[];
        return (val as string).split(',').filter(s => s.trim() !== '');
    };

    return {
        startDate,
        endDate,
        location: parseQueryParam(req.query.location),
        brand: parseQueryParam(req.query.brand),
        category: parseQueryParam(req.query.category)
    };
};

// Get unique locations (optionally filtered by brand)
router.get('/:id/locations', async (req, res) => {
    try {
        const brand = (req.query.brand as string)?.split(',').filter(Boolean);
        const data = await getLocations(brand);
        res.json(data);
    } catch (error: any) {
        console.error('Error fetching locations:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get all unique brands
router.get('/:id/brands', async (req, res) => {
    try {
        const data = await getBrands();
        res.json(data);
    } catch (error: any) {
        console.error('Error fetching brands:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get unique categories (optionally filtered by brand/location)
router.get('/:id/categories', async (req, res) => {
    try {
        const brand = (req.query.brand as string)?.split(',').filter(Boolean);
        const location = (req.query.location as string)?.split(',').filter(Boolean);
        const data = await getCategories(brand, location);
        res.json(data);
    } catch (error: any) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get retail efficiency metrics (Conversion, ATV, Footfall, etc)
router.get('/:id/retail-efficiency', async (req, res) => {
    try {
        const { startDate, endDate, location, brand, category } = getBaseParams(req);
        const data = await getRetailEfficiency(endDate, location, startDate, brand, category);
        res.json(data);
    } catch (error: any) {
        console.error('Error fetching retail efficiency data:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get (Retail + Whatsapp) performance table data
router.get('/:id/retail-performance', async (req, res) => {
    try {
        const { startDate, endDate, location, brand, category } = getBaseParams(req);
        const data = await getRetailPerformance(endDate, location, startDate, brand, category);
        res.json(data);
    } catch (error: any) {
        console.error('Error fetching retail performance data:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Alias for frontend compatibility
router.get('/:id/retail-whatsapp', async (req, res) => {
    try {
        const { startDate, endDate, location, brand, category } = getBaseParams(req);
        const data = await getRetailPerformance(endDate, location, startDate, brand, category);
        res.json(data);
    } catch (error: any) {
        console.error('Error fetching retail whatsapp data:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get whatsapp sales breakdown
router.get('/:id/whatsapp-sales-breakdown', async (req, res) => {
    try {
        const { startDate, endDate, location, brand, category } = getBaseParams(req);
        const data = await getWhatsappSalesBreakdown(endDate, location, startDate, brand, category);
        res.json(data);
    } catch (error: any) {
        console.error('Error fetching whatsapp sales data:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get omni channel TM vs LM
router.get('/:id/omni-channel-tm-lm', async (req, res) => {
    try {
        const { startDate, endDate, location, brand, category } = getBaseParams(req);
        const data = await getOmniChannelTmLm(endDate, location, startDate, brand, category);
        res.json(data);
    } catch (error: any) {
        console.error('Error fetching omni channel TM vs LM data:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get omni channel details
router.get('/:id/omni-channel-details', async (req, res) => {
    try {
        const { startDate, endDate, location, brand, category } = getBaseParams(req);
        const data = await getOmniChannelDetails(endDate, location, startDate, brand, category);
        res.json(data);
    } catch (error: any) {
        console.error('Error fetching omni channel details:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get Retail + Omni total view
router.get('/:id/retail-omni-total', async (req, res) => {
    try {
        const { startDate, endDate, location, brand, category } = getBaseParams(req);
        const data = await getRetailOmniTotal(endDate, location, startDate, brand, category);
        res.json(data);
    } catch (error: any) {
        console.error('Error fetching retail omni total:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get dashboard summary metrics
router.get('/:id/summary', async (req, res) => {
    try {
        const { startDate, endDate, location, brand, category } = getBaseParams(req);
        const data = await getDashboardSummary(endDate, location, startDate, brand, category);
        res.json(data);
    } catch (error: any) {
        console.error('Error fetching dashboard summary:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

export default router;

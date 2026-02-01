import { Router } from 'express';
import { authenticateJWT, authorizeRole } from '../middleware/auth.middleware';
import { runDailyAutomation } from '../services/scheduler.service';
import { getCollection } from '../config/mongodb';
import { processInvoiceCSV, processFootfallCSV } from '../services/etl.service';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Configure multer for file uploads
const uploadDir = process.env.DATA_INPUT_DIR || path.join(__dirname, '../../data_input');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        cb(null, `manual_${timestamp}_${file.originalname}`);
    }
});

const upload = multer({ 
    storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are allowed'));
        }
    },
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// This endpoint is used by the "Sync Data" button in the dashboard
// PROTECTED: Only Admin can trigger manual ingestion via API
router.post('/run', authenticateJWT, authorizeRole(['admin']), async (req, res) => {
    try {
        await runDailyAutomation();
        res.json({ message: 'Daily automation (Backup, Download, Ingest) completed successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Ingestion failed', error: (error as Error).message });
    }
});

router.get('/logs', authenticateJWT, authorizeRole(['admin']), async (req, res) => {
    try {
        const logs = getCollection('ingestion_logs');
        const result = await logs.find({})
            .sort({ created_at: -1 })
            .limit(50)
            .toArray();
        
        // Transform for frontend compatibility
        const transformed = result.map(log => ({
            id: log._id.toString(),
            filename: log.filename,
            status: log.status,
            rows_added: log.rows_added,
            error_message: log.error_message,
            created_at: log.created_at
        }));
        
        res.json(transformed);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Trigger Automated Report Download (Admin Only)
router.post('/download', authenticateJWT, authorizeRole(['admin']), async (req, res) => {
    try {
        const { downloadJacadiReport } = await import('../services/ingestion.service');
        await downloadJacadiReport();
        res.json({ message: 'Download initiated successfully. Check server logs for progress.' });
    } catch (error) {
        res.status(500).json({ message: 'Download failed', error: (error as Error).message });
    }
});

export default router;

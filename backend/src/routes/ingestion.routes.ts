import { Router } from 'express';
import { authenticateJWT, authorizeRole } from '../middleware/auth.middleware';
import { runDailyAutomation } from '../services/scheduler.service';
import db from '../config/db';

const router = Router();

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
        const result = await db.query('SELECT * FROM ingestion_logs ORDER BY ingested_at DESC LIMIT 50');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Trigger Automated Report Download (Admin Only)
router.post('/download', authenticateJWT, authorizeRole(['admin']), async (req, res) => {
    try {
        // Dynamic import to avoid circular dependency if any, though explicit import is fine too
        const { downloadJacadiReport } = await import('../services/ingestion.service');
        await downloadJacadiReport();
        res.json({ message: 'Download initiated successfully. Check server logs for progress.' });
    } catch (error) {
        res.status(500).json({ message: 'Download failed', error: (error as Error).message });
    }
});

export default router;

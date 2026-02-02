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
        const transformed = result.map((log: any) => ({
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

// Manual Upload: Invoice Details Report (Admin Only)
router.post('/upload/invoice', authenticateJWT, authorizeRole(['admin']), upload.single('file'), async (req, res) => {
    const logsCollection = getCollection('ingestion_logs');
    
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const filename = req.file.filename;

    try {
        console.log(`📤 Manual upload: Processing invoice file ${filename}`);
        
        // Process the uploaded CSV
        const rowCount = await processInvoiceCSV(filePath);
        
        // Log success
        await logsCollection.insertOne({
            filename: `[MANUAL] ${filename}`,
            status: 'success',
            rows_added: rowCount,
            created_at: new Date()
        } as any);

        // Move to archive
        const archiveDir = process.env.DATA_ARCHIVE_DIR || path.join(__dirname, '../../data_archive');
        if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });
        const archivePath = path.join(archiveDir, filename);
        fs.renameSync(filePath, archivePath);

        console.log(`✅ Manual upload successful: ${rowCount} invoice records processed`);
        res.json({ 
            message: 'Invoice file processed successfully', 
            rows_added: rowCount,
            filename: filename
        });
    } catch (error) {
        console.error(`❌ Manual upload failed:`, error);
        
        // Log failure
        await logsCollection.insertOne({
            filename: `[MANUAL] ${filename}`,
            status: 'failed',
            error_message: (error as Error).message,
            created_at: new Date()
        } as any);

        // Clean up file on error
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        res.status(500).json({ message: 'Failed to process invoice file', error: (error as Error).message });
    }
});

// Manual Upload: Footfall Report (Admin Only)
router.post('/upload/footfall', authenticateJWT, authorizeRole(['admin']), upload.single('file'), async (req, res) => {
    const logsCollection = getCollection('ingestion_logs');
    
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const filename = req.file.filename;

    try {
        console.log(`📤 Manual upload: Processing footfall file ${filename}`);
        
        // Process the uploaded CSV
        const rowCount = await processFootfallCSV(filePath);
        
        // Log success
        await logsCollection.insertOne({
            filename: `[MANUAL-FOOTFALL] ${filename}`,
            status: 'success',
            rows_added: rowCount,
            created_at: new Date()
        } as any);

        // Move to archive
        const archiveDir = process.env.DATA_ARCHIVE_DIR || path.join(__dirname, '../../data_archive');
        if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });
        const archivePath = path.join(archiveDir, filename);
        fs.renameSync(filePath, archivePath);

        console.log(`✅ Manual upload successful: ${rowCount} footfall records processed`);
        res.json({ 
            message: 'Footfall file processed successfully', 
            rows_added: rowCount,
            filename: filename
        });
    } catch (error) {
        console.error(`❌ Manual footfall upload failed:`, error);
        
        // Log failure
        await logsCollection.insertOne({
            filename: `[MANUAL-FOOTFALL] ${filename}`,
            status: 'failed',
            error_message: (error as Error).message,
            created_at: new Date()
        } as any);

        // Clean up file on error
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        res.status(500).json({ message: 'Failed to process footfall file', error: (error as Error).message });
    }
});

// Automated Download: Footfall Report from Surecount (Admin Only)
router.post('/download/footfall', authenticateJWT, authorizeRole(['admin']), async (req, res) => {
    try {
        const { downloadFootfallReport } = await import('../services/ingestion.service');
        await downloadFootfallReport();
        res.json({ message: 'Footfall download initiated successfully. Check server logs for progress.' });
    } catch (error) {
        res.status(500).json({ message: 'Footfall download failed', error: (error as Error).message });
    }
});

// Combined Sync: Download and Ingest Footfall (Admin Only)
router.post('/sync/footfall', authenticateJWT, authorizeRole(['admin']), async (req, res) => {
    const logsCollection = getCollection('ingestion_logs');
    
    try {
        console.log('🚀 Starting Footfall Sync from Surecount...');
        
        // 1. Download footfall report
        const { downloadFootfallReport } = await import('../services/ingestion.service');
        await downloadFootfallReport();
        console.log('✅ Footfall report downloaded');
        
        // 2. Process any new footfall files in data_input
        const inputDir = process.env.DATA_INPUT_DIR || path.join(__dirname, '../../data_input');
        const files = fs.readdirSync(inputDir).filter(f => 
            f.toLowerCase().includes('footfall') && f.toLowerCase().endsWith('.csv')
        );
        
        let totalRows = 0;
        for (const file of files) {
            const filePath = path.join(inputDir, file);
            const rowCount = await processFootfallCSV(filePath);
            totalRows += rowCount;
            
            // Log success
            await logsCollection.insertOne({
                filename: `[AUTO-FOOTFALL] ${file}`,
                status: 'success',
                rows_added: rowCount,
                created_at: new Date()
            } as any);
            
            // Archive file
            const archiveDir = process.env.DATA_ARCHIVE_DIR || path.join(__dirname, '../../data_archive');
            if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });
            fs.renameSync(filePath, path.join(archiveDir, file));
        }
        
        res.json({ 
            message: 'Footfall sync completed successfully', 
            files_processed: files.length,
            rows_added: totalRows 
        });
    } catch (error) {
        console.error('❌ Footfall sync failed:', error);
        
        await logsCollection.insertOne({
            filename: '[AUTO-FOOTFALL] Sync Failed',
            status: 'failed',
            error_message: (error as Error).message,
            created_at: new Date()
        } as any);
        
        res.status(500).json({ message: 'Footfall sync failed', error: (error as Error).message });
    }
});

// GET /api/ingestion/export-db - Export entire database (Admin only)
router.get('/export-db', authenticateJWT, authorizeRole('admin'), async (req, res) => {
    try {
        const { collection } = req.query;
        
        // If specific collection requested
        if (collection && typeof collection === 'string') {
            const coll = getCollection(collection);
            const data = await coll.find({}, { projection: { _id: 0 } }).toArray();
            
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="${collection}_${new Date().toISOString().split('T')[0]}.json"`);
            return res.json(data);
        }
        
        // Export all collections
        const salesTx = getCollection('sales_transactions');
        const footfall = getCollection('footfall');
        const users = getCollection('users');
        const logs = getCollection('ingestion_logs');
        
        const [salesData, footfallData, usersData, logsData] = await Promise.all([
            salesTx.find({}, { projection: { _id: 0 } }).toArray(),
            footfall.find({}, { projection: { _id: 0 } }).toArray(),
            users.find({}, { projection: { _id: 0, password_hash: 0 } }).toArray(),
            logs.find({}, { projection: { _id: 0 } }).toArray()
        ]);
        
        const exportData = {
            exported_at: new Date().toISOString(),
            database: 'jacadi_dsr',
            collections: {
                sales_transactions: {
                    count: salesData.length,
                    data: salesData
                },
                footfall: {
                    count: footfallData.length,
                    data: footfallData
                },
                users: {
                    count: usersData.length,
                    data: usersData
                },
                ingestion_logs: {
                    count: logsData.length,
                    data: logsData
                }
            }
        };
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="jacadi_dsr_full_export_${new Date().toISOString().split('T')[0]}.json"`);
        res.json(exportData);
    } catch (error) {
        console.error('❌ Database export failed:', error);
        res.status(500).json({ message: 'Database export failed', error: (error as Error).message });
    }
});

// GET /api/ingestion/export-csv/:collection - Export collection as CSV (Admin only)
router.get('/export-csv/:collection', authenticateJWT, authorizeRole('admin'), async (req, res) => {
    try {
        const { collection } = req.params;
        const validCollections = ['sales_transactions', 'footfall', 'users', 'ingestion_logs'];
        
        if (!validCollections.includes(collection)) {
            return res.status(400).json({ message: 'Invalid collection name' });
        }
        
        const coll = getCollection(collection);
        const projection: any = { _id: 0 };
        if (collection === 'users') {
            projection.password_hash = 0;
        }
        
        const data = await coll.find({}, { projection }).toArray();
        
        if (data.length === 0) {
            return res.status(404).json({ message: 'No data found in collection' });
        }
        
        // Convert to CSV
        const headers = Object.keys(data[0]);
        const csvRows = [
            headers.join(','),
            ...data.map(row => 
                headers.map(header => {
                    const value = row[header];
                    if (value === null || value === undefined) return '';
                    if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                        return `"${value.replace(/"/g, '""')}"`;
                    }
                    return value;
                }).join(',')
            )
        ];
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${collection}_${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csvRows.join('\n'));
    } catch (error) {
        console.error('❌ CSV export failed:', error);
        res.status(500).json({ message: 'CSV export failed', error: (error as Error).message });
    }
});

export default router;

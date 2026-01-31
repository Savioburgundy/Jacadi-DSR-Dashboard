import { runDailyAutomation } from '../services/scheduler.service';
import db from '../config/db';
import dotenv from 'dotenv';

dotenv.config();

const main = async () => {
    console.log('🔄 Starting Unified Daily Automation (Backup -> Download -> Ingest)...');

    try {
        // This runs the full robust pipeline: 
        // 1. Create Restore Point
        // 2. Download from Olabi
        // 3. Process CSV
        await runDailyAutomation();

        console.log('✅ Ingestion process finished.');
        // Allow time for async logs to flush if any
        setTimeout(() => process.exit(0), 1000);
    } catch (error: any) {
        console.error('❌ Ingestion failed:', error.message);
        process.exit(1);
    }
};

main();

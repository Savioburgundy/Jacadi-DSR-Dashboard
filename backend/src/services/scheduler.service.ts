import { downloadJacadiReport, runIngestion } from './ingestion.service';
import { createRestorePoint } from './backup.service';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Unified Daily Automation Task
 * 1. Create Restore Point (Local Backup)
 * 2. Download Daily Report from Olabi Portal (Playwright)
 * 3. Process Downloaded CSV into Database (ETL)
 */
export const runDailyAutomation = async (targetDate?: string) => {
    console.log(`[${new Date().toISOString()}] 🔄 Starting Unified Daily Automation...`);

    try {
        // Step 1: Backup
        console.log('Step 1: Creating local restore point...');
        await createRestorePoint();

        // Step 2: Download
        console.log(`Step 2: Downloading report${targetDate ? ` for ${targetDate}` : '...'} `);
        // Note: downloadJacadiReport triggers a python script using 'exec'
        // We can pass a date argument if we update the service to accept it.
        await downloadJacadiReport();

        // Step 3: Ingest
        console.log('Step 3: Processing downloaded files...');
        await runIngestion();

        console.log('✅ Daily Automation Task Completed Successfully.');
    } catch (error: any) {
        console.error('❌ Daily Automation Task Failed:', error.message);
        throw error;
    }
};

// If using node-cron for scheduling within the app (TBD if user wants persistent server-side cron)
import cron from 'node-cron';

export const initScheduler = () => {
    // Schedule for 6:00 AM daily
    cron.schedule('0 6 * * *', async () => {
        console.log('⏰ Scheduled Task Triggered: 6:00 AM Daily Ingestion');
        try {
            await runDailyAutomation();
        } catch (e) {
            console.error('FAILED TO RUN SCHEDULED INGESTION:', e);
        }
    });
    console.log('✅ Daily Ingestion Scheduler Initialized (6:00 AM)');
};

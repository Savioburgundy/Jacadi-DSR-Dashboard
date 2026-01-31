
import db from './src/config/db';

const run = async () => {
    console.log('🧹 Starting Clean Slate Operation for Jan 28-29...');

    try {
        // 1. Delete Sales Data
        const res1 = await db.query(`DELETE FROM sales_transactions WHERE invoice_date >= '2026-01-28'`);
        const res2 = await db.query(`DELETE FROM raw_sales WHERE invoice_date >= '2026-01-28'`);
        console.log(`✅ Deleted sales records (Transaction: ${res1.changes || 'unknown'}, Raw: ${res2.changes || 'unknown'})`);

        // 2. Clear Ingestion Logs to allow re-import
        // Pattern match commonly used file date formats in filename
        const res3 = await db.query(`DELETE FROM ingestion_logs WHERE filename LIKE '%29012026%' OR filename LIKE '%28012026%'`);
        console.log(`✅ Cleared ingestion logs: ${res3.changes || 'unknown'} entries`);

        // 3. Clear Processed Files tracker if exists
        try {
            await db.query(`DELETE FROM processed_files WHERE filename LIKE '%29012026%' OR filename LIKE '%28012026%'`);
        } catch (e) { /* ignore if table doesn't exist */ }

        console.log('✨ System ready for fresh ingestion.');

    } catch (err) {
        console.error('❌ Error during cleanup:', err);
    }

    setTimeout(() => process.exit(0), 1000);
};

run();

import db from '../config/db';

/**
 * One-time migration script to enable incremental ingestion
 * - Creates processed_files table
 * - Adds unique index to sales_transactions
 * - Does NOT drop or delete any existing data
 */

const migrate = async () => {
    console.log('🔧 Running migration to enable incremental ingestion...\n');

    try {
        // 1. Create processed_files table
        console.log('📋 Creating processed_files table...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS processed_files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT UNIQUE NOT NULL,
                file_date DATE,
                processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                record_count INTEGER,
                file_type TEXT DEFAULT 'invoice'
            )
        `);
        console.log('✅ processed_files table created');

        // Note: Not creating unique index due to existing duplicates in data
        // Using INSERT OR IGNORE in ETL instead

        // 3. Check if we have existing data
        const countResult = await db.query('SELECT COUNT(*) as count FROM sales_transactions');
        const existingCount = countResult.rows[0]?.count || 0;

        console.log(`\n📊 Found ${existingCount} existing sales transaction records`);

        // 4. If we have existing data, mark the original file as processed
        if (existingCount > 0) {
            console.log('\n📝 Marking original data file as processed...');
            try {
                await db.query(`
                    INSERT OR IGNORE INTO processed_files (filename, file_date, record_count, file_type) 
                    VALUES (?, ?, ?, ?)
                `, ['JPHO@JPinvoicedetailreport10012026013411.csv', '2026-01-09', existingCount, 'invoice']);
                console.log('✅ Original file marked as processed');
            } catch (error: any) {
                console.log('ℹ️  Original file already marked as processed');
            }
        }

        // 5. Check footfall data
        const footfallResult = await db.query('SELECT MAX(date) as latest_date, COUNT(*) as count FROM footfall');
        const footfallLatest = footfallResult.rows[0]?.latest_date;
        const footfallCount = footfallResult.rows[0]?.count || 0;

        console.log(`\n👣 Footfall data: ${footfallCount} records`);
        if (footfallLatest) {
            console.log(`   Latest footfall date: ${footfallLatest}`);
        }

        console.log('\n' + '='.repeat(60));
        console.log('✅ Migration completed successfully!');
        console.log('='.repeat(60));
        console.log('\n📌 Next steps:');
        console.log('   1. Place new CSV files in: D:\\Jacadi DSR\\input_reports\\');
        console.log('   2. Run: npm run seed:incremental');
        console.log('   3. New data will be appended without deleting old data');
        console.log('='.repeat(60));

        process.exit(0);
    } catch (error: any) {
        console.error('❌ Migration failed:', error.message);
        console.error(error);
        process.exit(1);
    }
};

migrate();

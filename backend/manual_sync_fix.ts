
import fs from 'fs';
import path from 'path';
import db from './src/config/db';
import { processInvoiceCSV } from './src/services/etl.service';

const DATA_INPUT = 'd:\\Jacadi DSR\\data_archive';

const run = async () => {
    console.log('🚑 Starting Manual Recovery Sync...');

    const files = fs.readdirSync(DATA_INPUT).filter(f => f.endsWith('.csv'));
    if (files.length === 0) {
        console.error('❌ No files in data_input!');
        process.exit(1);
    }

    const file = files[0];
    const filePath = path.join(DATA_INPUT, file);
    console.log(`Processing: ${file}`);

    try {
        // processInvoiceCSV now has the Smart Deduplication logic built-in
        // We call it directly, so we run the NEW code, regardless of what the server has loaded in memory.
        const count = await processInvoiceCSV(filePath);
        console.log(`✅ Success! Processed ${count} records.`);
    } catch (err) {
        console.error('❌ Failed:', err);
    }

    setTimeout(() => process.exit(0), 1000);
};

run();

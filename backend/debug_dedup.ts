
import fs from 'fs';
import csv from 'csv-parser';
import db from './src/config/db';

const filePath = 'd:\\Jacadi DSR\\data_input\\JPHO@JPinvoicedetailreport29012026101035.csv';

const parseInvoiceDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        const [day, month, year] = parts;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    // Fallback for YYYY-MM-DD or other
    return dateStr;
};

const run = async () => {
    console.log('🔍 Debugging Deduplication Logic...');

    if (!fs.existsSync(filePath)) {
        console.error('❌ File not found:', filePath);
        return;
    }

    // 1. Check DB Counts
    console.log('\n📊 Current DB Counts (Top 5 Dates):');
    const counts = await db.query(`SELECT invoice_date, count(*) as c FROM sales_transactions GROUP BY invoice_date ORDER BY invoice_date DESC LIMIT 5`);
    console.log(counts.rows);

    // 2. Scan File
    console.log('\n📂 Scanning File for Dates...');
    const dates = new Set<string>();
    await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row: any) => {
                const d = parseInvoiceDate(row['Invoice Date']);
                if (d && d.startsWith('202')) dates.add(d); // Basic filter
            })
            .on('end', resolve)
            .on('error', reject);
    });

    const sortedDates = [...dates].sort();
    console.log('Found Dates:', sortedDates);

    if (sortedDates.length > 0) {
        const min = sortedDates[0];
        const max = sortedDates[sortedDates.length - 1];
        console.log(`\n✅ Logic SHOULD run: DELETE FROM sales_transactions WHERE invoice_date >= '${min}' AND invoice_date <= '${max}'`);
    } else {
        console.error('❌ No dates found in file! Header mismatch?');
    }

    process.exit(0);
};

run();

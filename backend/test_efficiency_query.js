const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data.db');
const db = new sqlite3.Database(dbPath);

console.log('=== TESTING RETAIL EFFICIENCY QUERY ===\n');

const startDate = '2026-01-01';
const endDate = '2026-01-10';

// Simplified test query to check footfall join
const testQuery = `
    SELECT 
        s.location_name,
        COUNT(DISTINCT s.invoice_no) as MTD_TRX,
        (SELECT COALESCE(SUM(footfall_count), 0) 
         FROM footfall f 
         WHERE f.location_name = s.location_name 
         AND DATE(f.date) >= DATE(?) 
         AND DATE(f.date) <= DATE(?)) as MTD_FOOTFALL
    FROM sales_transactions s
    WHERE DATE(s.invoice_date) >= DATE(?) 
    AND DATE(s.invoice_date) <= DATE(?)
    AND s.nett_invoice_value > 0
    GROUP BY s.location_name
`;

console.log(`Testing query for date range: ${startDate} to ${endDate}\n`);

db.all(testQuery, [startDate, endDate, startDate, endDate], (err, rows) => {
    if (err) {
        console.error('Error executing query:', err);
        db.close();
        return;
    }

    console.log('Results:');
    rows.forEach(row => {
        const conversion = row.MTD_FOOTFALL > 0 ? (row.MTD_TRX / row.MTD_FOOTFALL * 100).toFixed(2) : 0;
        console.log(`\n${row.location_name}:`);
        console.log(`  MTD Transactions: ${row.MTD_TRX}`);
        console.log(`  MTD Footfall: ${row.MTD_FOOTFALL}`);
        console.log(`  MTD Conversion %: ${conversion}%`);
    });

    db.close();
});

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data.db');
const db = new sqlite3.Database(dbPath);

console.log('=== FOOTFALL DATA VERIFICATION ===\n');

// Check if footfall table exists
db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='footfall'", (err, row) => {
    if (err) {
        console.error('Error checking footfall table:', err);
        db.close();
        return;
    }

    if (!row) {
        console.log('❌ Footfall table does NOT exist in database');
        db.close();
        return;
    }

    console.log('✓ Footfall table exists');

    // Check total footfall records
    db.get('SELECT COUNT(*) as count FROM footfall', (err, row) => {
        if (err) {
            console.error('Error counting footfall records:', err);
        } else {
            console.log(`Total Footfall Records: ${row.count}`);
        }

        // Check footfall schema
        db.all('PRAGMA table_info(footfall)', (err, columns) => {
            if (err) {
                console.error('Error getting footfall schema:', err);
            } else {
                console.log('\nFootfall Table Schema:');
                columns.forEach(col => {
                    console.log(`  - ${col.name} (${col.type})`);
                });
            }

            // Check footfall for January 2026
            db.all(`SELECT location_name, date, SUM(footfall_count) as total_footfall 
                    FROM footfall 
                    WHERE date BETWEEN '2026-01-01' AND '2026-01-10'
                    GROUP BY location_name, date
                    ORDER BY date, location_name`, (err, rows) => {
                if (err) {
                    console.error('Error querying January footfall:', err);
                } else {
                    console.log(`\nJanuary 2026 Footfall (01-10):`);
                    if (rows.length === 0) {
                        console.log('  ❌ NO FOOTFALL DATA FOUND for January 2026');
                    } else {
                        rows.forEach(row => {
                            console.log(`  ${row.date} - ${row.location_name}: ${row.total_footfall} visitors`);
                        });
                    }
                }

                // Check date range in footfall table
                db.get('SELECT MIN(date) as min_date, MAX(date) as max_date FROM footfall', (err, row) => {
                    if (err) {
                        console.error('Error getting footfall date range:', err);
                    } else {
                        console.log(`\nFootfall Date Range: ${row.min_date} to ${row.max_date}`);
                    }

                    db.close();
                });
            });
        });
    });
});

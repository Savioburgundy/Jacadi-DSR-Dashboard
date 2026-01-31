const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data.db');
const db = new sqlite3.Database(dbPath);

console.log('=== LOCATION NAME COMPARISON ===\n');

// Get location names from sales_transactions
db.all(`SELECT DISTINCT location_name FROM sales_transactions ORDER BY location_name`, (err, salesRows) => {
    if (err) {
        console.error('Error querying sales_transactions locations:', err);
        db.close();
        return;
    }

    console.log('Location Names in sales_transactions:');
    salesRows.forEach(row => {
        console.log(`  - "${row.location_name}"`);
    });

    // Get location names from footfall
    db.all(`SELECT DISTINCT location_name FROM footfall ORDER BY location_name`, (err, footfallRows) => {
        if (err) {
            console.error('Error querying footfall locations:', err);
            db.close();
            return;
        }

        console.log('\nLocation Names in footfall:');
        footfallRows.forEach(row => {
            console.log(`  - "${row.location_name}"`);
        });

        console.log('\n=== MISMATCH ANALYSIS ===');
        const salesLocations = salesRows.map(r => r.location_name);
        const footfallLocations = footfallRows.map(r => r.location_name);

        const inSalesNotInFootfall = salesLocations.filter(loc => !footfallLocations.includes(loc));
        const inFootfallNotInSales = footfallLocations.filter(loc => !salesLocations.includes(loc));

        if (inSalesNotInFootfall.length > 0) {
            console.log('\n❌ Locations in sales_transactions but NOT in footfall:');
            inSalesNotInFootfall.forEach(loc => console.log(`  - "${loc}"`));
        }

        if (inFootfallNotInSales.length > 0) {
            console.log('\n❌ Locations in footfall but NOT in sales_transactions:');
            inFootfallNotInSales.forEach(loc => console.log(`  - "${loc}"`));
        }

        if (inSalesNotInFootfall.length === 0 && inFootfallNotInSales.length === 0) {
            console.log('\n✓ All location names match perfectly!');
        }

        db.close();
    });
});

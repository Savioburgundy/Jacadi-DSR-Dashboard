
import db from '../config/db';

const run = async () => {
    try {
        console.log("Checking Schema and Adding Column...");

        // Check if column exists
        try {
            await db.query("SELECT sales_person_name FROM sales_transactions LIMIT 1");
            console.log("Column 'sales_person_name' ALREADY EXISTS.");
        } catch (e: any) {
            console.log("Column missing. Adding 'sales_person_name'...");
            await db.query("ALTER TABLE sales_transactions ADD COLUMN sales_person_name TEXT;");
            console.log("Column Added Successfully.");
        }

        // Must re-ingest data to populate it? 
        // Or is it already in the CSV and just wasn't mapped?
        // Wait, if I added the column now, it's NULL for all existing rows. 
        // The previous queries filtering on it might fail or return 0.

    } catch (e) {
        console.error(e);
    }
};

run();

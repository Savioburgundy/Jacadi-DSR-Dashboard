
import db from '../config/db';

const run = async () => {
    try {
        console.log("Checking for whitespace issues...");
        const sql = `
            SELECT DISTINCT mh1_description, LENGTH(mh1_description) as len
            FROM sales_transactions
            WHERE mh1_description LIKE '%Sales%'
        `;
        const res = await db.query(sql);
        console.table(res.rows);
    } catch (e) {
        console.error("Error:", e);
    }
};

run();

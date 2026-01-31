
import db from '../config/db';

const run = async () => {
    try {
        const sampleSql = `SELECT * FROM sales_transactions WHERE invoice_no IN (SELECT invoice_no FROM sales_transactions LIMIT 1)`;
        const result = await db.query(sampleSql);
        console.log("Sample Invoice Rows:");
        console.log(JSON.stringify(result.rows, null, 2));
    } catch (e) {
        console.error(e);
    }
};

run();


import db from '../config/db';

const run = async () => {
    try {
        console.log("Checking sales_person_name column data...");

        const sql = `
            SELECT sales_person_name, COUNT(*) as count 
            FROM sales_transactions 
            GROUP BY sales_person_name 
            LIMIT 10
        `;
        const res = await db.query(sql);
        console.table(res.rows);

        const sql2 = `SELECT COUNT(*) as total_rows FROM sales_transactions`;
        const res2 = await db.query(sql2);
        console.log("Total Rows:", res2.rows[0].total_rows);

        const sql3 = `SELECT COUNT(*) as null_names FROM sales_transactions WHERE sales_person_name IS NULL`;
        const res3 = await db.query(sql3);
        console.log("Rows with NULL sales_person_name:", res3.rows[0].null_names);

    } catch (e) {
        console.error(e);
    }
};

run();

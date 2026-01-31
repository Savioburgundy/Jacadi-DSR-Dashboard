
import db from '../config/db';

const run = async () => {
    try {
        console.log("Searching for 'Whatsapp' (case insensitive)...");

        const columns = [
            'sales_person_name',
            'order_channel_name',
            'invoice_channel_name',
            'sub_channel_name',
            'mh1_description',
            'order_channel_code',
            'location_name'
        ];

        for (const col of columns) {
            const sql = `
                SELECT count(*) as count 
                FROM sales_transactions 
                WHERE ${col} LIKE '%hatsapp%' OR ${col} LIKE '%hats app%'
            `;
            const res = await db.query(sql);
            if (res.rows[0].count > 0) {
                console.log(`Found 'Whatsapp' in column: ${col} (Count: ${res.rows[0].count})`);
                const sample = await db.query(`SELECT DISTINCT ${col} FROM sales_transactions WHERE ${col} LIKE '%hatsapp%' LIMIT 5`);
                console.log("Samples:", sample.rows);
            }
        }

    } catch (e) {
        console.error(e);
    }
};

run();

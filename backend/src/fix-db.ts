import db from './config/db';

async function run() {
    console.log('Updating location names...');
    await db.query("UPDATE location_efficiency SET location_name = 'Jacadi MOA' WHERE location_name = 'MOA'");
    await db.query("UPDATE location_efficiency SET location_name = 'Jacadi Palladium' WHERE location_name = 'Palladium'");
    const r = await db.query('SELECT * FROM location_efficiency');
    console.log(JSON.stringify(r.rows, null, 2));
}

run().catch(console.error);

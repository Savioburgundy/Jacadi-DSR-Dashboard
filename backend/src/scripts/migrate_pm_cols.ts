
import db from '../config/db';

const migrate = async () => {
    console.log('Starting migration...');
    try {
        await db.query(`ALTER TABLE location_efficiency ADD COLUMN pm_footfall INTEGER DEFAULT 0;`);
        console.log('Added pm_footfall');
    } catch (e: any) {
        console.log('pm_footfall might already exist:', e.message);
    }

    try {
        await db.query(`ALTER TABLE location_efficiency ADD COLUMN pm_conversion_pct REAL DEFAULT 0;`);
        console.log('Added pm_conversion_pct');
    } catch (e: any) {
        console.log('pm_conversion_pct might already exist:', e.message);
    }

    try {
        await db.query(`ALTER TABLE location_efficiency ADD COLUMN pm_multies_pct REAL DEFAULT 0;`);
        console.log('Added pm_multies_pct');
    } catch (e: any) {
        console.log('pm_multies_pct might already exist:', e.message);
    }

    console.log('Migration done.');
};

migrate();

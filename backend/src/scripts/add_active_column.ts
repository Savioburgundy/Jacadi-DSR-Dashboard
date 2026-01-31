import db from '../config/db';

const migrate = async () => {
    try {
        console.log('🔄 Adding "active" column to users table...');
        try {
            await db.query(`ALTER TABLE users ADD COLUMN active INTEGER DEFAULT 1`);
            console.log('✅ Column added successfully.');
        } catch (e: any) {
            if (e.message && e.message.includes('duplicate column')) {
                console.log('ℹ️  Column "active" already exists.');
            } else {
                throw e;
            }
        }
    } catch (error) {
        console.error('❌ Migration failed:', error);
    }
};

migrate();

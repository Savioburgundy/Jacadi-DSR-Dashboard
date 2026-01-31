import sqlite3 from 'sqlite3';
import { MongoClient } from 'mongodb';
import path from 'path';
import bcrypt from 'bcryptjs';

const SQLITE_PATH = path.join(__dirname, '../data.db');
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'jacadi_dsr';

async function migrate() {
    console.log('🚀 Starting SQLite to MongoDB Migration...');
    console.log(`📁 SQLite DB: ${SQLITE_PATH}`);
    console.log(`🌐 MongoDB URL: ${MONGO_URL}`);
    console.log(`📦 Database: ${DB_NAME}`);
    
    // Connect to MongoDB
    const mongoClient = new MongoClient(MONGO_URL);
    await mongoClient.connect();
    const mongoDB = mongoClient.db(DB_NAME);
    console.log('✅ Connected to MongoDB');
    
    // Connect to SQLite
    const sqliteDB = new sqlite3.Database(SQLITE_PATH);
    
    const querySQL = (sql: string): Promise<any[]> => {
        return new Promise((resolve, reject) => {
            sqliteDB.all(sql, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    };
    
    try {
        // 1. Migrate Users
        console.log('\n📋 Migrating users...');
        const users = await querySQL('SELECT * FROM users');
        if (users.length > 0) {
            const usersCollection = mongoDB.collection('users');
            // Clear existing users first to avoid duplicates
            await usersCollection.deleteMany({});
            
            const transformedUsers = users.map((u: any) => ({
                email: u.email,
                password_hash: u.password_hash,
                full_name: u.full_name || u.name || 'Admin User',
                role: u.role || 'admin',
                active: u.active ?? 1,
                created_at: u.created_at ? new Date(u.created_at) : new Date(),
                updated_at: u.updated_at ? new Date(u.updated_at) : new Date()
            }));
            
            await usersCollection.insertMany(transformedUsers);
            console.log(`   ✅ Migrated ${users.length} users`);
        } else {
            // Create default admin user if no users exist
            const usersCollection = mongoDB.collection('users');
            const existingAdmin = await usersCollection.findOne({ email: 'admin@example.com' });
            if (!existingAdmin) {
                const hashedPassword = await bcrypt.hash('password', 10);
                await usersCollection.insertOne({
                    email: 'admin@example.com',
                    password_hash: hashedPassword,
                    full_name: 'Admin User',
                    role: 'admin',
                    active: 1,
                    created_at: new Date(),
                    updated_at: new Date()
                });
                console.log('   ✅ Created default admin user');
            }
        }
        
        // 2. Migrate Sales Transactions
        console.log('\n📋 Migrating sales_transactions...');
        const salesTx = await querySQL('SELECT * FROM sales_transactions');
        if (salesTx.length > 0) {
            const salesCollection = mongoDB.collection('sales_transactions');
            // Clear existing data
            await salesCollection.deleteMany({});
            
            // Insert in batches to avoid memory issues
            const BATCH_SIZE = 5000;
            for (let i = 0; i < salesTx.length; i += BATCH_SIZE) {
                const batch = salesTx.slice(i, i + BATCH_SIZE).map((row: any) => ({
                    invoice_no: row.invoice_no,
                    invoice_date: row.invoice_date,
                    invoice_month: row.invoice_month,
                    invoice_time: row.invoice_time,
                    transaction_type: row.transaction_type,
                    order_channel_code: row.order_channel_code,
                    order_channel_name: row.order_channel_name,
                    invoice_channel_code: row.invoice_channel_code,
                    invoice_channel_name: row.invoice_channel_name,
                    sub_channel_code: row.sub_channel_code,
                    sub_channel_name: row.sub_channel_name,
                    location_code: row.location_code,
                    location_name: row.location_name,
                    store_type: row.store_type,
                    city: row.city,
                    state: row.state,
                    total_sales_qty: Number(row.total_sales_qty) || 0,
                    unit_mrp: Number(row.unit_mrp) || 0,
                    invoice_mrp_value: Number(row.invoice_mrp_value) || 0,
                    invoice_discount_value: Number(row.invoice_discount_value) || 0,
                    invoice_discount_pct: Number(row.invoice_discount_pct) || 0,
                    invoice_basic_value: Number(row.invoice_basic_value) || 0,
                    total_tax_pct: Number(row.total_tax_pct) || 0,
                    total_tax_amt: Number(row.total_tax_amt) || 0,
                    nett_invoice_value: Number(row.nett_invoice_value) || 0,
                    sales_person_code: row.sales_person_code,
                    sales_person_name: row.sales_person_name,
                    consumer_code: row.consumer_code,
                    consumer_name: row.consumer_name,
                    consumer_mobile: row.consumer_mobile,
                    product_code: row.product_code,
                    product_name: row.product_name,
                    category_name: row.category_name,
                    brand_name: row.brand_name,
                    mh1_description: row.mh1_description,
                    created_at: row.created_at ? new Date(row.created_at) : new Date()
                }));
                
                await salesCollection.insertMany(batch);
                console.log(`   📊 Inserted batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(salesTx.length/BATCH_SIZE)} (${batch.length} records)`);
            }
            console.log(`   ✅ Migrated ${salesTx.length} sales transactions`);
        } else {
            console.log('   ⚠️ No sales transactions found');
        }
        
        // 3. Migrate Footfall
        console.log('\n📋 Migrating footfall...');
        const footfall = await querySQL('SELECT * FROM footfall');
        if (footfall.length > 0) {
            const footfallCollection = mongoDB.collection('footfall');
            await footfallCollection.deleteMany({});
            
            const transformedFootfall = footfall.map((row: any) => ({
                date: row.report_date || row.date,
                location_name: row.location_name,
                footfall_count: Number(row.footfall) || Number(row.footfall_count) || 0,
                conversion_rate: Number(row.conversion_rate) || 0
            }));
            
            await footfallCollection.insertMany(transformedFootfall);
            console.log(`   ✅ Migrated ${footfall.length} footfall records`);
        } else {
            console.log('   ⚠️ No footfall records found');
        }
        
        // 4. Migrate Ingestion Logs
        console.log('\n📋 Migrating ingestion_logs...');
        const logs = await querySQL('SELECT * FROM ingestion_logs');
        if (logs.length > 0) {
            const logsCollection = mongoDB.collection('ingestion_logs');
            await logsCollection.deleteMany({});
            
            const transformedLogs = logs.map((row: any) => ({
                id: row.id,
                filename: row.filename,
                status: row.status,
                rows_added: Number(row.rows_added) || 0,
                error_message: row.error_message,
                created_at: row.created_at ? new Date(row.created_at) : new Date()
            }));
            
            await logsCollection.insertMany(transformedLogs);
            console.log(`   ✅ Migrated ${logs.length} ingestion logs`);
        } else {
            console.log('   ⚠️ No ingestion logs found');
        }
        
        // 5. Migrate Location Efficiency (if exists)
        console.log('\n📋 Migrating location_efficiency...');
        try {
            const efficiency = await querySQL('SELECT * FROM location_efficiency');
            if (efficiency.length > 0) {
                const efficiencyCollection = mongoDB.collection('location_efficiency');
                await efficiencyCollection.deleteMany({});
                
                const transformedEfficiency = efficiency.map((row: any) => ({
                    location_name: row.location_name,
                    report_date: row.report_date,
                    footfall: Number(row.footfall) || 0,
                    conversion_pct: Number(row.conversion_pct) || 0,
                    multies_pct: Number(row.multies_pct) || 0,
                    pm_footfall: Number(row.pm_footfall) || 0,
                    pm_conversion_pct: Number(row.pm_conversion_pct) || 0,
                    pm_multies_pct: Number(row.pm_multies_pct) || 0
                }));
                
                await efficiencyCollection.insertMany(transformedEfficiency);
                console.log(`   ✅ Migrated ${efficiency.length} location efficiency records`);
            }
        } catch (e) {
            console.log('   ⚠️ location_efficiency table not found, skipping');
        }
        
        // Create indexes
        console.log('\n📋 Creating indexes...');
        const salesCollection = mongoDB.collection('sales_transactions');
        await salesCollection.createIndex({ invoice_date: 1 });
        await salesCollection.createIndex({ location_name: 1 });
        await salesCollection.createIndex({ invoice_no: 1 });
        await salesCollection.createIndex({ order_channel_name: 1 });
        
        const usersCollection = mongoDB.collection('users');
        await usersCollection.createIndex({ email: 1 }, { unique: true });
        
        console.log('   ✅ Indexes created');
        
        console.log('\n🎉 Migration completed successfully!');
        
        // Print summary
        const salesCount = await mongoDB.collection('sales_transactions').countDocuments();
        const usersCount = await mongoDB.collection('users').countDocuments();
        const footfallCount = await mongoDB.collection('footfall').countDocuments();
        const logsCount = await mongoDB.collection('ingestion_logs').countDocuments();
        
        console.log('\n📊 Migration Summary:');
        console.log(`   - Users: ${usersCount}`);
        console.log(`   - Sales Transactions: ${salesCount}`);
        console.log(`   - Footfall Records: ${footfallCount}`);
        console.log(`   - Ingestion Logs: ${logsCount}`);
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        sqliteDB.close();
        await mongoClient.close();
    }
}

migrate().then(() => {
    console.log('\n✅ Migration script completed');
    process.exit(0);
}).catch((err) => {
    console.error('❌ Migration script failed:', err);
    process.exit(1);
});

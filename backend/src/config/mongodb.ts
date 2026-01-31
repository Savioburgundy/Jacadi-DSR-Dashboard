import { MongoClient, Db, Collection } from 'mongodb';

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'jacadi_dsr';

let client: MongoClient;
let db: Db;

export const connectDB = async (): Promise<Db> => {
    if (db) return db;
    
    try {
        console.log(`[DB CONFIG] Connecting to MongoDB: ${MONGO_URL}`);
        client = new MongoClient(MONGO_URL);
        await client.connect();
        db = client.db(DB_NAME);
        console.log(`[DB CONFIG] Connected to MongoDB database: ${DB_NAME}`);
        
        // Create indexes for better performance
        await createIndexes();
        
        return db;
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
        throw error;
    }
};

const createIndexes = async () => {
    try {
        // Sales transactions indexes
        await db.collection('sales_transactions').createIndex({ invoice_date: 1 });
        await db.collection('sales_transactions').createIndex({ location_name: 1 });
        await db.collection('sales_transactions').createIndex({ invoice_channel_name: 1 });
        await db.collection('sales_transactions').createIndex({ invoice_no: 1 });
        
        // Users indexes
        await db.collection('users').createIndex({ email: 1 }, { unique: true });
        
        // Location efficiency indexes
        await db.collection('location_efficiency').createIndex(
            { location_name: 1, report_date: 1 }, 
            { unique: true }
        );
        
        // Footfall indexes
        await db.collection('footfall').createIndex({ date: 1 });
        
        // Ingestion logs indexes
        await db.collection('ingestion_logs').createIndex({ created_at: -1 });
        
        console.log('[DB CONFIG] Indexes created successfully');
    } catch (error) {
        console.log('[DB CONFIG] Index creation (may already exist):', error);
    }
};

export const getDB = (): Db => {
    if (!db) {
        throw new Error('Database not connected. Call connectDB() first.');
    }
    return db;
};

export const getCollection = <T extends Document>(name: string): Collection<T> => {
    return getDB().collection<T>(name);
};

// Helper to maintain compatibility with existing code
// This wraps MongoDB operations to return similar structure as SQLite queries
export default {
    query: async (sql: string, params: any[] = []): Promise<{ rows: any[] }> => {
        // This is a compatibility layer - we won't use SQL anymore
        // All queries should be rewritten to use MongoDB native methods
        console.warn('[DB] Legacy SQL query called - this should be migrated:', sql.substring(0, 50));
        return { rows: [] };
    },
    
    // MongoDB native methods
    getDB,
    getCollection,
    connectDB
};

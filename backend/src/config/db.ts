import sqlite3 from 'sqlite3';
import path from 'path';

// FORCE ABSOLUTE PATH to populated DB
const DB_PATH = path.join(__dirname, '../../data.db');
console.log(`[DB CONFIG] Connecting to: ${DB_PATH}`);

const db = new sqlite3.Database(DB_PATH, (err: any) => {
    if (err) {
        console.error('Error opening SQLite database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
    }
});

// Helper to use Promises with SQLite
export default {
    query: (sql: string, params: any[] = []): Promise<any> => {
        return new Promise((resolve, reject) => {
            // For SELECT queries, use db.all
            const upperSql = sql.trim().toUpperCase();
            if (upperSql.startsWith('SELECT') || upperSql.startsWith('WITH')) {
                db.all(sql, params, (err: any, rows: any[]) => {
                    if (err) reject(err);
                    else resolve({ rows });
                });
            } else {
                // For INSERT/UPDATE/DELETE, use db.run
                db.run(sql, params, function (this: any, err: any) {
                    if (err) reject(err);
                    else resolve({ lastID: this.lastID, changes: this.changes, rows: [] });
                });
            }
        });
    },
    dbInstance: db
};

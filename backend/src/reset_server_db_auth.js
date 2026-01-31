const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

// Target the SERVER db this time
const DB_PATH = path.resolve(__dirname, '../../data.db');

async function ensureAdminDetails() {
    console.log(`Checking DB at: ${DB_PATH}`);
    const db = new sqlite3.Database(DB_PATH);

    // 1. Check if 'password' column exists (migration check)
    // If table was created long ago, it might need migration or we just update what exists.
    // For now, let's just reset the password content for 'admin'

    // We assume the table structure exists because this is the populated DB

    const password = 'admin123';
    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(
        'UPDATE users SET password = ? WHERE username = ?',
        [hashedPassword, 'admin'],
        function (err) {
            if (err) {
                // If column 'password' missing (maybe it is password_hash?), try that
                console.log("Update 'password' failed, trying 'password_hash'...");
                db.run(
                    'UPDATE users SET password_hash = ? WHERE username = ?',
                    [hashedPassword, 'admin'],
                    function (err2) {
                        if (err2) console.error("Both updates failed:", err2.message);
                        else console.log(`Updated 'password_hash'. Rows affected: ${this.changes}`);
                    }
                );
            } else {
                console.log(`Updated 'password'. Rows affected: ${this.changes}`);
            }
        }
    );
}

ensureAdminDetails();

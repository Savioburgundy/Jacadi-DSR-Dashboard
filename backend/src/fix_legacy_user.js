const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.resolve(__dirname, '../../data.db'); // server/data.db

async function fixLegacyUser() {
    console.log(`Open connection to ${DB_PATH}`);
    const db = new sqlite3.Database(DB_PATH);

    const email = 'it@bbcollective.co';
    const password = 'admin123';
    const hashedPassword = await bcrypt.hash(password, 10);

    // Ensure 'password_hash' column exists (or add it if missing due to my previous mess)
    // Actually, assume it exists or use 'password' if 'password_hash' fails.
    // But since I reverted the code to use strict 'user.password_hash', I MUST ensure this column is populated.

    db.serialize(() => {
        // Check if user exists
        db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
            if (row) {
                console.log("User found. Updating password_hash...");
                // Update password_hash explicitly
                db.run('UPDATE users SET password_hash = ? WHERE email = ?', [hashedPassword, email], function (err) {
                    if (err) {
                        console.error("Update failed:", err.message);
                        // If column missing, maybe my code assumed it existed. 
                        // Check columns
                    } else {
                        console.log("Updated password_hash.");
                    }
                });
            } else {
                console.log("Creating user...");
                db.run(
                    'INSERT INTO users (id, username, email, password_hash, role, full_name, active) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    ['it-mgr-id', 'it_admin', email, hashedPassword, 'admin', 'IT Manager', 1],
                    (err) => {
                        if (err) console.error("Insert failed:", err.message);
                        else console.log("User created.");
                    }
                );
            }
        });
    });
}

fixLegacyUser();

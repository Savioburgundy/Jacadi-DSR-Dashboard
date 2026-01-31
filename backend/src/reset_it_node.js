const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.resolve(__dirname, '../../data.db'); // server/data.db

async function resetITUser() {
    console.log(`Open connection to ${DB_PATH}`);
    const db = new sqlite3.Database(DB_PATH);

    const email = 'it@bbcollective.co';
    const password = 'admin123';
    const hashedPassword = await bcrypt.hash(password, 10);

    // 1. Check if user exists
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
        if (err) return console.error(err.message);

        if (row) {
            console.log(`User found: ${row.username} (ID: ${row.id})`);
            // Update
            db.run(
                'UPDATE users SET password = ? WHERE email = ?',
                [hashedPassword, email],
                function (err) {
                    if (err) console.error(err.message);
                    else console.log(`Password reset for ${email}. Rows: ${this.changes}`);
                    db.close();
                }
            );
        } else {
            console.log('User NOT found. Creating...');
            // Create
            db.run(
                'INSERT INTO users (id, username, email, password, role, full_name, active) VALUES (?, ?, ?, ?, ?, ?, ?)',
                ['it-mgr-id', 'it_admin', email, hashedPassword, 'admin', 'IT Manager', 1],
                function (err) {
                    if (err) console.error(err.message);
                    else console.log(`User created. Rows: ${this.changes}`);
                    db.close();
                }
            );
        }
    });
}

resetITUser();

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.resolve(__dirname, '../../data.db'); // server/data.db

async function fixAdminUser() {
    console.log(`Open connection to ${DB_PATH}`);
    const db = new sqlite3.Database(DB_PATH);

    const password = 'admin123';
    const hashedPassword = await bcrypt.hash(password, 10);
    const email = 'admin@jacadi.com';

    // Update Admin to have email and valid hash
    db.run(
        'UPDATE users SET email = ?, password_hash = ? WHERE username = ?',
        [email, hashedPassword, 'admin'],
        function (err) {
            if (err) {
                console.error(err.message);
            } else {
                console.log(`Row(s) updated: ${this.changes}`);
                console.log(`Admin set: User=admin, Email=${email}, Pass=${password}`);
            }
            db.close();
        }
    );
}

fixAdminUser();

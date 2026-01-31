const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.resolve(__dirname, '../../data.db');

async function fixITUserPassword() {
    console.log(`Open connection to ${DB_PATH}`);
    const db = new sqlite3.Database(DB_PATH);

    const email = 'it@bbcollective.co';
    const password = 'admin123';
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update 'password' column (confirmed existent)
    db.run(
        'UPDATE users SET password = ? WHERE email = ?',
        [hashedPassword, email],
        function (err) {
            if (err) {
                console.error(err.message);
            } else {
                console.log(`Updated 'password'. Rows affected: ${this.changes} for ${email}`);
            }
            db.close();
        }
    );
}

fixITUserPassword();

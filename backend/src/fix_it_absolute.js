const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const DB_PATH = 'd:\\Jacadi DSR\\server\\data.db';

async function fixItUserAbsolute() {
    console.log(`Connecting to: ${DB_PATH}`);
    const db = new sqlite3.Database(DB_PATH);

    const email = 'it@bbcollective.co';
    const password = 'admin123';
    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(
        'UPDATE users SET password_hash = ? WHERE email = ?',
        [hashedPassword, email],
        function (err) {
            if (err) {
                console.error(err.message);
            } else {
                console.log(`Password updated for ${email}. Rows affected: ${this.changes}`);
            }
            db.close();
        }
    );
}

fixItUserAbsolute();

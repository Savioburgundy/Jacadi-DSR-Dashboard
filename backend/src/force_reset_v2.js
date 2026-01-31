const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.resolve(__dirname, '../../data.db'); // server/data.db

async function forceReset() {
    console.log(`Open connection to ${DB_PATH}`);
    const db = new sqlite3.Database(DB_PATH);

    const password = 'admin123';
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update 'password' column (confirmed to exist in schema logic)
    db.run(
        'UPDATE users SET password = ? WHERE username = ?',
        [hashedPassword, 'admin'],
        function (err) {
            if (err) {
                console.error(err.message);
            } else {
                console.log(`Updated 'password'. Rows affected: ${this.changes}`);
            }
            db.close();
        }
    );
}

forceReset();

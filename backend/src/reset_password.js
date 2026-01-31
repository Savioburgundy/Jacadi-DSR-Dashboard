const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.resolve(__dirname, '../../data.db');

async function resetPassword() {
    console.log(`Open connection to ${DB_PATH}`);
    const db = new sqlite3.Database(DB_PATH);

    const password = 'admin123';
    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(
        'UPDATE users SET password = ? WHERE username = ?',
        [hashedPassword, 'admin'],
        function (err) {
            if (err) {
                return console.error(err.message);
            }
            console.log(`Row(s) updated: ${this.changes}`);
            console.log('Password reset successfully to: ' + password);
        }
    );

    db.close();
}

resetPassword();

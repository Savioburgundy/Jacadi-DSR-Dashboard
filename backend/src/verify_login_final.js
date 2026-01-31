const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.resolve(__dirname, '../../data.db');

async function verifyLogin() {
    const db = new sqlite3.Database(DB_PATH);
    const email = 'it@bbcollective.co';
    const password = 'admin123';

    console.log(`Checking login for ${email} in ${DB_PATH}`);

    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) { console.error(err); return; }
        if (!user) { console.log('User NOT Found'); return; }

        console.log(`User Found: ${user.username}`);

        // Match logic from auth.routes.ts
        if (!user.password) {
            console.log('FAIL: Password column is null');
            return;
        }

        const isMatch = await bcrypt.compare(password, user.password);
        console.log(`Password 'admin123' valid? ${isMatch ? 'YES (Login Success)' : 'NO (Login Fail)'}`);
    });
}

verifyLogin();

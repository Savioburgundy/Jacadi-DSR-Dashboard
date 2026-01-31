const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.resolve(__dirname, '../../data.db');
console.log(`Checking DB at: ${DB_PATH}`);

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
    db.all("SELECT id, username, password, role FROM users WHERE username = 'admin'", (err, rows) => {
        if (err) {
            console.error(err);
        } else {
            console.log("User Record:", rows);
        }
        db.close();
    });
});

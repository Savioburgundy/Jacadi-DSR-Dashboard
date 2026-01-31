import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

/**
 * Service to handle database backups (Restore Points)
 * For MongoDB, we use mongodump to create backups
 */
export const createRestorePoint = async (): Promise<string> => {
    const backupDir = path.join(__dirname, '../../backups');

    // Ensure backup directory exists
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    const now = new Date();
    const timestamp = now.toISOString().replace(/[:T]/g, '-').split('.')[0];
    const backupFolderName = `mongo_backup_${timestamp}`;
    const destinationPath = path.join(backupDir, backupFolderName);

    const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017';
    const dbName = process.env.DB_NAME || 'jacadi_dsr';

    return new Promise((resolve, reject) => {
        // Try to use mongodump if available
        exec(`which mongodump`, (whichErr) => {
            if (whichErr) {
                // mongodump not available, skip backup gracefully
                console.log('[Backup] mongodump not available, skipping MongoDB backup.');
                resolve('');
                return;
            }

            const cmd = `mongodump --uri="${mongoUrl}" --db=${dbName} --out="${destinationPath}"`;
            exec(cmd, (err, stdout, stderr) => {
                if (err) {
                    console.error('❌ Failed to create MongoDB restore point:', err.message);
                    // Don't fail the whole process, just log and continue
                    resolve('');
                } else {
                    console.log(`✅ MongoDB restore point created: ${destinationPath}`);
                    resolve(destinationPath);
                }
            });
        });
    });
};

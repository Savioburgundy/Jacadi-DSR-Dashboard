import fs from 'fs';
import path from 'path';

/**
 * Service to handle database backups (Restore Points)
 */
export const createRestorePoint = async (): Promise<string> => {
    const sourcePath = 'd:\\Jacadi DSR\\server\\data.db';
    const backupDir = 'd:\\Jacadi DSR\\backups';

    // Ensure backup directory exists
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    const now = new Date();
    const timestamp = now.toISOString().replace(/[:T]/g, '-').split('.')[0];
    const backupFileName = `data_restore_point_${timestamp}.db`;
    const destinationPath = path.join(backupDir, backupFileName);

    return new Promise((resolve, reject) => {
        if (!fs.existsSync(sourcePath)) {
            console.warn(`[Backup] Source database not found at ${sourcePath}. Skipping backup.`);
            resolve('');
            return;
        }

        fs.copyFile(sourcePath, destinationPath, (err) => {
            if (err) {
                console.error('❌ Failed to create restore point:', err);
                reject(err);
            } else {
                console.log(`✅ Restore point created: ${destinationPath}`);
                resolve(destinationPath);
            }
        });
    });
};

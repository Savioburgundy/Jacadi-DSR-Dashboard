import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { getCollection } from '../config/mongodb';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';

export const downloadJacadiReport = async () => {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, '../../scripts/fetch_jacadi_report.py');
        console.log(`Triggering automation script: ${scriptPath}`);

        // Use the venv Python which has Playwright installed
        exec(`/root/.venv/bin/python "${scriptPath}"`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Automation Error: ${error.message}`);
                reject(error);
                return;
            }
            console.log(`Automation Output: ${stdout}`);
            resolve(stdout);
        });
    });
};

import { processInvoiceCSV } from './etl.service';
import { createRestorePoint } from './backup.service';

export const runIngestion = async () => {
    console.log('🚀 Starting Ingestion Pipeline...');

    // 1. Create Restore Point before doing anything
    try {
        await createRestorePoint();
    } catch (err) {
        console.error('⚠️ Failed to create restore point, but proceeding with ingestion...');
    }

    const inputDir = process.env.DATA_INPUT_DIR || path.join(__dirname, '../../data_input');
    const archiveDir = process.env.DATA_ARCHIVE_DIR || path.join(__dirname, '../../data_archive');

    if (!fs.existsSync(inputDir)) {
        console.warn(`Input directory ${inputDir} does not exist. Creating it...`);
        fs.mkdirSync(inputDir, { recursive: true });
    }

    console.log(`📁 Checking for files in: ${inputDir}`);
    const files = fs.readdirSync(inputDir).filter(f => f.toLowerCase().endsWith('.csv'));

    if (files.length === 0) {
        console.log(`ℹ️ No CSV files found in ${inputDir}`);
        return;
    }

    console.log(`📂 Found ${files.length} files to process: ${files.join(', ')}`);
    const logsCollection = getCollection('ingestion_logs');

    for (const file of files) {
        const filePath = path.join(inputDir, file);

        try {
            // 1. Check if file already ingested
            const existingLog = await logsCollection.findOne({ filename: file, status: 'success' });

            if (existingLog) {
                console.log(`⏭️  File ${file} already processed, skipping.`);
                continue;
            }

            console.log(`🔄 Processing file: ${file}`);

            // 2. Use Robust ETL Service
            const rowCount = await processInvoiceCSV(filePath);

            // 3. Log success
            await logsCollection.insertOne({
                id: uuidv4(),
                filename: file,
                status: 'success',
                rows_added: rowCount,
                created_at: new Date()
            });
            console.log(`✅ Successfully ingested ${rowCount} rows from ${file}`);

            // 4. Move to archive
            const archivePath = path.join(archiveDir, file);
            if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });

            // Rename/Move
            // Handle cross-device rename issues by using copy+unlink if needed, but renameSync usually works on same drive
            try {
                fs.renameSync(filePath, archivePath);
            } catch (err) {
                // Fallback for permissions or cross-drive
                fs.copyFileSync(filePath, archivePath);
                fs.unlinkSync(filePath);
            }

            console.log(`📦 Archived ${file}`);

        } catch (err) {
            console.error(`❌ Error processing ${file}:`, err);
            await logsCollection.insertOne({
                id: uuidv4(),
                filename: file,
                status: 'failed',
                error_message: err instanceof Error ? err.message : String(err),
                created_at: new Date()
            });
        }
    }
};

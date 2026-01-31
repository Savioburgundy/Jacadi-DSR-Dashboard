import db from '../config/db';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { processInvoiceCSV, processEfficiencyCSV } from '../services/etl.service';

const initializeSchema = async () => {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    // Split by semicolon and execute each statement
    const statements = schema
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

    for (const statement of statements) {
        try {
            await db.query(statement);
        } catch (error: any) {
            console.error(`Error executing statement: ${error.message}`);
        }
    }

    console.log('✅ Schema initialized.');
};

const seedAdmin = async () => {
    const adminId = uuidv4();
    const passwordHash = await bcrypt.hash('password', 10);

    try {
        await db.query(
            `INSERT INTO users (id, email, password_hash, full_name, role, org_id) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [adminId, 'admin@example.com', passwordHash, 'Admin User', 'admin', 'default-org']
        );
        console.log('✅ Admin user created: admin@example.com / password');
    } catch (error: any) {
        if (error.message?.includes('UNIQUE')) {
            console.log('ℹ️  Admin user already exists');
        } else {
            throw error;
        }
    }
};

const seedMetrics = async () => {
    const metrics = [
        {
            id: uuidv4(),
            name: 'conversion_pct',
            label: 'Conversion %',
            formula: '(trx / footfall) * 100',
            depends_on: 'trx,footfall'
        },
        {
            id: uuidv4(),
            name: 'avg_transaction_value',
            label: 'Average Transaction Value',
            formula: 'revenue / trx',
            depends_on: 'revenue,trx'
        },
        {
            id: uuidv4(),
            name: 'basket_size',
            label: 'Basket Size',
            formula: 'units / trx',
            depends_on: 'units,trx'
        }
    ];

    for (const metric of metrics) {
        try {
            await db.query(
                `INSERT INTO metrics (id, name, label, formula, depends_on) 
                 VALUES (?, ?, ?, ?, ?)`,
                [metric.id, metric.name, metric.label, metric.formula, metric.depends_on]
            );
        } catch (error: any) {
            if (error.message?.includes('UNIQUE')) {
                console.log(`ℹ️  Metric '${metric.name}' already exists`);
            } else {
                throw error;
            }
        }
    }

    console.log('✅ Metrics seeded');
};

const seedInvoiceData = async () => {
    // Check for invoice file in input_reports first
    const inputReportsDir = process.env.DATA_INPUT_DIR || path.join(__dirname, '../../data_input');
    // Get ALL invoice files
    let invoiceFiles: string[] = [];

    if (fs.existsSync(inputReportsDir)) {
        const files = fs.readdirSync(inputReportsDir);
        // Find ALL matching files
        const allFiles = files
            .filter(f => f.startsWith('JPHO') && f.endsWith('.csv'))
            .map(f => path.join(inputReportsDir, f));

        if (allFiles.length > 0) {
            // Logic: Pick the file with the LATEST DATE in the filename.
            // Format: JPHO@JPinvoicedetailreportDDMMYYYYHHMMSS.csv
            // Example: JPHO@JPinvoicedetailreport29012026034439.csv -> 29-01-2026

            const getFileTimestamp = (params: string): number => {
                try {
                    // Extract the full sequence: DDMMYYYYHHMMSS (14 digits)
                    // Example: JPHO@...report29012026034439.csv
                    const match = params.match(/report(\d{14})/);
                    if (match && match[1]) {
                        const ts = match[1];
                        const d = ts.substring(0, 8); // DDMMYYYY
                        const t = ts.substring(8, 14); // HHMMSS

                        // Convert to YYYYMMDDHHMMSS for sorting
                        // YYYY (4-8) + MM (2-4) + DD (0-2) + HHMMSS
                        const sortKey = `${d.substring(4, 8)}${d.substring(2, 4)}${d.substring(0, 2)}${t}`;
                        return parseFloat(sortKey);
                    }
                    // Fallback: Try matching just date if time is missing (backward compatibility)
                    const matchDate = params.match(/report(\d{8})/);
                    if (matchDate && matchDate[1]) {
                        const d = matchDate[1];
                        return parseFloat(`${d.substring(4, 8)}${d.substring(2, 4)}${d.substring(0, 2)}000000`);
                    }
                } catch (e) { return 0; }
                return 0;
            };

            // Sort ASCENDING (Oldest First)
            const sorted = allFiles.sort((a, b) => getFileTimestamp(a) - getFileTimestamp(b));
            // Process ALL files
            invoiceFiles = sorted;
            console.log(`ℹ️  Found ${invoiceFiles.length} JPHO files. Processing iteratively (Oldest -> Newest).`);
        }
    }

    if (invoiceFiles.length === 0) {
        // Fallback paths (single file check)
        const possiblePaths = [
            path.join(__dirname, '../../JPHO@JPinvoicedetailreport10012026013411.csv'),
            path.join(__dirname, '../../data_input/JPHO@JPinvoicedetailreport10012026013411.csv')
        ];
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                // only use fallback if we found nothing in input_reports
                invoiceFiles.push(p);
                break;
            }
        }
    }

    if (invoiceFiles.length === 0) {
        console.log('⚠️  Invoice CSV not found (checked input_reports and root). Skipping.');
        return;
    }

    // INCREMENTAL UPDATE LOGIC (STAGING TABLE)
    console.log('🔄 Preparing Staging Table for Upsert...');
    // Create Staging Table (Copy Schema)
    await db.query('DROP TABLE IF EXISTS staging_sales_transactions');
    await db.query('CREATE TABLE staging_sales_transactions AS SELECT * FROM sales_transactions WHERE 0=1');

    console.log(`📊 Processing ${invoiceFiles.length} invoice files...`);

    let totalRows = 0;
    for (const csvPath of invoiceFiles) {
        console.log(`   -> Reading: ${csvPath}`);
        // Load into STAGING table
        const count = await processInvoiceCSV(csvPath, 'staging_sales_transactions');
        totalRows += count;
        console.log(`      Imported ${count} rows`);
    }
    console.log(`✅ Staged ${totalRows} records.`);

    if (totalRows > 0) {
        console.log('🔄 Performing Smart Upsert...');

        // 1. DELETE overlapping invoices from Main Table (Handle Corrections)
        console.log('   -> Cleaning overlapping invoices...');
        await db.query(`
            DELETE FROM sales_transactions 
            WHERE invoice_no IN (SELECT DISTINCT invoice_no FROM staging_sales_transactions)
        `);

        // 2. INSERT new/updated rows from Staging to Main
        console.log('   -> Merging new data...');
        await db.query(`
            INSERT INTO sales_transactions 
            SELECT * FROM staging_sales_transactions
        `);

        console.log('✅ Upsert Complete.');
    }

    // Cleanup
    await db.query('DROP TABLE IF EXISTS staging_sales_transactions');
};

const seedEfficiencyData = async () => {
    const inputReportsDir = path.join('D:\\Jacadi DSR\\input_reports');
    let csvPath: string | null = null;

    // Check input_reports first
    if (fs.existsSync(inputReportsDir)) {
        const files = fs.readdirSync(inputReportsDir);
        const effFile = files.find(f => f.includes('Retail + Whatsapp Sales 2') && f.endsWith('.csv'));
        if (effFile) csvPath = path.join(inputReportsDir, effFile);
    }

    // Fallback
    if (!csvPath) {
        const possiblePaths = [
            'D:\\Jacadi DSR\\Retail + Whatsapp Sales 2.csv',
            'D:\\Jacadi DSR\\BI exported reports\\Retail + Whatsapp Sales 2.csv'
        ];
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                csvPath = p;
                break;
            }
        }
    }

    if (!csvPath) {
        console.log('⚠️  Efficiency CSV not found. Skipping.');
        return;
    }

    console.log(`📊 Processing efficiency data from: ${csvPath}`);
    const rowCount = await processEfficiencyCSV(csvPath);
    console.log(`✅ Imported ${rowCount} efficiency records`);
};

import { processFootfallCSV } from '../services/etl.service';

const seedFootfallData = async () => {
    const inputReportsDir = path.join('D:\\Jacadi DSR\\input_reports');
    let csvPath: string | null = null;

    if (fs.existsSync(inputReportsDir)) {
        const files = fs.readdirSync(inputReportsDir);
        // Match "Footfall Data" or similar. User file: "Footfall Data - 2601101955.csv"
        const ffFile = files.find(f => f.toLowerCase().includes('footfall') && f.endsWith('.csv'));
        if (ffFile) csvPath = path.join(inputReportsDir, ffFile);
    }

    // Fallback to project root if converted manually
    if (!csvPath && fs.existsSync('D:\\Jacadi DSR\\Footfall Data - 2601101955.csv')) {
        csvPath = 'D:\\Jacadi DSR\\Footfall Data - 2601101955.csv';
    }

    if (!csvPath) {
        console.log('⚠️  Footfall CSV not found. Skipping.');
        return;
    }

    console.log(`👣 Processing footfall data from: ${csvPath}`);
    const rowCount = await processFootfallCSV(csvPath);
    console.log(`✅ Imported ${rowCount} footfall records`);
};

const main = async () => {
    console.log('Starting SQLite seeding...');

    try {
        await initializeSchema(); // ✅ ENABLED: Rebuild database from scratch
        await seedAdmin(); // Create admin user
        await seedMetrics();
        await seedInvoiceData();
        await seedEfficiencyData();
        await seedFootfallData();

        console.log('✅ Seeding completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    }
};

main();

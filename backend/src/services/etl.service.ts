import db from '../config/db';
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { v4 as uuidv4 } from 'uuid';

interface InvoiceRow {
    'Invoice No': string;
    'Invoice Date': string;
    'Invoice Month': string;
    'Invoice Time': string;
    'Sales Transaction Type (IV/SR/IR)': string;
    'Order Business Channel Code': string;
    'Order Associate Name': string;
    'Order Business Channel Name': string;
    'Invoice Business Channel Code': string;
    'Invoice Business Channel Name': string;
    'Invoice Business Sub Channel Code': string;
    'Invoice Business Sub Channel Name': string;
    'Invoice Associate Code ': string;
    'Invoice Associate Short Name': string;
    'Invoice Associate Name': string;
    'Invoice Associate Town name': string;
    'Invoice Associate State name': string;
    'Total Sales Qty': string;
    'Unit MRP': string;
    'Invoice MRP Value': string;
    'Invoice Discount Value': string;
    'Invoice Discount Percentage': string;
    'Invoice Basic Value': string;
    'Total Tax %': string;
    'Total Tax Amt': string;
    'Nett Invoice Value': string;
    'Sales Person Code': string;
    'Sales Person Name': string;
    'Consumer Code': string;
    'Consumer Name': string;
    'Consumer Mobile': string;
    'Product Code': string;
    'Product SKU Desc': string;
    'Category Name': string;
    'Brand Name': string;
    'MH1 Description': string;
}

export const processInvoiceCSV = async (filePath: string, tableName: string = 'sales_transactions'): Promise<number> => {
    return new Promise((resolve, reject) => {
        const rows: any[] = [];

        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row: InvoiceRow) => {
                try {
                    // Parse and transform the row
                    const invoiceDate = parseInvoiceDate(row['Invoice Date']);

                    // Map outlets and channels based on Order Associate Name
                    const rawOrderAssociate = (row['Order Associate Name'] || '').trim();

                    let locationName = '';
                    let channelName = 'Brick and Mortar'; // Default to Retail

                    // Channel Logic
                    if (rawOrderAssociate.toLowerCase().includes('shopify') || rawOrderAssociate.toLowerCase().includes('webstore') || rawOrderAssociate.toLowerCase().includes('website')) {
                        channelName = 'E-Commerce';
                    }

                    // Location Logic
                    // 1. Check Order Associate Name FIRST (User Requirement)
                    if (rawOrderAssociate.toLowerCase().includes('palladium')) {
                        locationName = 'Jacadi Palladium';
                    } else if (rawOrderAssociate.toLowerCase().includes('asia') || rawOrderAssociate.toLowerCase().includes('moa')) {
                        locationName = 'Jacadi MOA';
                    } else if (rawOrderAssociate.toLowerCase().includes('shopify') || rawOrderAssociate.toLowerCase().includes('webstore') || rawOrderAssociate.toLowerCase().includes('website')) {
                        locationName = 'Shopify Webstore';
                    }

                    // 2. Fallback: If Order Associate Name didn't give a location, try Invoice Associate columns
                    if (!locationName) {
                        const r = row as any;
                        const rawInvoiceAssociateName = (r['Invoice Associate Name'] || '').trim().toLowerCase();
                        const rawInvoiceAssociateShort = (r['Invoice Associate Short Name'] || '').trim().toLowerCase();
                        const rawInvoiceCode = (r['Invoice Associate Code '] || r['Invoice Associate Code'] || '').trim().toUpperCase();

                        if (rawInvoiceAssociateName.includes('palladium') || rawInvoiceAssociateShort.includes('palladium') || rawInvoiceAssociateShort.includes('paddle') || rawInvoiceCode.includes('PALLADIUM') || rawInvoiceCode.includes('PHO')) {
                            locationName = 'Jacadi Palladium';
                        } else if (rawInvoiceAssociateName.includes('moa') || rawInvoiceAssociateName.includes('asia') || rawInvoiceAssociateShort.includes('moa') || rawInvoiceAssociateShort.includes('asia') || rawInvoiceCode.includes('JPBLRMOA')) {
                            locationName = 'Jacadi MOA';
                        }
                    }

                    // Override/Refine Location from Order Associate if needed
                    // (The above block essentially covers it, but we removed the strict 'Jacadi MOA' fallback for E-Com)
                    // The user explicitly wants 'Shopify Webstore' as the location for those orders.

                    // Filter out rows with no location name (prevents ghost rows)
                    if (!locationName) return;

                    rows.push({
                        id: uuidv4(),
                        invoice_no: row['Invoice No'] || '',
                        invoice_date: invoiceDate,
                        invoice_month: row['Invoice Month'] || '',
                        invoice_time: row['Invoice Time'] || '',
                        transaction_type: row['Sales Transaction Type (IV/SR/IR)'] || '',

                        order_channel_code: row['Order Business Channel Code'] || '',
                        order_channel_name: channelName, // Use our derived channel name
                        invoice_channel_code: row['Invoice Business Channel Code'] || '',
                        invoice_channel_name: row['Invoice Business Channel Name'] || '',
                        sub_channel_code: row['Invoice Business Sub Channel Code'] || '',
                        sub_channel_name: row['Invoice Business Sub Channel Name'] || '',

                        location_code: row['Invoice Associate Code '] || '',
                        location_name: locationName,
                        store_type: '',
                        city: row['Invoice Associate Town name'] || '',
                        state: row['Invoice Associate State name'] || '',

                        total_sales_qty: parseInt(row['Total Sales Qty'] || '0'),
                        unit_mrp: parseFloat(row['Unit MRP'] || '0'),
                        invoice_mrp_value: parseFloat(row['Invoice MRP Value'] || '0'),
                        invoice_discount_value: parseFloat(row['Invoice Discount Value'] || '0'),
                        invoice_discount_pct: parseFloat(row['Invoice Discount Percentage'] || '0'),
                        invoice_basic_value: parseFloat(row['Invoice Basic Value'] || '0'),
                        total_tax_pct: parseFloat(row['Total Tax %'] || '0'),
                        total_tax_amt: parseFloat(row['Total Tax Amt'] || '0'),
                        nett_invoice_value: parseFloat(row['Nett Invoice Value'] || '0'),

                        sales_person_code: row['Sales Person Code'] || '',
                        sales_person_name: row['Sales Person Name'] || '',

                        consumer_code: row['Consumer Code'] || '',
                        consumer_name: row['Consumer Name'] || '',
                        consumer_mobile: row['Consumer Mobile'] || '',

                        product_code: row['Product Code'] || '',
                        product_name: row['Product SKU Desc'] || '',
                        category_name: row['Category Name'] || '',
                        brand_name: row['Brand Name'] || '',
                        mh1_description: (row['MH1 Description'] || '').trim()
                    });
                } catch (error) {
                    console.error('Error processing row:', error);
                }
            })
            .on('end', async () => {
                try {
                    // Extract unique invoice numbers from the buffered rows
                    const uniqueInvoiceNos = [...new Set(rows.map(r => r.invoice_no).filter(n => n))];

                    console.log(`📋 Buffered ${rows.length} rows with ${uniqueInvoiceNos.length} unique invoices`);

                    // Delete existing invoices before inserting new data
                    if (uniqueInvoiceNos.length > 0) {
                        await deleteExistingInvoices(uniqueInvoiceNos, tableName);
                    }

                    // Insert all buffered rows in batches
                    let processedCount = 0;
                    const batchSize = 500;
                    for (let i = 0; i < rows.length; i += batchSize) {
                        const batch = rows.slice(i, i + batchSize);
                        const count = await insertBatch(batch, tableName);
                        processedCount += count;
                    }

                    console.log(`✅ Processed ${processedCount} invoice records`);
                    resolve(processedCount);
                } catch (error) {
                    console.error('Error during deduplication and insert:', error);
                    reject(error);
                }
            })
            .on('error', (error) => {
                console.error('CSV parsing error:', error);
                reject(error);
            });
    });
};

const processFootfallCSV = async (filePath: string): Promise<number> => {
    return new Promise((resolve, reject) => {
        const rows: any[] = [];
        let processedCount = 0;

        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row: any) => {
                try {
                    const rawDate = row['Date'] || '';
                    const date = parseInvoiceDate(rawDate);
                    const rawLocation = row['Store Name'] || '';

                    let locationName = '';
                    if (rawLocation.toLowerCase().includes('palladium')) locationName = 'Jacadi Palladium';
                    else if (rawLocation.toLowerCase().includes('asia') || rawLocation.toLowerCase().includes('moa')) locationName = 'Jacadi MOA';
                    else return;

                    const count = parseInt(row['Total IN'] || '0');
                    if (count > 0) {
                        rows.push({
                            id: uuidv4(),
                            date,
                            location_name: locationName,
                            footfall_count: count
                        });
                    }

                    if (rows.length >= 500) {
                        insertFootfallBatch(rows.splice(0, 500))
                            .then(c => processedCount += c)
                            .catch(console.error);
                    }
                } catch (e) { console.error(e); }
            })
            .on('end', async () => {
                if (rows.length > 0) await insertFootfallBatch(rows);
                console.log(`✅ Processed ${processedCount + rows.length} footfall records`);
                resolve(processedCount + rows.length);
            })
            .on('error', reject);
    });
};

const insertFootfallBatch = async (rows: any[]) => {
    if (rows.length === 0) return 0;
    const placeholders = rows.map(() => '(?, ?, ?, ?)').join(',');
    const values = rows.flatMap(r => [r.id, r.date, r.location_name, r.footfall_count]);
    await db.query(`INSERT INTO footfall (id, date, location_name, footfall_count) VALUES ${placeholders}`, values);
    return rows.length;
};

export { processFootfallCSV };

export const processEfficiencyCSV = async (filePath: string): Promise<number> => {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);

        if (lines.length < 2) {
            console.log('⚠️ DEBUG: CSV file too short (less than 2 lines)');
            return 0;
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const rowsToInsert: any[] = [];
        let count = 0;

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const row: any = {};
            headers.forEach((h, idx) => {
                row[h] = values[idx];
            });

            const rawLocationName = (row.location || '').trim();
            if (!rawLocationName || rawLocationName.toLowerCase() === 'total') continue;

            let locationName = rawLocationName;
            if (locationName.toUpperCase().includes('MALL OF ASIA') || locationName.toUpperCase().includes('MOA')) {
                locationName = 'Jacadi MOA';
            } else if (locationName.toUpperCase().includes('PALLADIUM')) {
                locationName = 'Jacadi Palladium';
            }

            const parsePct = (val: any) => {
                const s = (val || '0').replace('%', '');
                return parseFloat(s) || 0;
            };
            const parseNum = (val: any) => {
                const s = (val || '0').replace(/,/g, '');
                return parseInt(s) || 0;
            };

            const getVal = (keys: string[]) => {
                for (const k of keys) {
                    if (row[k.toLowerCase()] !== undefined) return row[k.toLowerCase()];
                }
                return '0';
            };

            rowsToInsert.push({
                id: uuidv4(),
                location_name: locationName,
                report_date: '2026-01-08',
                footfall: parseNum(getVal(['mtd footfall'])),
                conversion_pct: parsePct(getVal(['mtd conversion %'])),
                multies_pct: parsePct(getVal(['mtd multies'])),
                pm_footfall: parseNum(getVal(['pm footfall'])),
                pm_conversion_pct: parsePct(getVal(['pm conversion %'])),
                pm_multies_pct: parsePct(getVal(['pm multies']))
            });
            count++;
        }

        if (rowsToInsert.length > 0) {
            await insertEfficiencyBatch(rowsToInsert);
        }

        console.log(`✅ Processed ${count} efficiency records manually`);
        return count;
    } catch (error) {
        console.error('❌ Error in manual efficiency parsing:', error);
        return 0;
    }
};

const insertEfficiencyBatch = async (rows: any[]): Promise<number> => {
    if (rows.length === 0) return 0;
    const placeholders = rows.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
    const values: any[] = [];
    rows.forEach(row => {
        values.push(row.id, row.location_name, row.report_date, row.footfall, row.conversion_pct, row.multies_pct, row.pm_footfall, row.pm_conversion_pct, row.pm_multies_pct);
    });
    const sql = `INSERT OR REPLACE INTO location_efficiency (id, location_name, report_date, footfall, conversion_pct, multies_pct, pm_footfall, pm_conversion_pct, pm_multies_pct) VALUES ${placeholders}`;
    await db.query(sql, values);
    return rows.length;
};

const parseInvoiceDate = (dateStr: string): string => {
    // Parse dates like "10/01/2026" (DD/MM/YYYY) to YYYY-MM-DD
    if (!dateStr) return new Date().toISOString().split('T')[0];

    const parts = dateStr.split('/');
    if (parts.length === 3) {
        const [day, month, year] = parts;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return new Date().toISOString().split('T')[0];
};

const deleteExistingInvoices = async (invoiceNos: string[], tableName: string = 'sales_transactions'): Promise<number> => {
    if (invoiceNos.length === 0) return 0;

    let totalDeleted = 0;
    const batchSize = 500; // SQLite has a limit on the number of parameters

    for (let i = 0; i < invoiceNos.length; i += batchSize) {
        const batch = invoiceNos.slice(i, i + batchSize);
        const placeholders = batch.map(() => '?').join(',');
        const sql = `DELETE FROM ${tableName} WHERE invoice_no IN (${placeholders})`;

        const result = await db.query(sql, batch);
        const deletedCount = result.changes || 0;
        totalDeleted += deletedCount;
    }

    console.log(`🗑️  Deleted ${totalDeleted} existing invoice records to prevent duplication`);
    return totalDeleted;
};

const insertBatch = async (rows: any[], tableName: string = 'sales_transactions'): Promise<number> => {
    if (rows.length === 0) return 0;

    const placeholders = rows.map(() =>
        '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).join(',');

    const values: any[] = [];
    rows.forEach(row => {
        values.push(
            row.id, row.invoice_no, row.invoice_date, row.invoice_month, row.invoice_time, row.transaction_type,
            row.order_channel_code, row.order_channel_name, row.invoice_channel_code, row.invoice_channel_name,
            row.sub_channel_code, row.sub_channel_name, row.location_code, row.location_name,
            row.store_type, row.city, row.state, row.total_sales_qty, row.unit_mrp,
            row.invoice_mrp_value, row.invoice_discount_value, row.invoice_discount_pct,
            row.invoice_basic_value, row.total_tax_pct, row.total_tax_amt, row.nett_invoice_value,
            row.sales_person_code, row.sales_person_name, row.consumer_code, row.consumer_name,
            row.consumer_mobile, row.product_code, row.product_name, row.category_name, row.brand_name,
            row.mh1_description
        );
    });

    const sql = `
        INSERT INTO ${tableName} (
            id, invoice_no, invoice_date, invoice_month, invoice_time, transaction_type,
            order_channel_code, order_channel_name, invoice_channel_code, invoice_channel_name,
            sub_channel_code, sub_channel_name, location_code, location_name,
            store_type, city, state, total_sales_qty, unit_mrp,
            invoice_mrp_value, invoice_discount_value, invoice_discount_pct,
            invoice_basic_value, total_tax_pct, total_tax_amt, nett_invoice_value,
            sales_person_code, sales_person_name, consumer_code, consumer_name,
            consumer_mobile, product_code, product_name, category_name, brand_name, mh1_description
        ) VALUES ${placeholders}
    `;

    await db.query(sql, values);
    return rows.length;
};

// Helper to get date strings dynamically based on data availability
export const getReportingDates = async (requestedEndDate?: string, requestedStartDate?: string) => {
    let targetEndDateStr = requestedEndDate;

    // If no specific end date requested (or special 'latest' flag), get max date from DB
    if (!targetEndDateStr || targetEndDateStr === 'latest') {
        const res = await db.query("SELECT MAX(invoice_date) as max_date FROM sales_transactions");
        // If DB is empty, default to today
        targetEndDateStr = res.rows[0]?.max_date || new Date().toISOString().split('T')[0];
    }

    const endDate = new Date(targetEndDateStr!);

    // Determine Start Date
    // If user provided a start date, use it.
    // If not, default to MTD (1st of the End Date's month)
    let startDate: Date;
    if (requestedStartDate) {
        startDate = new Date(requestedStartDate);
    } else {
        startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    }

    // Calculate Duration in Days for PM Logic
    const durationTime = endDate.getTime() - startDate.getTime();

    // PM (Prior Month / Prior Period) Logic
    // Traditional Retail Logic: Same dates, previous month (e.g. Jan 5-10 vs Dec 5-10)
    // We will shift both Start and End back by 1 Month
    const startOfPM = new Date(startDate);
    startOfPM.setMonth(startOfPM.getMonth() - 1);

    const endOfPM = new Date(endDate);
    endOfPM.setMonth(endOfPM.getMonth() - 1);

    // YTD: Start of Fiscal Year (April 1st)
    // If Month is Jan, Feb, Mar (0,1,2), FY started prev year April. Else current year April.
    const currentMonth = endDate.getMonth();
    const fyYear = currentMonth < 3 ? endDate.getFullYear() - 1 : endDate.getFullYear();
    const startOfFY = new Date(fyYear, 3, 1); // April 1st

    // LY (Last Year) Logic: Shift both Start and End back by 12 Months
    const startOfPY = new Date(startDate);
    startOfPY.setFullYear(startOfPY.getFullYear() - 1);

    const endOfPY = new Date(endDate);
    endOfPY.setFullYear(endOfPY.getFullYear() - 1);

    const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    return {
        selectedDate: targetEndDateStr!, // Maps to "To Date"
        startOfMonth: formatDate(startDate), // Maps to "From Date"
        startOfPM: formatDate(startOfPM),
        endOfPM: formatDate(endOfPM),
        startOfPY: formatDate(startOfPY),
        endOfPY: formatDate(endOfPY),
        startOfFY: formatDate(startOfFY)
    };
};

export const getRetailPerformance = async (baseDate: string, location?: string | string[], startDate?: string, brand?: string | string[], category?: string | string[]) => {
    const dates = await getReportingDates(baseDate, startDate);

    const locations = Array.isArray(location) ? location : (location ? [location] : []);
    const brands = Array.isArray(brand) ? brand : (brand ? [brand] : []);
    const categories = Array.isArray(category) ? category : (category ? [category] : []);

    // Using nett_invoice_value as verified with Power BI screenshot (till 08-01-2026)
    const valCol = 'nett_invoice_value';

    const sql = `
        WITH InvoiceSummary AS (
            SELECT 
                s.location_name,
                s.invoice_no,
                s.invoice_date,
                s.order_channel_name,
                s.invoice_channel_name,
                s.transaction_type,
                MAX(s.sales_person_name) as sales_person_name,
                -- Check if invoice has ANY Sales item
                MAX(CASE WHEN s.mh1_description = 'Sales' THEN 1 ELSE 0 END) as is_sales_trx,
                SUM(CASE WHEN s.mh1_description = 'Sales' THEN total_sales_qty ELSE 0 END) as total_qty,
                SUM(${valCol}) as total_nett
            FROM sales_transactions s
            WHERE 1=1 
            ${locations.length ? `AND s.location_name IN (${locations.map(() => '?').join(',')})` : ''}
            ${brands.length ? `AND s.brand_name IN (${brands.map(() => '?').join(',')})` : ''}
            ${categories.length ? `AND s.category_name IN (${categories.map(() => '?').join(',')})` : ''}
            GROUP BY s.location_name, s.invoice_no, s.invoice_date, s.order_channel_name, s.invoice_channel_name, s.transaction_type
        )
        SELECT 
            location_name as Location,
            
            -- MTD Sales (Now Selected Range Sales)
            COALESCE(SUM(CASE 
                WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) 
                AND (order_channel_name != 'E-Commerce' AND (sales_person_name IS NULL OR sales_person_name NOT LIKE '%Whatsapp%'))
                THEN total_nett ELSE 0 END), 0) as MTD_RETAIL_SALE,

            COALESCE(SUM(CASE 
                WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) 
                AND (order_channel_name = 'E-Commerce' OR sales_person_name LIKE '%Whatsapp%')
                THEN total_nett ELSE 0 END), 0) as MTD_WHATSAPP_SALE,

            -- MTD TRX (Only positive net invoices AND MH1 Description = 'Sales')
            COALESCE(COUNT(DISTINCT CASE 
                WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) 
                AND (order_channel_name != 'E-Commerce' AND (sales_person_name IS NULL OR sales_person_name NOT LIKE '%Whatsapp%'))
                AND transaction_type IN ('IV', 'IR')
                AND is_sales_trx = 1
                THEN invoice_no ELSE NULL END), 0) as MTD_RETAIL_TRX,

            COALESCE(COUNT(DISTINCT CASE 
                WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) 
                AND (order_channel_name = 'E-Commerce' OR sales_person_name LIKE '%Whatsapp%')
                AND transaction_type IN ('IV', 'IR')
                AND is_sales_trx = 1
                THEN invoice_no ELSE NULL END), 0) as MTD_WHATSAPP_TRX,

            -- PM Sales (Same Period Last Month)
            COALESCE(SUM(CASE 
                WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?)
                AND (order_channel_name != 'E-Commerce' AND (sales_person_name IS NULL OR sales_person_name NOT LIKE '%Whatsapp%'))
                THEN total_nett ELSE 0 END), 0) as PM_RETAIL_SALE,

            COALESCE(SUM(CASE 
                WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?)
                AND (order_channel_name = 'E-Commerce' OR sales_person_name LIKE '%Whatsapp%')
                THEN total_nett ELSE 0 END), 0) as PM_WHATSAPP_SALE,

            -- PM TRX
            COALESCE(COUNT(DISTINCT CASE 
                WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?)
                AND (order_channel_name != 'E-Commerce' AND (sales_person_name IS NULL OR sales_person_name NOT LIKE '%Whatsapp%'))
                AND transaction_type IN ('IV', 'IR')
                AND is_sales_trx = 1
                THEN invoice_no ELSE NULL END), 0) as PM_RETAIL_TRX,

            COALESCE(COUNT(DISTINCT CASE 
                WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?)
                AND (order_channel_name = 'E-Commerce' OR sales_person_name LIKE '%Whatsapp%')
                AND transaction_type IN ('IV', 'IR')
                AND is_sales_trx = 1
                THEN invoice_no ELSE NULL END), 0) as PM_WHATSAPP_TRX,

            -- Net QTY (Move from Efficiency tab)
            COALESCE(SUM(CASE 
                WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) 
                THEN total_qty ELSE 0 END), 0) as MTD_QTY,

            COALESCE(SUM(CASE 
                WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) 
                THEN total_qty ELSE 0 END), 0) as PM_QTY,

            -- YTD (Fiscal Year) - Include all channels
            COALESCE(SUM(CASE 
                WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?)
                THEN total_nett ELSE 0 END), 0) as YTD_SALE,

            COALESCE(COUNT(DISTINCT CASE 
                WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?)
                AND transaction_type IN ('IV', 'IR')
                AND is_sales_trx = 1
                THEN invoice_no ELSE NULL END), 0) as YTD_TRX

        FROM InvoiceSummary
        GROUP BY location_name
        ORDER BY CASE location_name 
            WHEN 'Jacadi Palladium' THEN 1 
            WHEN 'Jacadi MOA' THEN 2 
            WHEN 'Shopify Webstore' THEN 3 
            ELSE 4 
        END
    `;

    const params: any[] = [];
    if (locations.length) params.push(...locations);
    if (brands.length) params.push(...brands);
    if (categories.length) params.push(...categories);

    params.push(
        dates.startOfMonth, dates.selectedDate, // MTD Retail Sale
        dates.startOfMonth, dates.selectedDate, // MTD WA Sale
        dates.startOfMonth, dates.selectedDate, // MTD Retail TRX
        dates.startOfMonth, dates.selectedDate, // MTD WA TRX
        dates.startOfPM, dates.endOfPM,         // PM Retail Sale
        dates.startOfPM, dates.endOfPM,         // PM WA Sale
        dates.startOfPM, dates.endOfPM,         // PM Retail TRX
        dates.startOfPM, dates.endOfPM,         // PM WA TRX
        dates.startOfMonth, dates.selectedDate, // MTD QTY
        dates.startOfPM, dates.endOfPM,         // PM QTY
        dates.startOfFY, dates.selectedDate,    // YTD Sale
        dates.startOfFY, dates.selectedDate     // YTD TRX
    );

    const result = await db.query(sql, params);
    return result.rows;
};

export const getWhatsappSalesBreakdown = async (baseDate: string, location?: string | string[], startDate?: string, brand?: string | string[], category?: string | string[]) => {
    const dates = await getReportingDates(baseDate, startDate);

    const locations = Array.isArray(location) ? location : (location ? [location] : []);
    const brands = Array.isArray(brand) ? brand : (brand ? [brand] : []);
    const categories = Array.isArray(category) ? category : (category ? [category] : []);

    const locFilter = locations.length ? `AND s.location_name IN (${locations.map(() => '?').join(',')})` : '';
    const brandFilter = brands.length ? `AND s.brand_name IN (${brands.map(() => '?').join(',')})` : '';
    const catFilter = categories.length ? `AND s.category_name IN (${categories.map(() => '?').join(',')})` : '';
    const valCol = 'nett_invoice_value';

    const sql = `
        SELECT 
            s.location_name as Location,
            
            -- MTD Retail vs Whatsapp (B&M Orders)
            COALESCE(SUM(CASE 
                WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) 
                AND (order_channel_name != 'E-Commerce' AND (sales_person_name IS NULL OR sales_person_name NOT LIKE '%Whatsapp%'))
                THEN ${valCol} ELSE 0 END), 0) as MTD_RETAIL_SALES,
            
            COALESCE(SUM(CASE 
                WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) 
                AND (order_channel_name = 'E-Commerce' OR sales_person_name LIKE '%Whatsapp%')
                THEN ${valCol} ELSE 0 END), 0) as MTD_WHATSAPP_SALES,
            
            -- PM Retail vs Whatsapp
            COALESCE(SUM(CASE 
                WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?)
                AND (order_channel_name != 'E-Commerce' AND (sales_person_name IS NULL OR sales_person_name NOT LIKE '%Whatsapp%'))
                THEN ${valCol} ELSE 0 END), 0) as PM_RETAIL_SALES,
            
            COALESCE(SUM(CASE 
                WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?)
                AND (order_channel_name = 'E-Commerce' OR sales_person_name LIKE '%Whatsapp%')
                THEN ${valCol} ELSE 0 END), 0) as PM_WHATSAPP_SALES

        FROM sales_transactions s
        WHERE s.location_name != 'Shopify Webstore' ${locFilter} ${brandFilter} ${catFilter}
        GROUP BY s.location_name
    `;

    const params: any[] = [
        dates.startOfMonth, dates.selectedDate, // MTD Retail
        dates.startOfMonth, dates.selectedDate, // MTD WA
        dates.startOfPM, dates.endOfPM,         // PM Retail
        dates.startOfPM, dates.endOfPM          // PM WA
    ];
    if (locations.length) params.push(...locations);
    if (brands.length) params.push(...brands);
    if (categories.length) params.push(...categories);

    const result = await db.query(sql, params);
    return result.rows;
};

export const getOmniChannelTmLm = async (baseDate: string, location?: string | string[], startDate?: string, brand?: string | string[], category?: string | string[]) => {
    const dates = await getReportingDates(baseDate, startDate);

    const locations = Array.isArray(location) ? location : (location ? [location] : []);
    const brands = Array.isArray(brand) ? brand : (brand ? [brand] : []);
    const categories = Array.isArray(category) ? category : (category ? [category] : []);

    const locFilter = locations.length ? `AND s.location_name IN (${locations.map(() => '?').join(',')})` : '';
    const brandFilter = brands.length ? `AND s.brand_name IN (${brands.map(() => '?').join(',')})` : '';
    const catFilter = categories.length ? `AND s.category_name IN (${categories.map(() => '?').join(',')})` : '';
    const valCol = 'nett_invoice_value';

    const sql = `
        SELECT 
            s.location_name as Location,
            
            -- MTD (Selected Range)
            COALESCE(SUM(CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND order_channel_name = 'E-Commerce' THEN ${valCol} ELSE 0 END), 0) as MTD_SALE,
            COALESCE(COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND order_channel_name = 'E-Commerce' AND transaction_type IN ('IV', 'IR') AND mh1_description = 'Sales' THEN invoice_no ELSE NULL END), 0) as MTD_TRX,
            COALESCE(SUM(CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND order_channel_name = 'E-Commerce' THEN total_sales_qty ELSE 0 END), 0) as MTD_UNITS,

            -- PM (Same Period Previous Month)
            COALESCE(SUM(CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND order_channel_name = 'E-Commerce' THEN ${valCol} ELSE 0 END), 0) as PM_SALE,
            COALESCE(COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND order_channel_name = 'E-Commerce' AND transaction_type IN ('IV', 'IR') AND mh1_description = 'Sales' THEN invoice_no ELSE NULL END), 0) as PM_TRX,
            
            COALESCE(SUM(CASE 
                WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?)
                AND order_channel_name = 'E-Commerce'
                THEN total_sales_qty ELSE 0 END), 0) as PM_UNITS

        FROM sales_transactions s
        WHERE 1=1 ${locFilter} ${brandFilter} ${catFilter}
        GROUP BY s.location_name
    `;

    const params: any[] = [
        dates.startOfMonth, dates.selectedDate, // MTD SALE
        dates.startOfMonth, dates.selectedDate, // MTD TRX
        dates.startOfMonth, dates.selectedDate, // MTD UNITS
        dates.startOfPM, dates.endOfPM,         // PM SALE
        dates.startOfPM, dates.endOfPM,         // PM TRX
        dates.startOfPM, dates.endOfPM          // PM UNITS
    ];
    if (locations.length) params.push(...locations);
    if (brands.length) params.push(...brands);
    if (categories.length) params.push(...categories);

    const result = await db.query(sql, params);
    return result.rows;
};

export const getOmniChannelDetails = async (baseDate: string, location?: string | string[], startDate?: string, brand?: string | string[], category?: string | string[]) => {
    const dates = await getReportingDates(baseDate, startDate);

    const locations = Array.isArray(location) ? location : (location ? [location] : []);
    const brands = Array.isArray(brand) ? brand : (brand ? [brand] : []);
    const categories = Array.isArray(category) ? category : (category ? [category] : []);

    const locFilter = locations.length ? `AND s.location_name IN (${locations.map(() => '?').join(',')})` : '';
    const brandFilter = brands.length ? `AND s.brand_name IN (${brands.map(() => '?').join(',')})` : '';
    const catFilter = categories.length ? `AND s.category_name IN (${categories.map(() => '?').join(',')})` : '';
    const valCol = 'nett_invoice_value';

    const sql = `
        SELECT 
            s.location_name as Location,
            
            COALESCE(SUM(CASE 
                WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?)
                AND order_channel_name = 'E-Commerce'
                THEN ${valCol} ELSE 0 END), 0) as MTD_SALE,
            
            COALESCE(COUNT(DISTINCT CASE 
                WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?)
                AND order_channel_name = 'E-Commerce'
                AND transaction_type IN ('IV', 'IR')
                AND mh1_description = 'Sales'
                THEN invoice_no ELSE NULL END), 0) as MTD_TRX,

            -- Prior Month (PM) - Added to match CSV
            COALESCE(SUM(CASE 
                WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?)
                AND order_channel_name = 'E-Commerce'
                THEN ${valCol} ELSE 0 END), 0) as PM_SALE,
            
            COALESCE(COUNT(DISTINCT CASE 
                WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?)
                AND order_channel_name = 'E-Commerce'
                AND transaction_type IN ('IV', 'IR')
                AND mh1_description = 'Sales'
                THEN invoice_no ELSE NULL END), 0) as PM_TRX,
            
            COALESCE(SUM(CASE 
                WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?)
                AND order_channel_name = 'E-Commerce'
                AND mh1_description = 'Sales'
                THEN total_sales_qty ELSE 0 END), 0) as MTD_UNITS,
            
            -- ATV
            CASE 
                WHEN COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND order_channel_name = 'E-Commerce' AND transaction_type IN ('IV', 'IR') AND mh1_description = 'Sales' THEN invoice_no ELSE NULL END) > 0
                THEN SUM(CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND order_channel_name = 'E-Commerce' THEN ${valCol} ELSE 0 END) / 
                     COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND order_channel_name = 'E-Commerce' AND transaction_type IN ('IV', 'IR') AND mh1_description = 'Sales' THEN invoice_no ELSE NULL END)
                ELSE 0 
            END as MTD_ATV,
            
            -- Basket Size
            CASE 
                WHEN COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND order_channel_name = 'E-Commerce' AND transaction_type IN ('IV', 'IR') AND mh1_description = 'Sales' THEN invoice_no ELSE NULL END) > 0
                THEN CAST(SUM(CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND order_channel_name = 'E-Commerce' AND mh1_description = 'Sales' THEN total_sales_qty ELSE 0 END) AS REAL) / 
                     COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND order_channel_name = 'E-Commerce' AND transaction_type IN ('IV', 'IR') AND mh1_description = 'Sales' THEN invoice_no ELSE NULL END)
                ELSE 0 
            END as MTD_BASKET_SIZE

        FROM sales_transactions s
        WHERE 1=1 ${locFilter} ${brandFilter} ${catFilter}
        GROUP BY s.location_name
    `;

    const params: any[] = [
        dates.startOfMonth, dates.selectedDate, // Sale
        dates.startOfMonth, dates.selectedDate, // TRX

        dates.startOfPM, dates.endOfPM, // PM Sale
        dates.startOfPM, dates.endOfPM, // PM TRX

        dates.startOfMonth, dates.selectedDate, // Units

        dates.startOfMonth, dates.selectedDate, // ATV (TRX)
        dates.startOfMonth, dates.selectedDate, // ATV (Sale)
        dates.startOfMonth, dates.selectedDate, // ATV (TRX)

        dates.startOfMonth, dates.selectedDate, // Basket (TRX)
        dates.startOfMonth, dates.selectedDate, // Basket (Qty)
        dates.startOfMonth, dates.selectedDate  // Basket (TRX)
    ];
    if (locations.length) params.push(...locations);
    if (brands.length) params.push(...brands);
    if (categories.length) params.push(...categories);

    const result = await db.query(sql, params);
    return result.rows;
};

export const getRetailOmniTotal = async (baseDate: string, location?: string | string[], startDate?: string, brand?: string | string[], category?: string | string[]) => {
    const dates = await getReportingDates(baseDate, startDate);

    const locations = Array.isArray(location) ? location : (location ? [location] : []);
    const brands = Array.isArray(brand) ? brand : (brand ? [brand] : []);
    const categories = Array.isArray(category) ? category : (category ? [category] : []);

    const locFilter = locations.length ? `AND s.location_name IN (${locations.map(() => '?').join(',')})` : '';
    const brandFilter = brands.length ? `AND s.brand_name IN (${brands.map(() => '?').join(',')})` : '';
    const catFilter = categories.length ? `AND s.category_name IN (${categories.map(() => '?').join(',')})` : '';
    const valCol = 'nett_invoice_value';

    const sql = `
        SELECT 
            s.location_name as Location,
            
            -- MTD
            COALESCE(SUM(CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) THEN ${valCol} ELSE 0 END), 0) as MTD_SALE,
            COALESCE(COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND transaction_type IN ('IV', 'IR') AND mh1_description = 'Sales' THEN invoice_no ELSE NULL END), 0) as MTD_TRX,

            -- PM (Same Period)
            COALESCE(SUM(CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) THEN ${valCol} ELSE 0 END), 0) as PM_SALE,
            COALESCE(COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND transaction_type IN ('IV', 'IR') AND mh1_description = 'Sales' THEN invoice_no ELSE NULL END), 0) as PM_TRX,

            -- YTD (Fiscal Year)
            COALESCE(SUM(CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) THEN ${valCol} ELSE 0 END), 0) as YTD_SALE,
            COALESCE(COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND transaction_type IN ('IV', 'IR') AND mh1_description = 'Sales' THEN invoice_no ELSE NULL END), 0) as YTD_TRX

        FROM sales_transactions s
        WHERE 1=1 ${locFilter} ${brandFilter} ${catFilter}
        GROUP BY s.location_name
    `;

    const params: any[] = [
        dates.startOfMonth, dates.selectedDate, // MTD
        dates.startOfMonth, dates.selectedDate, // MTD
        dates.startOfPM, dates.endOfPM,         // PM
        dates.startOfPM, dates.endOfPM,         // PM
        dates.startOfFY, dates.selectedDate,    // YTD
        dates.startOfFY, dates.selectedDate     // YTD
    ];
    if (locations.length) params.push(...locations);
    if (brands.length) params.push(...brands);
    if (categories.length) params.push(...categories);

    const result = await db.query(sql, params);
    return result.rows;
};

export const getDashboardSummary = async (baseDate: string, location?: string | string[], startDate?: string, brand?: string | string[], category?: string | string[]) => {
    const dates = await getReportingDates(baseDate, startDate);

    const locations = Array.isArray(location) ? location : (location ? [location] : []);
    const brands = Array.isArray(brand) ? brand : (brand ? [brand] : []);
    const categories = Array.isArray(category) ? category : (category ? [category] : []);

    const locFilter = locations.length ? `AND location_name IN (${locations.map(() => '?').join(',')})` : '';
    const brandFilter = brands.length ? `AND brand_name IN (${brands.map(() => '?').join(',')})` : '';
    const catFilter = categories.length ? `AND category_name IN (${categories.map(() => '?').join(',')})` : '';
    const valCol = 'nett_invoice_value';

    const totalSalesResult = await db.query(`
        SELECT 
            -- Selected Range (MTD)
            COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND transaction_type IN ('IV', 'IR') AND mh1_description = 'Sales' THEN invoice_no ELSE NULL END) as total_transactions,
            SUM(CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) THEN ${valCol} ELSE 0 END) as total_revenue,
            
            -- Previous Month Same Period
            COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND transaction_type IN ('IV', 'IR') AND mh1_description = 'Sales' THEN invoice_no ELSE NULL END) as pm_transactions,
            SUM(CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) THEN ${valCol} ELSE 0 END) as pm_revenue,

            COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) THEN location_name ELSE NULL END) as total_locations
        FROM sales_transactions
        WHERE 1=1 ${locFilter} ${brandFilter} ${catFilter}
    `, [
        dates.startOfMonth, dates.selectedDate, // Total TRX range
        dates.startOfMonth, dates.selectedDate, // Total Rev range
        dates.startOfPM, dates.endOfPM,         // PM TRX range
        dates.startOfPM, dates.endOfPM,         // PM Rev range
        dates.startOfMonth, dates.selectedDate, // Total Locs range
        ...locations,
        ...brands,
        ...categories
    ]);

    const row = totalSalesResult.rows[0];
    return {
        ...row,
        avg_transaction_value: row.total_transactions > 0 ? row.total_revenue / row.total_transactions : 0,
        pm_atv: row.pm_transactions > 0 ? row.pm_revenue / row.pm_transactions : 0
    };
};

export const getLocations = async (brand?: string | string[]) => {
    const brands = Array.isArray(brand) ? brand : (brand ? [brand] : []);
    const brandFilter = brands.length ? `WHERE brand_name IN (${brands.map(() => '?').join(',')})` : '';
    const sql = `SELECT DISTINCT location_name FROM sales_transactions ${brandFilter} ORDER BY location_name ASC`;
    const result = await db.query(sql, brands);
    return result.rows.map((row: any) => row.location_name);
};

export const getLatestInvoiceDate = async (): Promise<string> => {
    const res = await db.query("SELECT MAX(invoice_date) as max_date FROM sales_transactions");
    return res.rows[0]?.max_date || new Date().toISOString().split('T')[0];
};

export const getRetailEfficiency = async (baseDate: string, location?: string | string[], startDate?: string, brand?: string | string[], category?: string | string[]) => {
    const dates = await getReportingDates(baseDate, startDate);
    const locations = Array.isArray(location) ? location : (location ? [location] : []);
    const brands = Array.isArray(brand) ? brand : (brand ? [brand] : []);
    const categories = Array.isArray(category) ? category : (category ? [category] : []);
    const valCol = 'nett_invoice_value';

    const sql = `
        WITH InvoiceSummary AS (
            SELECT 
                s.location_name,
                s.invoice_no,
                s.invoice_date,
                s.transaction_type,
                SUM(CASE WHEN mh1_description = 'Sales' THEN ${valCol} ELSE 0 END) as total_nett,
                SUM(CASE WHEN mh1_description = 'Sales' THEN total_sales_qty ELSE 0 END) as total_qty,
                SUM(CASE WHEN ${valCol} > 0 AND mh1_description = 'Sales' THEN total_sales_qty ELSE 0 END) as total_positive_qty,
                MAX(CASE WHEN mh1_description = 'Sales' THEN 1 ELSE 0 END) as is_sales_trx
            FROM sales_transactions s
            WHERE 1=1 
            ${locations.length ? `AND s.location_name IN (${locations.map(() => '?').join(',')})` : ''}
            ${brands.length ? `AND s.brand_name IN (${brands.map(() => '?').join(',')})` : ''}
            ${categories.length ? `AND s.category_name IN (${categories.map(() => '?').join(',')})` : ''}
            GROUP BY s.location_name, s.invoice_no, s.invoice_date, s.transaction_type
        )
        SELECT 
            s.location_name as Location,
            
            -- Dynamic Conversion % (TRX / Footfall * 100)
            CASE 
                WHEN (SELECT COALESCE(SUM(footfall_count), 0) FROM footfall f WHERE f.location_name = s.location_name AND DATE(f.date) >= DATE(?) AND DATE(f.date) <= DATE(?)) > 0
                THEN (CAST(COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND transaction_type IN ('IV', 'IR') AND is_sales_trx = 1 THEN invoice_no ELSE NULL END) AS REAL) * 100.0) / 
                     (SELECT COALESCE(SUM(footfall_count), 0) FROM footfall f WHERE f.location_name = s.location_name AND DATE(f.date) >= DATE(?) AND DATE(f.date) <= DATE(?))
                ELSE 0 
            END as MTD_CONVERSION_PCT,

            CASE 
                WHEN (SELECT COALESCE(SUM(footfall_count), 0) FROM footfall f WHERE f.location_name = s.location_name AND DATE(f.date) >= DATE(?) AND DATE(f.date) <= DATE(?)) > 0
                THEN (CAST(COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND transaction_type IN ('IV', 'IR') AND is_sales_trx = 1 THEN invoice_no ELSE NULL END) AS REAL) * 100.0) / 
                     (SELECT COALESCE(SUM(footfall_count), 0) FROM footfall f WHERE f.location_name = s.location_name AND DATE(f.date) >= DATE(?) AND DATE(f.date) <= DATE(?))
                ELSE 0 
            END as PM_CONVERSION_PCT,
            
            -- ATV (Total Nett / Positive TRX)
            CASE 
                WHEN COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND transaction_type IN ('IV', 'IR') AND is_sales_trx = 1 THEN invoice_no ELSE NULL END) > 0
                THEN SUM(CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) THEN total_nett ELSE 0 END) / 
                     COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND transaction_type IN ('IV', 'IR') AND is_sales_trx = 1 THEN invoice_no ELSE NULL END)
                ELSE 0 
            END as MTD_ATV,

            CASE 
                WHEN COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND transaction_type IN ('IV', 'IR') AND is_sales_trx = 1 THEN invoice_no ELSE NULL END) > 0
                THEN SUM(CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) THEN total_nett ELSE 0 END) / 
                     COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND transaction_type IN ('IV', 'IR') AND is_sales_trx = 1 THEN invoice_no ELSE NULL END)
                ELSE 0 
            END as PM_ATV,

            -- Basket Size (Total Net Qty / Positive TRX)
            CASE 
                WHEN COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND transaction_type IN ('IV', 'IR') AND is_sales_trx = 1 THEN invoice_no ELSE NULL END) > 0
                THEN CAST(SUM(CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) THEN total_qty ELSE 0 END) AS REAL) / 
                     COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND transaction_type IN ('IV', 'IR') AND is_sales_trx = 1 THEN invoice_no ELSE NULL END)
                ELSE 0 
            END as MTD_BASKET_SIZE,

            CASE 
                WHEN COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND transaction_type IN ('IV', 'IR') AND is_sales_trx = 1 THEN invoice_no ELSE NULL END) > 0
                THEN CAST(SUM(CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) THEN total_qty ELSE 0 END) AS REAL) / 
                     COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND transaction_type IN ('IV', 'IR') AND is_sales_trx = 1 THEN invoice_no ELSE NULL END)
                ELSE 0 
            END as PM_BASKET_SIZE,

            -- Derived Multies % (TRX with >1 qty / Total Pos TRX)
            CASE 
                WHEN COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND transaction_type IN ('IV', 'IR') AND is_sales_trx = 1 THEN invoice_no ELSE NULL END) > 0
                THEN (CAST(COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND transaction_type IN ('IV', 'IR') AND total_qty > 1 AND is_sales_trx = 1 THEN invoice_no ELSE NULL END) AS REAL) * 100) / 
                     COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND transaction_type IN ('IV', 'IR') AND is_sales_trx = 1 THEN invoice_no ELSE NULL END)
                ELSE 0 
            END as MTD_MULTIES_PCT,

            CASE 
                WHEN COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND transaction_type IN ('IV', 'IR') AND is_sales_trx = 1 THEN invoice_no ELSE NULL END) > 0
                THEN (CAST(COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND transaction_type IN ('IV', 'IR') AND total_qty > 1 AND is_sales_trx = 1 THEN invoice_no ELSE NULL END) AS REAL) * 100) / 
                     COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND transaction_type IN ('IV', 'IR') AND is_sales_trx = 1 THEN invoice_no ELSE NULL END)
                ELSE 0 
            END as PM_MULTIES_PCT,

            -- Dynamic Footfall from granular table provided by user
            (SELECT COALESCE(SUM(footfall_count), 0) FROM footfall f WHERE f.location_name = s.location_name AND DATE(f.date) >= DATE(?) AND DATE(f.date) <= DATE(?)) as MTD_FOOTFALL,
            (SELECT COALESCE(SUM(footfall_count), 0) FROM footfall f WHERE f.location_name = s.location_name AND DATE(f.date) >= DATE(?) AND DATE(f.date) <= DATE(?)) as PM_FOOTFALL,

            -- RAW COUNTERS for Frontend Totals Calculation
            -- MTD
            COALESCE(SUM(CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) THEN total_nett ELSE 0 END), 0) as MTD_RAW_SALE,
            COALESCE(COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND transaction_type IN ('IV', 'IR') AND is_sales_trx = 1 THEN invoice_no ELSE NULL END), 0) as MTD_RAW_TRX,
            COALESCE(SUM(CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) THEN total_qty ELSE 0 END), 0) as MTD_RAW_QTY,
            COALESCE(COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND transaction_type IN ('IV', 'IR') AND total_qty > 1 AND is_sales_trx = 1 THEN invoice_no ELSE NULL END), 0) as MTD_RAW_MULTI_TRX,

            -- PM
            COALESCE(SUM(CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) THEN total_nett ELSE 0 END), 0) as PM_RAW_SALE,
            COALESCE(COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND transaction_type IN ('IV', 'IR') AND is_sales_trx = 1 THEN invoice_no ELSE NULL END), 0) as PM_RAW_TRX,
            COALESCE(SUM(CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) THEN total_qty ELSE 0 END), 0) as PM_RAW_QTY,
            COALESCE(COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND transaction_type IN ('IV', 'IR') AND total_qty > 1 AND is_sales_trx = 1 THEN invoice_no ELSE NULL END), 0) as PM_RAW_MULTI_TRX

        FROM InvoiceSummary s
        LEFT JOIN location_efficiency e ON s.location_name = e.location_name AND e.report_date = DATE(?)
        GROUP BY s.location_name
    `;

    const params: any[] = [];
    if (locations.length) params.push(...locations);
    if (brands.length) params.push(...brands);
    if (categories.length) params.push(...categories);

    // MTD Conversion % (6 params)
    // 1. Check Footfall > 0 (2 params)
    params.push(dates.startOfMonth, dates.selectedDate);
    // 2. Numerator (Invoice Count) (2 params)
    params.push(dates.startOfMonth, dates.selectedDate);
    // 3. Denominator (Footfall Sum) (2 params)
    params.push(dates.startOfMonth, dates.selectedDate);

    // PM Conversion % (6 params)
    // 1. Check Footfall > 0 (2 params)
    params.push(dates.startOfPM, dates.endOfPM);
    // 2. Numerator (Invoice Count) (2 params)
    params.push(dates.startOfPM, dates.endOfPM);
    // 3. Denominator (Footfall Sum) (2 params)
    params.push(dates.startOfPM, dates.endOfPM);

    // MTD ATV (6 params)
    // 1. Check TRX > 0
    params.push(dates.startOfMonth, dates.selectedDate);
    // 2. Sum Nett
    params.push(dates.startOfMonth, dates.selectedDate);
    // 3. Count TRX
    params.push(dates.startOfMonth, dates.selectedDate);

    // PM ATV (6 params)
    params.push(dates.startOfPM, dates.endOfPM);
    params.push(dates.startOfPM, dates.endOfPM);
    params.push(dates.startOfPM, dates.endOfPM);

    // MTD Basket Size (6 params)
    // 1. Check TRX > 0
    params.push(dates.startOfMonth, dates.selectedDate);
    // 2. Sum Qty
    params.push(dates.startOfMonth, dates.selectedDate);
    // 3. Count TRX
    params.push(dates.startOfMonth, dates.selectedDate);

    // PM Basket Size (6 params)
    params.push(dates.startOfPM, dates.endOfPM);
    params.push(dates.startOfPM, dates.endOfPM);
    params.push(dates.startOfPM, dates.endOfPM);

    // MTD Multies % (6 params)
    // 1. Check TRX > 0
    params.push(dates.startOfMonth, dates.selectedDate);
    // 2. Count Multi TRX
    params.push(dates.startOfMonth, dates.selectedDate);
    // 3. Count Total TRX
    params.push(dates.startOfMonth, dates.selectedDate);

    // PM Multies % (6 params)
    // 1. Check TRX > 0
    params.push(dates.startOfPM, dates.endOfPM);
    // 2. Count Multi TRX
    params.push(dates.startOfPM, dates.endOfPM);
    // 3. Count Total TRX
    params.push(dates.startOfPM, dates.endOfPM);

    // Footfall (MTD: 2 params)
    params.push(dates.startOfMonth, dates.selectedDate);
    // Footfall (PM: 2 params)
    params.push(dates.startOfPM, dates.endOfPM);

    // RAW MTD (8 params)
    // Sale (2)
    params.push(dates.startOfMonth, dates.selectedDate);
    // Trx (2)
    params.push(dates.startOfMonth, dates.selectedDate);
    // Qty (2)
    params.push(dates.startOfMonth, dates.selectedDate);
    // Multi (2)
    params.push(dates.startOfMonth, dates.selectedDate);

    // RAW PM (8 params)
    // Sale (2)
    params.push(dates.startOfPM, dates.endOfPM);
    // Trx (2)
    params.push(dates.startOfPM, dates.endOfPM);
    // Qty (2)
    params.push(dates.startOfPM, dates.endOfPM);
    // Multi (2)
    params.push(dates.startOfPM, dates.endOfPM);

    // Join Date (1 param)
    params.push(dates.selectedDate);


    const result = await db.query(sql, params);
    return result.rows;
};

export const getBrands = async () => {
    const sql = `SELECT DISTINCT brand_name FROM sales_transactions WHERE brand_name IS NOT NULL AND brand_name != '' ORDER BY brand_name`;
    const result = await db.query(sql);
    return result.rows.map((r: any) => r.brand_name);
};

export const getCategories = async (brand?: string | string[], location?: string | string[]) => {
    const brands = Array.isArray(brand) ? brand : (brand ? [brand] : []);
    const locations = Array.isArray(location) ? location : (location ? [location] : []);

    let filters = [];
    let params = [];

    if (brands.length) {
        filters.push(`brand_name IN (${brands.map(() => '?').join(',')})`);
        params.push(...brands);
    }
    if (locations.length) {
        filters.push(`location_name IN (${locations.map(() => '?').join(',')})`);
        params.push(...locations);
    }

    const filterStr = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const sql = `SELECT DISTINCT category_name FROM sales_transactions ${filterStr} WHERE category_name IS NOT NULL AND category_name != '' ORDER BY category_name`;
    // Note: SELECT DISTINCT from transactions with WHERE 1=1 is safer
    const finalSql = `SELECT DISTINCT category_name FROM sales_transactions ${filters.length ? 'WHERE ' + filters.join(' AND ') : 'WHERE 1=1'} AND category_name IS NOT NULL AND category_name != '' ORDER BY category_name`;

    const result = await db.query(finalSql, params);
    return result.rows.map((r: any) => r.category_name);
};

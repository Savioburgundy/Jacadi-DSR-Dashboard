import { getCollection, getDB } from '../config/mongodb';
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

const parseInvoiceDate = (dateStr: string): string => {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        const [day, month, year] = parts;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return new Date().toISOString().split('T')[0];
};

export const processInvoiceCSV = async (filePath: string): Promise<number> => {
    return new Promise((resolve, reject) => {
        const rows: any[] = [];

        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row: InvoiceRow) => {
                try {
                    const invoiceDate = parseInvoiceDate(row['Invoice Date']);
                    const rawOrderAssociate = (row['Order Associate Name'] || '').trim();

                    let locationName = '';
                    let channelName = 'Brick and Mortar';

                    if (rawOrderAssociate.toLowerCase().includes('shopify') || 
                        rawOrderAssociate.toLowerCase().includes('webstore') || 
                        rawOrderAssociate.toLowerCase().includes('website')) {
                        channelName = 'E-Commerce';
                    }

                    if (rawOrderAssociate.toLowerCase().includes('palladium')) {
                        locationName = 'Jacadi Palladium';
                    } else if (rawOrderAssociate.toLowerCase().includes('asia') || 
                               rawOrderAssociate.toLowerCase().includes('moa')) {
                        locationName = 'Jacadi MOA';
                    } else if (rawOrderAssociate.toLowerCase().includes('shopify') || 
                               rawOrderAssociate.toLowerCase().includes('webstore') || 
                               rawOrderAssociate.toLowerCase().includes('website')) {
                        locationName = 'Shopify Webstore';
                    }

                    if (!locationName) {
                        const r = row as any;
                        const rawInvoiceAssociateName = (r['Invoice Associate Name'] || '').trim().toLowerCase();
                        const rawInvoiceAssociateShort = (r['Invoice Associate Short Name'] || '').trim().toLowerCase();
                        const rawInvoiceCode = (r['Invoice Associate Code '] || r['Invoice Associate Code'] || '').trim().toUpperCase();

                        if (rawInvoiceAssociateName.includes('palladium') || 
                            rawInvoiceAssociateShort.includes('palladium') || 
                            rawInvoiceAssociateShort.includes('paddle') || 
                            rawInvoiceCode.includes('PALLADIUM') || 
                            rawInvoiceCode.includes('PHO')) {
                            locationName = 'Jacadi Palladium';
                        } else if (rawInvoiceAssociateName.includes('moa') || 
                                   rawInvoiceAssociateName.includes('asia') || 
                                   rawInvoiceAssociateShort.includes('moa') || 
                                   rawInvoiceAssociateShort.includes('asia') || 
                                   rawInvoiceCode.includes('JPBLRMOA')) {
                            locationName = 'Jacadi MOA';
                        }
                    }

                    if (!locationName) return;

                    rows.push({
                        invoice_no: row['Invoice No'] || '',
                        invoice_date: invoiceDate,
                        invoice_month: row['Invoice Month'] || '',
                        invoice_time: row['Invoice Time'] || '',
                        transaction_type: row['Sales Transaction Type (IV/SR/IR)'] || '',
                        order_channel_code: row['Order Business Channel Code'] || '',
                        order_channel_name: channelName,
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
                        mh1_description: (row['MH1 Description'] || '').trim(),
                        created_at: new Date()
                    });
                } catch (error) {
                    console.error('Error processing row:', error);
                }
            })
            .on('end', async () => {
                try {
                    const uniqueInvoiceNos = [...new Set(rows.map(r => r.invoice_no).filter(n => n))];
                    console.log(`📋 Buffered ${rows.length} rows with ${uniqueInvoiceNos.length} unique invoices`);

                    // Delete existing invoices
                    if (uniqueInvoiceNos.length > 0) {
                        const salesTx = getCollection('sales_transactions');
                        const deleteResult = await salesTx.deleteMany({ invoice_no: { $in: uniqueInvoiceNos } });
                        console.log(`🗑️  Deleted ${deleteResult.deletedCount} existing invoice records`);
                    }

                    // Insert new records
                    if (rows.length > 0) {
                        const salesTx = getCollection('sales_transactions');
                        await salesTx.insertMany(rows);
                    }

                    console.log(`✅ Processed ${rows.length} invoice records`);
                    resolve(rows.length);
                } catch (error) {
                    console.error('Error during insert:', error);
                    reject(error);
                }
            })
            .on('error', (error) => {
                console.error('CSV parsing error:', error);
                reject(error);
            });
    });
};

export const processFootfallCSV = async (filePath: string): Promise<number> => {
    return new Promise((resolve, reject) => {
        const dailyTotals: Map<string, { location_name: string, footfall_count: number }> = new Map();

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
                        // Aggregate by date + location (sum hourly data)
                        const key = `${date}_${locationName}`;
                        if (dailyTotals.has(key)) {
                            const existing = dailyTotals.get(key)!;
                            existing.footfall_count += count;
                        } else {
                            dailyTotals.set(key, {
                                location_name: locationName,
                                footfall_count: count
                            });
                        }
                    }
                } catch (e) { console.error(e); }
            })
            .on('end', async () => {
                try {
                    const rows: any[] = [];
                    for (const [key, value] of dailyTotals) {
                        const [date] = key.split('_');
                        rows.push({
                            date,
                            location_name: value.location_name,
                            footfall_count: value.footfall_count
                        });
                    }
                    
                    if (rows.length > 0) {
                        const footfall = getCollection('footfall');
                        
                        // Upsert: Update if exists for that date+location, otherwise insert
                        for (const row of rows) {
                            await footfall.updateOne(
                                { date: row.date, location_name: row.location_name },
                                { $set: row },
                                { upsert: true }
                            );
                        }
                    }
                    console.log(`✅ Processed ${rows.length} footfall records (daily aggregated)`);
                    resolve(rows.length);
                } catch (error) {
                    reject(error);
                }
            })
            .on('error', reject);
    });
};

export const processEfficiencyCSV = async (filePath: string): Promise<number> => {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);

        if (lines.length < 2) return 0;

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const rowsToInsert: any[] = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const row: any = {};
            headers.forEach((h, idx) => { row[h] = values[idx]; });

            const rawLocationName = (row.location || '').trim();
            if (!rawLocationName || rawLocationName.toLowerCase() === 'total') continue;

            let locationName = rawLocationName;
            if (locationName.toUpperCase().includes('MALL OF ASIA') || locationName.toUpperCase().includes('MOA')) {
                locationName = 'Jacadi MOA';
            } else if (locationName.toUpperCase().includes('PALLADIUM')) {
                locationName = 'Jacadi Palladium';
            }

            const parsePct = (val: any) => parseFloat((val || '0').replace('%', '')) || 0;
            const parseNum = (val: any) => parseInt((val || '0').replace(/,/g, '')) || 0;

            const getVal = (keys: string[]) => {
                for (const k of keys) {
                    if (row[k.toLowerCase()] !== undefined) return row[k.toLowerCase()];
                }
                return '0';
            };

            rowsToInsert.push({
                location_name: locationName,
                report_date: new Date().toISOString().split('T')[0],
                footfall: parseNum(getVal(['mtd footfall'])),
                conversion_pct: parsePct(getVal(['mtd conversion %'])),
                multies_pct: parsePct(getVal(['mtd multies'])),
                pm_footfall: parseNum(getVal(['pm footfall'])),
                pm_conversion_pct: parsePct(getVal(['pm conversion %'])),
                pm_multies_pct: parsePct(getVal(['pm multies']))
            });
        }

        if (rowsToInsert.length > 0) {
            const efficiency = getCollection('location_efficiency');
            for (const row of rowsToInsert) {
                await efficiency.updateOne(
                    { location_name: row.location_name, report_date: row.report_date },
                    { $set: row },
                    { upsert: true }
                );
            }
        }

        console.log(`✅ Processed ${rowsToInsert.length} efficiency records`);
        return rowsToInsert.length;
    } catch (error) {
        console.error('❌ Error in efficiency parsing:', error);
        return 0;
    }
};

// Helper to get date strings
export const getReportingDates = async (requestedEndDate?: string, requestedStartDate?: string) => {
    let targetEndDateStr = requestedEndDate;

    if (!targetEndDateStr || targetEndDateStr === 'latest') {
        const salesTx = getCollection('sales_transactions');
        const result = await salesTx.find({}).sort({ invoice_date: -1 }).limit(1).toArray();
        targetEndDateStr = result[0]?.invoice_date || new Date().toISOString().split('T')[0];
    }

    const endDate = new Date(targetEndDateStr!);
    let startDate: Date;
    if (requestedStartDate) {
        startDate = new Date(requestedStartDate);
    } else {
        startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    }

    const startOfPM = new Date(startDate);
    startOfPM.setMonth(startOfPM.getMonth() - 1);
    const endOfPM = new Date(endDate);
    endOfPM.setMonth(endOfPM.getMonth() - 1);

    const currentMonth = endDate.getMonth();
    const fyYear = currentMonth < 3 ? endDate.getFullYear() - 1 : endDate.getFullYear();
    const startOfFY = new Date(fyYear, 3, 1);

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
        selectedDate: targetEndDateStr!,
        startOfMonth: formatDate(startDate),
        startOfPM: formatDate(startOfPM),
        endOfPM: formatDate(endOfPM),
        startOfPY: formatDate(startOfPY),
        endOfPY: formatDate(endOfPY),
        startOfFY: formatDate(startOfFY)
    };
};

// Dashboard data functions - MongoDB aggregations
export const getRetailPerformance = async (
    baseDate: string, 
    location?: string | string[], 
    startDate?: string, 
    brand?: string | string[], 
    category?: string | string[]
) => {
    const dates = await getReportingDates(baseDate, startDate);
    const locations = Array.isArray(location) ? location : (location ? [location] : []);
    const brands = Array.isArray(brand) ? brand : (brand ? [brand] : []);
    const categories = Array.isArray(category) ? category : (category ? [category] : []);

    const salesTx = getCollection('sales_transactions');
    
    // Build match filter
    const matchFilter: any = {};
    if (locations.length) matchFilter.location_name = { $in: locations };
    if (brands.length) matchFilter.brand_name = { $in: brands };
    if (categories.length) matchFilter.category_name = { $in: categories };

    const pipeline = [
        { $match: matchFilter },
        {
            // First group by invoice_no to aggregate all line items
            $group: {
                _id: {
                    location_name: '$location_name',
                    invoice_no: '$invoice_no',
                    invoice_date: '$invoice_date',
                    order_channel_name: '$order_channel_name',
                    transaction_type: '$transaction_type'
                },
                // Check if ANY line item has mh1_description = 'Sales'
                is_sales_trx: { $max: { $cond: [{ $eq: ['$mh1_description', 'Sales'] }, 1, 0] } },
                // Check if ANY sales_person contains 'Whatsapp'
                is_whatsapp: { $max: { $cond: [{ $regexMatch: { input: { $ifNull: ['$sales_person_name', ''] }, regex: /Whatsapp/i } }, 1, 0] } },
                total_qty: { $sum: { $cond: [{ $eq: ['$mh1_description', 'Sales'] }, '$total_sales_qty', 0] } },
                total_nett: { $sum: '$nett_invoice_value' }
            }
        },
        {
            $group: {
                _id: '$_id.location_name',
                // MTD calculations
                MTD_RETAIL_SALE: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $gte: ['$_id.invoice_date', dates.startOfMonth] },
                                    { $lte: ['$_id.invoice_date', dates.selectedDate] },
                                    { $ne: ['$_id.order_channel_name', 'E-Commerce'] },
                                    { $eq: ['$is_whatsapp', 0] }
                                ]
                            },
                            '$total_nett',
                            0
                        ]
                    }
                },
                MTD_WHATSAPP_SALE: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $gte: ['$_id.invoice_date', dates.startOfMonth] },
                                    { $lte: ['$_id.invoice_date', dates.selectedDate] },
                                    {
                                        $or: [
                                            { $eq: ['$_id.order_channel_name', 'E-Commerce'] },
                                            { $eq: ['$is_whatsapp', 1] }
                                        ]
                                    }
                                ]
                            },
                            '$total_nett',
                            0
                        ]
                    }
                },
                MTD_RETAIL_TRX: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $gte: ['$_id.invoice_date', dates.startOfMonth] },
                                    { $lte: ['$_id.invoice_date', dates.selectedDate] },
                                    { $ne: ['$_id.order_channel_name', 'E-Commerce'] },
                                    { $eq: ['$_id.transaction_type', 'IV'] },
                                    { $eq: ['$is_sales_trx', 1] },
                                    { $eq: ['$is_whatsapp', 0] }
                                ]
                            },
                            1,
                            0
                        ]
                    }
                },
                MTD_WHATSAPP_TRX: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $gte: ['$_id.invoice_date', dates.startOfMonth] },
                                    { $lte: ['$_id.invoice_date', dates.selectedDate] },
                                    {
                                        $or: [
                                            { $eq: ['$_id.order_channel_name', 'E-Commerce'] },
                                            { $eq: ['$is_whatsapp', 1] }
                                        ]
                                    },
                                    { $eq: ['$_id.transaction_type', 'IV'] },
                                    { $eq: ['$is_sales_trx', 1] }
                                ]
                            },
                            1,
                            0
                        ]
                    }
                },
                // PM calculations
                PM_RETAIL_SALE: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $gte: ['$_id.invoice_date', dates.startOfPM] },
                                    { $lte: ['$_id.invoice_date', dates.endOfPM] },
                                    { $ne: ['$_id.order_channel_name', 'E-Commerce'] },
                                    { $eq: ['$is_whatsapp', 0] }
                                ]
                            },
                            '$total_nett',
                            0
                        ]
                    }
                },
                PM_WHATSAPP_SALE: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $gte: ['$_id.invoice_date', dates.startOfPM] },
                                    { $lte: ['$_id.invoice_date', dates.endOfPM] },
                                    {
                                        $or: [
                                            { $eq: ['$_id.order_channel_name', 'E-Commerce'] },
                                            { $eq: ['$is_whatsapp', 1] }
                                        ]
                                    }
                                ]
                            },
                            '$total_nett',
                            0
                        ]
                    }
                },
                PM_RETAIL_TRX: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $gte: ['$_id.invoice_date', dates.startOfPM] },
                                    { $lte: ['$_id.invoice_date', dates.endOfPM] },
                                    { $ne: ['$_id.order_channel_name', 'E-Commerce'] },
                                    { $eq: ['$_id.transaction_type', 'IV'] },
                                    { $eq: ['$is_sales_trx', 1] },
                                    { $eq: ['$is_whatsapp', 0] }
                                ]
                            },
                            1,
                            0
                        ]
                    }
                },
                PM_WHATSAPP_TRX: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $gte: ['$_id.invoice_date', dates.startOfPM] },
                                    { $lte: ['$_id.invoice_date', dates.endOfPM] },
                                    {
                                        $or: [
                                            { $eq: ['$_id.order_channel_name', 'E-Commerce'] },
                                            { $eq: ['$is_whatsapp', 1] }
                                        ]
                                    },
                                    { $eq: ['$_id.transaction_type', 'IV'] },
                                    { $eq: ['$is_sales_trx', 1] }
                                ]
                            },
                            1,
                            0
                        ]
                    }
                },
                MTD_QTY: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $gte: ['$_id.invoice_date', dates.startOfMonth] },
                                    { $lte: ['$_id.invoice_date', dates.selectedDate] }
                                ]
                            },
                            '$total_qty',
                            0
                        ]
                    }
                },
                PM_QTY: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $gte: ['$_id.invoice_date', dates.startOfPM] },
                                    { $lte: ['$_id.invoice_date', dates.endOfPM] }
                                ]
                            },
                            '$total_qty',
                            0
                        ]
                    }
                },
                YTD_SALE: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $gte: ['$_id.invoice_date', dates.startOfFY] },
                                    { $lte: ['$_id.invoice_date', dates.selectedDate] }
                                ]
                            },
                            '$total_nett',
                            0
                        ]
                    }
                },
                YTD_TRX: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $gte: ['$_id.invoice_date', dates.startOfFY] },
                                    { $lte: ['$_id.invoice_date', dates.selectedDate] },
                                    { $in: ['$_id.transaction_type', ['IV', 'IR']] },
                                    { $eq: ['$is_sales_trx', 1] }
                                ]
                            },
                            1,
                            0
                        ]
                    }
                }
            }
        },
        {
            $project: {
                Location: '$_id',
                MTD_RETAIL_SALE: 1,
                MTD_WHATSAPP_SALE: 1,
                MTD_RETAIL_TRX: 1,
                MTD_WHATSAPP_TRX: 1,
                PM_RETAIL_SALE: 1,
                PM_WHATSAPP_SALE: 1,
                PM_RETAIL_TRX: 1,
                PM_WHATSAPP_TRX: 1,
                MTD_QTY: 1,
                PM_QTY: 1,
                YTD_SALE: 1,
                YTD_TRX: 1,
                _id: 0
            }
        },
        {
            $sort: {
                Location: 1
            }
        }
    ];

    const result = await salesTx.aggregate(pipeline).toArray();
    return result;
};

export const getWhatsappSalesBreakdown = async (
    baseDate: string, 
    location?: string | string[], 
    startDate?: string, 
    brand?: string | string[], 
    category?: string | string[]
) => {
    const dates = await getReportingDates(baseDate, startDate);
    const locations = Array.isArray(location) ? location : (location ? [location] : []);
    const brands = Array.isArray(brand) ? brand : (brand ? [brand] : []);
    const categories = Array.isArray(category) ? category : (category ? [category] : []);

    const salesTx = getCollection('sales_transactions');
    
    const matchFilter: any = { location_name: { $ne: 'Shopify Webstore' } };
    if (locations.length) matchFilter.location_name = { $in: locations.filter(l => l !== 'Shopify Webstore') };
    if (brands.length) matchFilter.brand_name = { $in: brands };
    if (categories.length) matchFilter.category_name = { $in: categories };

    const pipeline = [
        { $match: matchFilter },
        {
            $group: {
                _id: '$location_name',
                MTD_RETAIL_SALES: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $gte: ['$invoice_date', dates.startOfMonth] },
                                    { $lte: ['$invoice_date', dates.selectedDate] },
                                    { $ne: ['$order_channel_name', 'E-Commerce'] },
                                    { $not: { $regexMatch: { input: { $ifNull: ['$sales_person_name', ''] }, regex: /Whatsapp/i } } }
                                ]
                            },
                            '$nett_invoice_value',
                            0
                        ]
                    }
                },
                MTD_WHATSAPP_SALES: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $gte: ['$invoice_date', dates.startOfMonth] },
                                    { $lte: ['$invoice_date', dates.selectedDate] },
                                    {
                                        $or: [
                                            { $eq: ['$order_channel_name', 'E-Commerce'] },
                                            { $regexMatch: { input: { $ifNull: ['$sales_person_name', ''] }, regex: /Whatsapp/i } }
                                        ]
                                    }
                                ]
                            },
                            '$nett_invoice_value',
                            0
                        ]
                    }
                },
                PM_RETAIL_SALES: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $gte: ['$invoice_date', dates.startOfPM] },
                                    { $lte: ['$invoice_date', dates.endOfPM] },
                                    { $ne: ['$order_channel_name', 'E-Commerce'] }
                                ]
                            },
                            '$nett_invoice_value',
                            0
                        ]
                    }
                },
                PM_WHATSAPP_SALES: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $gte: ['$invoice_date', dates.startOfPM] },
                                    { $lte: ['$invoice_date', dates.endOfPM] },
                                    { $eq: ['$order_channel_name', 'E-Commerce'] }
                                ]
                            },
                            '$nett_invoice_value',
                            0
                        ]
                    }
                }
            }
        },
        { $project: { Location: '$_id', MTD_RETAIL_SALES: 1, MTD_WHATSAPP_SALES: 1, PM_RETAIL_SALES: 1, PM_WHATSAPP_SALES: 1, _id: 0 } }
    ];

    return await salesTx.aggregate(pipeline).toArray();
};

export const getOmniChannelTmLm = async (
    baseDate: string, 
    location?: string | string[], 
    startDate?: string, 
    brand?: string | string[], 
    category?: string | string[]
) => {
    const dates = await getReportingDates(baseDate, startDate);
    const salesTx = getCollection('sales_transactions');
    
    const matchFilter: any = {};
    const locations = Array.isArray(location) ? location : (location ? [location] : []);
    const brands = Array.isArray(brand) ? brand : (brand ? [brand] : []);
    const categories = Array.isArray(category) ? category : (category ? [category] : []);
    
    if (locations.length) matchFilter.location_name = { $in: locations };
    if (brands.length) matchFilter.brand_name = { $in: brands };
    if (categories.length) matchFilter.category_name = { $in: categories };

    const pipeline = [
        { $match: matchFilter },
        {
            $group: {
                _id: '$location_name',
                MTD_SALE: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $gte: ['$invoice_date', dates.startOfMonth] },
                                    { $lte: ['$invoice_date', dates.selectedDate] },
                                    { $eq: ['$order_channel_name', 'E-Commerce'] }
                                ]
                            },
                            '$nett_invoice_value',
                            0
                        ]
                    }
                },
                MTD_TRX: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $gte: ['$invoice_date', dates.startOfMonth] },
                                    { $lte: ['$invoice_date', dates.selectedDate] },
                                    { $eq: ['$order_channel_name', 'E-Commerce'] },
                                    { $in: ['$transaction_type', ['IV', 'IR']] },
                                    { $eq: ['$mh1_description', 'Sales'] }
                                ]
                            },
                            1,
                            0
                        ]
                    }
                },
                MTD_UNITS: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $gte: ['$invoice_date', dates.startOfMonth] },
                                    { $lte: ['$invoice_date', dates.selectedDate] },
                                    { $eq: ['$order_channel_name', 'E-Commerce'] }
                                ]
                            },
                            '$total_sales_qty',
                            0
                        ]
                    }
                },
                PM_SALE: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $gte: ['$invoice_date', dates.startOfPM] },
                                    { $lte: ['$invoice_date', dates.endOfPM] },
                                    { $eq: ['$order_channel_name', 'E-Commerce'] }
                                ]
                            },
                            '$nett_invoice_value',
                            0
                        ]
                    }
                },
                PM_TRX: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $gte: ['$invoice_date', dates.startOfPM] },
                                    { $lte: ['$invoice_date', dates.endOfPM] },
                                    { $eq: ['$order_channel_name', 'E-Commerce'] },
                                    { $in: ['$transaction_type', ['IV', 'IR']] },
                                    { $eq: ['$mh1_description', 'Sales'] }
                                ]
                            },
                            1,
                            0
                        ]
                    }
                },
                PM_UNITS: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $gte: ['$invoice_date', dates.startOfPM] },
                                    { $lte: ['$invoice_date', dates.endOfPM] },
                                    { $eq: ['$order_channel_name', 'E-Commerce'] }
                                ]
                            },
                            '$total_sales_qty',
                            0
                        ]
                    }
                }
            }
        },
        { $project: { Location: '$_id', MTD_SALE: 1, MTD_TRX: 1, MTD_UNITS: 1, PM_SALE: 1, PM_TRX: 1, PM_UNITS: 1, _id: 0 } }
    ];

    return await salesTx.aggregate(pipeline).toArray();
};

export const getOmniChannelDetails = async (
    baseDate: string, 
    location?: string | string[], 
    startDate?: string, 
    brand?: string | string[], 
    category?: string | string[]
) => {
    // Get base data from getOmniChannelTmLm
    const data = await getOmniChannelTmLm(baseDate, location, startDate, brand, category);
    
    // Add calculated fields: MTD_ATV and MTD_BASKET_SIZE
    return data.map((row: any) => ({
        ...row,
        MTD_ATV: row.MTD_TRX > 0 ? row.MTD_SALE / row.MTD_TRX : 0,
        PM_ATV: row.PM_TRX > 0 ? row.PM_SALE / row.PM_TRX : 0,
        MTD_BASKET_SIZE: row.MTD_TRX > 0 ? row.MTD_UNITS / row.MTD_TRX : 0,
        PM_BASKET_SIZE: row.PM_TRX > 0 ? row.PM_UNITS / row.PM_TRX : 0
    }));
};

export const getRetailOmniTotal = async (
    baseDate: string, 
    location?: string | string[], 
    startDate?: string, 
    brand?: string | string[], 
    category?: string | string[]
) => {
    const dates = await getReportingDates(baseDate, startDate);
    const salesTx = getCollection('sales_transactions');
    
    const matchFilter: any = {};
    const locations = Array.isArray(location) ? location : (location ? [location] : []);
    const brands = Array.isArray(brand) ? brand : (brand ? [brand] : []);
    const categories = Array.isArray(category) ? category : (category ? [category] : []);
    
    if (locations.length) matchFilter.location_name = { $in: locations };
    if (brands.length) matchFilter.brand_name = { $in: brands };
    if (categories.length) matchFilter.category_name = { $in: categories };

    const pipeline = [
        { $match: matchFilter },
        {
            $group: {
                _id: '$location_name',
                MTD_SALE: {
                    $sum: {
                        $cond: [
                            { $and: [{ $gte: ['$invoice_date', dates.startOfMonth] }, { $lte: ['$invoice_date', dates.selectedDate] }] },
                            '$nett_invoice_value', 0
                        ]
                    }
                },
                MTD_TRX: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $gte: ['$invoice_date', dates.startOfMonth] },
                                    { $lte: ['$invoice_date', dates.selectedDate] },
                                    { $in: ['$transaction_type', ['IV', 'IR']] },
                                    { $eq: ['$mh1_description', 'Sales'] }
                                ]
                            },
                            1, 0
                        ]
                    }
                },
                PM_SALE: {
                    $sum: {
                        $cond: [
                            { $and: [{ $gte: ['$invoice_date', dates.startOfPM] }, { $lte: ['$invoice_date', dates.endOfPM] }] },
                            '$nett_invoice_value', 0
                        ]
                    }
                },
                PM_TRX: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $gte: ['$invoice_date', dates.startOfPM] },
                                    { $lte: ['$invoice_date', dates.endOfPM] },
                                    { $in: ['$transaction_type', ['IV', 'IR']] },
                                    { $eq: ['$mh1_description', 'Sales'] }
                                ]
                            },
                            1, 0
                        ]
                    }
                },
                YTD_SALE: {
                    $sum: {
                        $cond: [
                            { $and: [{ $gte: ['$invoice_date', dates.startOfFY] }, { $lte: ['$invoice_date', dates.selectedDate] }] },
                            '$nett_invoice_value', 0
                        ]
                    }
                },
                YTD_TRX: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $gte: ['$invoice_date', dates.startOfFY] },
                                    { $lte: ['$invoice_date', dates.selectedDate] },
                                    { $in: ['$transaction_type', ['IV', 'IR']] },
                                    { $eq: ['$mh1_description', 'Sales'] }
                                ]
                            },
                            1, 0
                        ]
                    }
                }
            }
        },
        { $project: { Location: '$_id', MTD_SALE: 1, MTD_TRX: 1, PM_SALE: 1, PM_TRX: 1, YTD_SALE: 1, YTD_TRX: 1, _id: 0 } }
    ];

    return await salesTx.aggregate(pipeline).toArray();
};

export const getDashboardSummary = async (
    baseDate: string, 
    location?: string | string[], 
    startDate?: string, 
    brand?: string | string[], 
    category?: string | string[]
) => {
    const dates = await getReportingDates(baseDate, startDate);
    const salesTx = getCollection('sales_transactions');
    
    const matchFilter: any = {};
    const locations = Array.isArray(location) ? location : (location ? [location] : []);
    const brands = Array.isArray(brand) ? brand : (brand ? [brand] : []);
    const categories = Array.isArray(category) ? category : (category ? [category] : []);
    
    if (locations.length) matchFilter.location_name = { $in: locations };
    if (brands.length) matchFilter.brand_name = { $in: brands };
    if (categories.length) matchFilter.category_name = { $in: categories };

    const pipeline = [
        { $match: matchFilter },
        {
            $facet: {
                mtd: [
                    {
                        $match: {
                            invoice_date: { $gte: dates.startOfMonth, $lte: dates.selectedDate }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            total_revenue: { $sum: '$nett_invoice_value' },
                            unique_invoices: { $addToSet: { $cond: [{ $and: [{ $in: ['$transaction_type', ['IV', 'IR']] }, { $eq: ['$mh1_description', 'Sales'] }] }, '$invoice_no', null] } },
                            locations: { $addToSet: '$location_name' }
                        }
                    }
                ],
                pm: [
                    {
                        $match: {
                            invoice_date: { $gte: dates.startOfPM, $lte: dates.endOfPM }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            pm_revenue: { $sum: '$nett_invoice_value' },
                            pm_invoices: { $addToSet: { $cond: [{ $and: [{ $in: ['$transaction_type', ['IV', 'IR']] }, { $eq: ['$mh1_description', 'Sales'] }] }, '$invoice_no', null] } }
                        }
                    }
                ]
            }
        }
    ];

    const result = await salesTx.aggregate(pipeline).toArray();
    
    const mtdData = result[0]?.mtd[0] || { total_revenue: 0, unique_invoices: [], locations: [] };
    const pmData = result[0]?.pm[0] || { pm_revenue: 0, pm_invoices: [] };
    
    const total_transactions = mtdData.unique_invoices.filter((i: any) => i !== null).length;
    const total_revenue = mtdData.total_revenue || 0;
    const pm_transactions = pmData.pm_invoices.filter((i: any) => i !== null).length;
    const pm_revenue = pmData.pm_revenue || 0;
    const total_locations = mtdData.locations.length;

    return {
        total_transactions,
        total_revenue,
        pm_transactions,
        pm_revenue,
        total_locations,
        avg_transaction_value: total_transactions > 0 ? total_revenue / total_transactions : 0,
        pm_atv: pm_transactions > 0 ? pm_revenue / pm_transactions : 0
    };
};

export const getLocations = async (brand?: string | string[]) => {
    const salesTx = getCollection('sales_transactions');
    const brands = Array.isArray(brand) ? brand : (brand ? [brand] : []);
    
    const matchFilter: any = {};
    if (brands.length) matchFilter.brand_name = { $in: brands };
    
    const result = await salesTx.distinct('location_name', matchFilter);
    return result.sort();
};

export const getBrands = async () => {
    const salesTx = getCollection('sales_transactions');
    const result = await salesTx.distinct('brand_name', { brand_name: { $ne: null, $ne: '' } });
    return result.sort();
};

export const getCategories = async (brand?: string | string[], location?: string | string[]) => {
    const salesTx = getCollection('sales_transactions');
    const brands = Array.isArray(brand) ? brand : (brand ? [brand] : []);
    const locations = Array.isArray(location) ? location : (location ? [location] : []);
    
    const matchFilter: any = { category_name: { $ne: null, $ne: '' } };
    if (brands.length) matchFilter.brand_name = { $in: brands };
    if (locations.length) matchFilter.location_name = { $in: locations };
    
    const result = await salesTx.distinct('category_name', matchFilter);
    return result.sort();
};

export const getLatestInvoiceDate = async (): Promise<string> => {
    const salesTx = getCollection('sales_transactions');
    const result = await salesTx.find({}, { projection: { invoice_date: 1, _id: 0 } })
        .sort({ invoice_date: -1 })
        .limit(1)
        .toArray();
    return result[0]?.invoice_date || new Date().toISOString().split('T')[0];
};

export const getRetailEfficiency = async (
    baseDate: string, 
    location?: string | string[], 
    startDate?: string, 
    brand?: string | string[], 
    category?: string | string[]
) => {
    const dates = await getReportingDates(baseDate, startDate);
    const salesTx = getCollection('sales_transactions');
    const footfallCollection = getCollection('footfall');
    
    const matchFilter: any = {};
    const locations = Array.isArray(location) ? location : (location ? [location] : []);
    const brands = Array.isArray(brand) ? brand : (brand ? [brand] : []);
    const categories = Array.isArray(category) ? category : (category ? [category] : []);
    
    if (locations.length) matchFilter.location_name = { $in: locations };
    if (brands.length) matchFilter.brand_name = { $in: brands };
    if (categories.length) matchFilter.category_name = { $in: categories };

    // Get footfall data for MTD and PM periods
    const footfallData = await footfallCollection.aggregate([
        {
            $match: {
                $or: [
                    { date: { $gte: dates.startOfMonth, $lte: dates.selectedDate } },
                    { date: { $gte: dates.startOfPM, $lte: dates.endOfPM } }
                ]
            }
        },
        {
            $group: {
                _id: '$location_name',
                MTD_FOOTFALL: {
                    $sum: {
                        $cond: [
                            { $and: [{ $gte: ['$date', dates.startOfMonth] }, { $lte: ['$date', dates.selectedDate] }] },
                            '$footfall_count', 0
                        ]
                    }
                },
                PM_FOOTFALL: {
                    $sum: {
                        $cond: [
                            { $and: [{ $gte: ['$date', dates.startOfPM] }, { $lte: ['$date', dates.endOfPM] }] },
                            '$footfall_count', 0
                        ]
                    }
                }
            }
        }
    ]).toArray();
    
    const footfallMap = new Map(footfallData.map((f: any) => [f._id, { MTD: f.MTD_FOOTFALL, PM: f.PM_FOOTFALL }]));

    // Get sales metrics - count NET transactions (Sales - Returns)
    const pipeline = [
        { $match: matchFilter },
        {
            $group: {
                _id: '$location_name',
                MTD_RAW_SALE: {
                    $sum: {
                        $cond: [
                            { $and: [{ $gte: ['$invoice_date', dates.startOfMonth] }, { $lte: ['$invoice_date', dates.selectedDate] }] },
                            '$nett_invoice_value', 0
                        ]
                    }
                },
                MTD_RAW_QTY: {
                    $sum: {
                        $cond: [
                            { $and: [{ $gte: ['$invoice_date', dates.startOfMonth] }, { $lte: ['$invoice_date', dates.selectedDate] }] },
                            '$total_sales_qty', 0
                        ]
                    }
                },
                // Count NET transactions (IV Sales - CN Returns)
                MTD_SALES_TRX: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $gte: ['$invoice_date', dates.startOfMonth] },
                                    { $lte: ['$invoice_date', dates.selectedDate] },
                                    { $eq: ['$transaction_type', 'IV'] },
                                    { $eq: ['$mh1_description', 'Sales'] }
                                ]
                            },
                            1, 0
                        ]
                    }
                },
                MTD_RETURN_TRX: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $gte: ['$invoice_date', dates.startOfMonth] },
                                    { $lte: ['$invoice_date', dates.selectedDate] },
                                    { $eq: ['$transaction_type', 'CN'] }
                                ]
                            },
                            1, 0
                        ]
                    }
                },
                // Multi-qty transactions (qty > 1)
                MTD_MULTI_TRX: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $gte: ['$invoice_date', dates.startOfMonth] },
                                    { $lte: ['$invoice_date', dates.selectedDate] },
                                    { $eq: ['$transaction_type', 'IV'] },
                                    { $gt: ['$total_sales_qty', 1] }
                                ]
                            },
                            1, 0
                        ]
                    }
                },
                PM_RAW_SALE: {
                    $sum: {
                        $cond: [
                            { $and: [{ $gte: ['$invoice_date', dates.startOfPM] }, { $lte: ['$invoice_date', dates.endOfPM] }] },
                            '$nett_invoice_value', 0
                        ]
                    }
                },
                PM_RAW_QTY: {
                    $sum: {
                        $cond: [
                            { $and: [{ $gte: ['$invoice_date', dates.startOfPM] }, { $lte: ['$invoice_date', dates.endOfPM] }] },
                            '$total_sales_qty', 0
                        ]
                    }
                },
                PM_SALES_TRX: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $gte: ['$invoice_date', dates.startOfPM] },
                                    { $lte: ['$invoice_date', dates.endOfPM] },
                                    { $eq: ['$transaction_type', 'IV'] },
                                    { $eq: ['$mh1_description', 'Sales'] }
                                ]
                            },
                            1, 0
                        ]
                    }
                },
                PM_RETURN_TRX: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $gte: ['$invoice_date', dates.startOfPM] },
                                    { $lte: ['$invoice_date', dates.endOfPM] },
                                    { $eq: ['$transaction_type', 'CN'] }
                                ]
                            },
                            1, 0
                        ]
                    }
                },
                PM_MULTI_TRX: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $gte: ['$invoice_date', dates.startOfPM] },
                                    { $lte: ['$invoice_date', dates.endOfPM] },
                                    { $eq: ['$transaction_type', 'IV'] },
                                    { $gt: ['$total_sales_qty', 1] }
                                ]
                            },
                            1, 0
                        ]
                    }
                }
            }
        }
    ];

    const salesData = await salesTx.aggregate(pipeline).toArray();
    
    // Combine sales data with footfall and calculate metrics
    const result = salesData.map((row: any) => {
        const location = row._id;
        const footfall = footfallMap.get(location) || { MTD: 0, PM: 0 };
        
        const MTD_NET_TRX = row.MTD_SALES_TRX - row.MTD_RETURN_TRX;
        const PM_NET_TRX = row.PM_SALES_TRX - row.PM_RETURN_TRX;
        
        const MTD_FOOTFALL = footfall.MTD || 0;
        const PM_FOOTFALL = footfall.PM || 0;
        
        // Conversion % = (Net Transactions / Footfall) * 100
        const MTD_CONVERSION_PCT = MTD_FOOTFALL > 0 ? (MTD_NET_TRX / MTD_FOOTFALL) * 100 : 0;
        const PM_CONVERSION_PCT = PM_FOOTFALL > 0 ? (PM_NET_TRX / PM_FOOTFALL) * 100 : 0;
        
        // Multies % = (Multi-qty transactions / Total Sales transactions) * 100
        const MTD_MULTIES_PCT = row.MTD_SALES_TRX > 0 ? (row.MTD_MULTI_TRX / row.MTD_SALES_TRX) * 100 : 0;
        const PM_MULTIES_PCT = row.PM_SALES_TRX > 0 ? (row.PM_MULTI_TRX / row.PM_SALES_TRX) * 100 : 0;
        
        return {
            Location: location,
            MTD_ATV: MTD_NET_TRX > 0 ? row.MTD_RAW_SALE / MTD_NET_TRX : 0,
            PM_ATV: PM_NET_TRX > 0 ? row.PM_RAW_SALE / PM_NET_TRX : 0,
            MTD_BASKET_SIZE: MTD_NET_TRX > 0 ? row.MTD_RAW_QTY / MTD_NET_TRX : 0,
            PM_BASKET_SIZE: PM_NET_TRX > 0 ? row.PM_RAW_QTY / PM_NET_TRX : 0,
            MTD_CONVERSION_PCT: parseFloat(MTD_CONVERSION_PCT.toFixed(2)),
            PM_CONVERSION_PCT: parseFloat(PM_CONVERSION_PCT.toFixed(2)),
            MTD_MULTIES_PCT: parseFloat(MTD_MULTIES_PCT.toFixed(2)),
            PM_MULTIES_PCT: parseFloat(PM_MULTIES_PCT.toFixed(2)),
            MTD_FOOTFALL,
            PM_FOOTFALL,
            MTD_RAW_SALE: row.MTD_RAW_SALE,
            MTD_RAW_TRX: MTD_NET_TRX,
            MTD_RAW_QTY: row.MTD_RAW_QTY,
            MTD_RAW_MULTI_TRX: row.MTD_MULTI_TRX,
            PM_RAW_SALE: row.PM_RAW_SALE,
            PM_RAW_TRX: PM_NET_TRX,
            PM_RAW_QTY: row.PM_RAW_QTY,
            PM_RAW_MULTI_TRX: row.PM_MULTI_TRX
        };
    });
    
    return result;
};


const location = 'test';
const dates = {
    startOfMonth: '2026-01-01',
    selectedDate: '2026-01-10',
    startOfPM: '2025-12-01',
    endOfPM: '2025-12-10',
    startOfFY: '2025-04-01'
};

const valCol = 'nett_invoice_value';

const sql = `
        WITH InvoiceSummary AS (
            SELECT 
                s.location_name,
                s.invoice_no,
                s.invoice_date,
                s.order_channel_name,
                s.invoice_channel_name,
                SUM(${valCol}) as total_nett
            FROM sales_transactions s
            WHERE 1=1 ${location ? 'AND s.location_name = ?' : ''}
            GROUP BY s.location_name, s.invoice_no, s.invoice_date
        )
        SELECT 
            s.location_name as Location,
            
            -- Dynamic Conversion % (TRX / Footfall * 100)
            CASE 
                WHEN (SELECT COALESCE(SUM(footfall_count), 0) FROM footfall f WHERE f.location_name = s.location_name AND DATE(f.date) >= DATE(?) AND DATE(f.date) <= DATE(?)) > 0
                THEN (CAST(COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND total_nett > 0 THEN invoice_no ELSE NULL END) AS REAL) * 100.0) / 
                     (SELECT COALESCE(SUM(footfall_count), 0) FROM footfall f WHERE f.location_name = s.location_name AND DATE(f.date) >= DATE(?) AND DATE(f.date) <= DATE(?))
                ELSE 0 
            END as MTD_CONVERSION_PCT,

            CASE 
                WHEN (SELECT COALESCE(SUM(footfall_count), 0) FROM footfall f WHERE f.location_name = s.location_name AND DATE(f.date) >= DATE(?) AND DATE(f.date) <= DATE(?)) > 0
                THEN (CAST(COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND total_nett > 0 THEN invoice_no ELSE NULL END) AS REAL) * 100.0) / 
                     (SELECT COALESCE(SUM(footfall_count), 0) FROM footfall f WHERE f.location_name = s.location_name AND DATE(f.date) >= DATE(?) AND DATE(f.date) <= DATE(?))
                ELSE 0 
            END as PM_CONVERSION_PCT,
            
            -- ATV (Total Nett / Positive TRX)
            CASE 
                WHEN COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND total_nett > 0 THEN invoice_no ELSE NULL END) > 0
                THEN SUM(CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) THEN total_nett ELSE 0 END) / 
                     COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND total_nett > 0 THEN invoice_no ELSE NULL END)
                ELSE 0 
            END as MTD_ATV,

            CASE 
                WHEN COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND total_nett > 0 THEN invoice_no ELSE NULL END) > 0
                THEN SUM(CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) THEN total_nett ELSE 0 END) / 
                     COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND total_nett > 0 THEN invoice_no ELSE NULL END)
                ELSE 0 
            END as PM_ATV,

            -- Basket Size (Total Positive Qty / Positive TRX)
            CASE 
                WHEN COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND total_nett > 0 THEN invoice_no ELSE NULL END) > 0
                THEN CAST(SUM(CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) THEN total_positive_qty ELSE 0 END) AS REAL) / 
                     COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND total_nett > 0 THEN invoice_no ELSE NULL END)
                ELSE 0 
            END as MTD_BASKET_SIZE,

            CASE 
                WHEN COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND total_nett > 0 THEN invoice_no ELSE NULL END) > 0
                THEN CAST(SUM(CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) THEN total_positive_qty ELSE 0 END) AS REAL) / 
                     COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND total_nett > 0 THEN invoice_no ELSE NULL END)
                ELSE 0 
            END as PM_BASKET_SIZE,

            -- Derived Multies % (TRX with >1 qty / Total Pos TRX)
            CASE 
                WHEN COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND total_nett > 0 THEN invoice_no ELSE NULL END) > 0
                THEN (CAST(COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND total_nett > 0 AND total_positive_qty > 1 THEN invoice_no ELSE NULL END) AS REAL) * 100) / 
                     COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND total_nett > 0 THEN invoice_no ELSE NULL END)
                ELSE 0 
            END as MTD_MULTIES_PCT,

            CASE 
                WHEN COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND total_nett > 0 THEN invoice_no ELSE NULL END) > 0
                THEN (CAST(COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND total_nett > 0 AND total_positive_qty > 1 THEN invoice_no ELSE NULL END) AS REAL) * 100) / 
                     COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND total_nett > 0 THEN invoice_no ELSE NULL END)
                ELSE 0 
            END as PM_MULTIES_PCT,

            -- Dynamic Footfall from granular table provided by user
            (SELECT COALESCE(SUM(footfall_count), 0) FROM footfall f WHERE f.location_name = s.location_name AND DATE(f.date) >= DATE(?) AND DATE(f.date) <= DATE(?)) as MTD_FOOTFALL,
            (SELECT COALESCE(SUM(footfall_count), 0) FROM footfall f WHERE f.location_name = s.location_name AND DATE(f.date) >= DATE(?) AND DATE(f.date) <= DATE(?)) as PM_FOOTFALL,

            -- RAW COUNTERS for Frontend Totals Calculation
            -- MTD
            COALESCE(SUM(CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) THEN total_nett ELSE 0 END), 0) as MTD_RAW_SALE,
            COALESCE(COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND total_nett > 0 THEN invoice_no ELSE NULL END), 0) as MTD_RAW_TRX,
            COALESCE(SUM(CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) THEN total_positive_qty ELSE 0 END), 0) as MTD_RAW_QTY,
            COALESCE(COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND total_nett > 0 AND total_positive_qty > 1 THEN invoice_no ELSE NULL END), 0) as MTD_RAW_MULTI_TRX,

            -- PM
            COALESCE(SUM(CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) THEN total_nett ELSE 0 END), 0) as PM_RAW_SALE,
            COALESCE(COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND total_nett > 0 THEN invoice_no ELSE NULL END), 0) as PM_RAW_TRX,
            COALESCE(SUM(CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) THEN total_positive_qty ELSE 0 END), 0) as PM_RAW_QTY,
            COALESCE(COUNT(DISTINCT CASE WHEN DATE(invoice_date) >= DATE(?) AND DATE(invoice_date) <= DATE(?) AND total_nett > 0 AND total_positive_qty > 1 THEN invoice_no ELSE NULL END), 0) as PM_RAW_MULTI_TRX

        FROM InvoiceSummary s
        LEFT JOIN location_efficiency e ON s.location_name = e.location_name AND e.report_date = DATE(?)
        GROUP BY s.location_name
    `;

const params: any[] = [];
if (location) params.push(location);

params.push(
    // MTD Conversion % (Footfall dates x2, Trx dates x2, Footfall dates x2)
    dates.startOfMonth, dates.selectedDate, dates.startOfMonth, dates.selectedDate, dates.startOfMonth, dates.selectedDate,
    // PM Conversion % (Footfall dates x2, Trx dates x2, Footfall dates x2)
    dates.startOfPM, dates.endOfPM, dates.startOfPM, dates.endOfPM, dates.startOfPM, dates.endOfPM,

    // MTD ATV (6 params)
    dates.startOfMonth, dates.selectedDate, dates.startOfMonth, dates.selectedDate, dates.startOfMonth, dates.selectedDate,
    // PM ATV (6 params)
    dates.startOfPM, dates.endOfPM, dates.startOfPM, dates.endOfPM, dates.startOfPM, dates.endOfPM,

    // MTD Basket Size (6 params)
    dates.startOfMonth, dates.selectedDate, dates.startOfMonth, dates.selectedDate, dates.startOfMonth, dates.selectedDate,
    // PM Basket Size (6 params)
    dates.startOfPM, dates.endOfPM, dates.startOfPM, dates.endOfPM, dates.startOfPM, dates.endOfPM,

    // MTD Multies % (6 params)
    dates.startOfMonth, dates.selectedDate, dates.startOfMonth, dates.selectedDate, dates.startOfMonth, dates.selectedDate,
    // PM Multies % (6 params)
    dates.startOfPM, dates.endOfPM, dates.startOfPM, dates.endOfPM, dates.startOfPM, dates.endOfPM,

    // Footfall (MTD: 2 params, PM: 2 params)
    dates.startOfMonth, dates.selectedDate,
    dates.startOfPM, dates.endOfPM,

    // MTD RAW (8 params: Sale(2), Trx(2), Qty(2), Multi(2))
    dates.startOfMonth, dates.selectedDate, dates.startOfMonth, dates.selectedDate, dates.startOfMonth, dates.selectedDate, dates.startOfMonth, dates.selectedDate,
    // PM RAW (8 params)
    dates.startOfPM, dates.endOfPM, dates.startOfPM, dates.endOfPM, dates.startOfPM, dates.endOfPM, dates.startOfPM, dates.endOfPM,

    // Join Dates (2 params)
    dates.selectedDate
);

console.log('SQL Check:');
console.log('Placeholders (?):', (sql.match(/\?/g) || []).length);
console.log('Params:', params.length);

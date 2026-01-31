
import db from '../config/db';

const run = async () => {
    try {
        console.log("Checking Data Range and YTD Totals...");

        // 1. Min/Max Date
        const resMinMax = await db.query("SELECT MIN(invoice_date) as min_date, MAX(invoice_date) as max_date FROM sales_transactions");
        console.log("Date Range in DB:", resMinMax.rows[0]);

        // 2. YTD (Fiscal Year: April 1st 2025 - Present)
        // Adjust year based on current max date. If Max is Jan 2026, FY Start is April 1st 2025.
        const maxDate = new Date(resMinMax.rows[0].max_date);
        const currentMonth = maxDate.getMonth();
        const fyYear = currentMonth < 3 ? maxDate.getFullYear() - 1 : maxDate.getFullYear();
        const fyStart = `${fyYear}-04-01`;

        console.log(`Calculating Fiscal YTD from: ${fyStart} to ${resMinMax.rows[0].max_date}`);

        const sqlFY = `
            SELECT 
                SUM(nett_invoice_value) as total_sales,
                COUNT(DISTINCT invoice_no) as total_trx
            FROM sales_transactions
            WHERE DATE(invoice_date) >= DATE('${fyStart}') 
            AND DATE(invoice_date) <= DATE('${resMinMax.rows[0].max_date}')
        `;
        const resFY = await db.query(sqlFY);
        console.log("Fiscal YTD Totals:", resFY.rows[0]);

        // 3. Calendar YTD (Jan 1st 2026 - Present)
        console.log(`Calculating Calendar YTD from: 2026-01-01 to ${resMinMax.rows[0].max_date}`);
        const sqlCal = `
            SELECT 
                SUM(nett_invoice_value) as total_sales,
                COUNT(DISTINCT invoice_no) as total_trx
            FROM sales_transactions
            WHERE DATE(invoice_date) >= DATE('2026-01-01') 
            AND DATE(invoice_date) <= DATE('${resMinMax.rows[0].max_date}')
        `;
        const resCal = await db.query(sqlCal);
        console.log("Calendar YTD Totals:", resCal.rows[0]);

    } catch (e) {
        console.error(e);
    }
};

run();

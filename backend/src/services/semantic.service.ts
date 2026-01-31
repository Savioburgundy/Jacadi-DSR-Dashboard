import db from '../config/db';

export const evaluateMetric = (formula: string, data: any) => {
    let evaluatedFormula = formula;
    const keys = Object.keys(data);

    keys.sort((a, b) => b.length - a.length);

    for (const key of keys) {
        const regex = new RegExp(`\\b${key}\\b`, 'g');
        evaluatedFormula = evaluatedFormula.replace(regex, data[key]);
    }

    try {
        return Function(`"use strict"; return (${evaluatedFormula})`)();
    } catch (error) {
        console.error(`Error evaluating formula: ${formula}`, error);
        return null;
    }
};

export const getDashboardData = async (dashboardId: string) => {
    // 1. Get metrics
    const metricsResult = await db.query('SELECT * FROM metrics');
    const metrics = metricsResult.rows;

    // 2. Get latest sales data (aggregated)
    const dataResult = await db.query('SELECT * FROM gold_daily_sales ORDER BY invoice_date DESC LIMIT 30');
    const salesData = dataResult.rows;

    // 3. Map metrics to data
    return salesData.map((row: any) => {
        const result: any = { ...row };
        metrics.forEach((m: any) => {
            result[m.name] = evaluateMetric(m.formula, row);
        });
        return result;
    });
};

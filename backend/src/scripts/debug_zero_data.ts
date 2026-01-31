
import { getRetailPerformance, getDashboardSummary } from '../services/etl.service';

const run = async () => {
    try {
        console.log("Testing getDashboardSummary...");
        // getDashboardSummary(baseDate, location, startDate)
        const summary = await getDashboardSummary('2026-01-25', undefined, '2026-01-01');
        console.log("Summary Result:", JSON.stringify(summary, null, 2));

        console.log("\nTesting getRetailPerformance...");
        // getRetailPerformance(baseDate, location, startDate)
        const perf = await getRetailPerformance('2026-01-25', undefined, '2026-01-01');
        console.log("Retail Performance Result:", JSON.stringify(perf, null, 2));

    } catch (e) {
        console.error("ERROR EXECUTING FUNCTIONS:", e);
    }
};

run();

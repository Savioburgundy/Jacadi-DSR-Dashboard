
import { getRetailPerformance } from '../services/etl.service';
import db from '../config/db';

const run = async () => {
    try {
        console.log("Simulating API Call...");
        // API likely calls this with baseDate='2026-01-30' (today) and startDate='2026-01-01' (start of month/filter)
        // Or maybe just baseDate.

        // Let's test standard MTD
        const today = '2026-01-29'; // Using file date approx
        const data = await getRetailPerformance(today, undefined, '2026-01-01');

        console.log("API Result:");
        console.table(data);

    } catch (e) {
        console.error("Error:", e);
    }
};

run();


import { getRetailPerformance } from '../services/etl.service';

const run = async () => {
    try {
        console.log("Verifying MTD QTY and PM QTY in Retail Performance...");

        // Jan 1-25 Palladium
        const performance = await getRetailPerformance('2026-01-25', undefined, '2026-01-01');

        const palladium = performance.find((e: any) => e.Location === 'Jacadi Palladium');
        if (palladium) {
            console.log("Palladium MTD QTY:", palladium.MTD_QTY);
            console.log("Palladium PM QTY:", palladium.PM_QTY);

            if (palladium.MTD_QTY > 0) {
                console.log("✅ SUCCESS: MTD QTY is populated in Performance.");
            } else {
                console.error("❌ FAILED: MTD QTY is zero or missing in Performance.");
            }
        } else {
            console.error("❌ FAILED: Palladium not found in results.");
        }

    } catch (e) {
        console.error("ERROR EXECUTING VERIFICATION:", e);
    }
};

run();

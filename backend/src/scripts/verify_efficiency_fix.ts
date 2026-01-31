
import { getRetailEfficiency } from '../services/etl.service';

const run = async () => {
    try {
        console.log("Verifying Consumable Exclusion from Efficiency Metrics...");

        // 1. Check Palladium (Jan 1-25)
        // Previous (unfiltered) would have included consumables in Qty and Multi counts.
        const efficiency = await getRetailEfficiency('2026-01-25', undefined, '2026-01-01');

        const palladium = efficiency.find((e: any) => e.Location === 'Jacadi Palladium');
        if (palladium) {
            console.log("Palladium MTD Basket Size:", palladium.MTD_BASKET_SIZE);
            console.log("Palladium MTD Conversion %:", palladium.MTD_CONVERSION_PCT);

            // Multies calculation from Raw Counters
            const rawMulti = palladium.MTD_RAW_MULTI_TRX;
            const rawTrx = palladium.MTD_RAW_TRX;
            const multiPct = rawTrx > 0 ? (rawMulti * 100 / rawTrx) : 0;

            console.log(`Palladium Multies: ${rawMulti} / ${rawTrx} (${multiPct.toFixed(2)}%)`);
        }

    } catch (e) {
        console.error("ERROR EXECUTING VERIFICATION:", e);
    }
};

run();

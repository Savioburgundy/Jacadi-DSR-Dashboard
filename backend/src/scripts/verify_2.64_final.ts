
import { getRetailEfficiency } from '../services/etl.service';

const run = async () => {
    try {
        console.log("Final Verification of efficiency metrics...");

        // Jan 1-25
        const efficiency = await getRetailEfficiency('2026-01-25', undefined, '2026-01-01');

        // Sum values to calculate weighted total basket size
        let totalQty = 0;
        let totalTrx = 0;

        efficiency.forEach((row: any) => {
            totalQty += row.MTD_RAW_QTY;
            totalTrx += row.MTD_RAW_TRX;
            console.log(`${row.Location.padEnd(20)} | Qty: ${row.MTD_RAW_QTY} | TRX: ${row.MTD_RAW_TRX} | Basket: ${row.MTD_BASKET_SIZE.toFixed(4)}`);
        });

        const totalBasket = totalQty / totalTrx;
        console.log("-----------------------------------------");
        console.log(`GRAND TOTAL | Qty: ${totalQty} | TRX: ${totalTrx} | Weighted Basket: ${totalBasket.toFixed(4)}`);

        if (Math.abs(totalBasket - 2.6476) < 0.01) {
            console.log("✅ SUCCESS: Grand Total Basket matches 2.64!");
        } else {
            console.error("❌ FAILED: Grand Total Basket does NOT match 2.64.");
        }

    } catch (e) {
        console.error("ERROR:", e);
    }
};

run();

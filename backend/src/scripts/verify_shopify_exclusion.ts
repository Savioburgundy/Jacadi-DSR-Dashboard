
import { getWhatsappSalesBreakdown } from '../services/etl.service';

const run = async () => {
    try {
        console.log("Verifying Shopify Webstore Exclusion from Whatsapp Tab...");

        // Use a date range we know has data: Jan 1 2026 to Jan 25 2026
        const breakdown = await getWhatsappSalesBreakdown('2026-01-25', undefined, '2026-01-01');

        console.log("Breakdown Result Locations:");
        const locations = breakdown.map((b: any) => b.Location);
        console.log(locations);

        const hasShopify = locations.includes('Shopify Webstore');
        if (hasShopify) {
            console.error("❌ FAILED: Shopify Webstore is still present!");
        } else {
            console.log("✅ SUCCESS: Shopify Webstore is excluded.");
        }

    } catch (e) {
        console.error("ERROR EXECUTING VERIFICATION:", e);
    }
};

run();

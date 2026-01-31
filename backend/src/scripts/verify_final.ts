
import { getRetailPerformance } from '../services/etl.service';

const run = async () => {
    try {
        const today = '2026-01-29';
        const data = await getRetailPerformance(today, undefined, '2026-01-01');

        // Filter for Palladium and MOA and show relevant stats
        const relevant = data.filter((d: any) =>
            (d.Location || '').includes('Palladium') || (d.Location || '').includes('MOA')
        ).map((d: any) => ({
            Location: d.Location,
            MTD_SALE: d.MTD_RETAIL_SALE,
            MTD_TRX: d.MTD_RETAIL_TRX,
            // Check if revenue looks crazy high or normal (sanity check, user says it increased before)
        }));

        console.table(relevant);
    } catch (e) {
        console.error(e);
    }
};

run();

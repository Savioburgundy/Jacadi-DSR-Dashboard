
import { getRetailPerformance } from '../services/etl.service';
import db from '../config/db';

const run = async () => {
    try {
        const today = '2026-01-29';
        const data = await getRetailPerformance(today, undefined, '2026-01-01');
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(e);
    }
};

run();

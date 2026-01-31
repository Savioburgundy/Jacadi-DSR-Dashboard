
const check = async () => {
    const endpoints = [
        '/api/dashboards/default/retail-whatsapp',
        '/api/dashboards/default/summary',
        '/api/dashboards/default/retail-efficiency',
        '/api/dashboards/default/omni-channel-tm-lm',
        '/api/dashboards/default/omni-channel-details',
        '/api/dashboards/default/retail-omni-total',
        '/api/dashboards/default/whatsapp-sales-breakdown'
    ];

    // Explicitly using the date range the user has selected
    const query = '?startDate=2026-01-01&endDate=2026-01-10';

    console.log('--- STARTING CHECK ---');
    for (const ep of endpoints) {
        try {
            const url = `http://localhost:5000${ep}${query}`;
            const res = await fetch(url);
            if (res.status !== 200) {
                console.error(`[FAILED] ${ep} Status: ${res.status}`);
                const txt = await res.text();
                console.error(txt.substring(0, 200)); // Log first 200 chars of error
            } else {
                console.log(`[OK] ${ep}`);
            }
        } catch (e: any) {
            console.error(`[ERROR] ${ep}:`, e.message);
        }
    }
    console.log('--- CHECK COMPLETE ---');
};

check();

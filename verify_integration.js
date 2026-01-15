const fs = require('fs');
const path = require('path');

async function run() {
    // Retry connection a few times
    const PORT = 3003; // Updated to new port
    const BASE = `http://localhost:${PORT}`;

    console.log(`Checking connection to ${BASE}...`);
    try {
        await fetch(`${BASE}/api/files`);
    } catch (e) {
        console.log('Waiting for server...');
        await new Promise(r => setTimeout(r, 2000));
    }

    // Prepare File
    const blob = new Blob([fs.readFileSync('test_shipment.csv')], { type: 'text/csv' });
    const formData = new FormData();
    formData.append('file', blob, 'test_shipment.csv');

    console.log('1. Uploading File...');
    try {
        const res = await fetch(`${BASE}/api/upload`, {
            method: 'POST',
            body: formData
        });

        if (!res.ok) {
            console.error("Upload Failed:", res.status, await res.text());
            return;
        }

        const json = await res.json();
        console.log('Upload Result:', json);

        if (json.fileId) {
            const safeId = encodeURIComponent(json.fileId);
            console.log(`2. Triggering Pipeline for ${json.fileId} (Enc: ${safeId})...`);

            const res2 = await fetch(`${BASE}/api/process/${safeId}`, {
                method: 'POST'
            });

            const text = await res2.text();
            try {
                const json2 = JSON.parse(text);
                console.log('Process Result:', JSON.stringify(json2, null, 2));
            } catch (e) {
                console.log("Raw Response:", text);
            }
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

run();

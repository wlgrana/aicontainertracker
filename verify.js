const fs = require('fs');
const path = require('path');

async function run() {
    const blob = new Blob([fs.readFileSync('test_shipment.csv')], { type: 'text/csv' });
    const formData = new FormData();
    formData.append('file', blob, 'test_shipment.csv');

    console.log('Uploading...');
    try {
        const res = await fetch('http://localhost:3000/api/upload', {
            method: 'POST',
            body: formData
        });
        const json = await res.json();
        console.log('Upload Result:', json);

        if (json.fileId) {
            console.log('Processing details for:', json.fileId);
            const res2 = await fetch(`http://localhost:3000/api/process/${json.fileId}`, {
                method: 'POST'
            });
            const json2 = await res2.json();
            console.log('Process Result:', JSON.stringify(json2, null, 2));
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

// Simple wait for server
setTimeout(run, 5000);

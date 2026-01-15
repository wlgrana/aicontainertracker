import fs from 'fs';
import path from 'path';
import FormData from 'form-data';

async function uploadFile() {
    const filePath = path.join(process.cwd(), 'test_import_oracle.csv');
    const fileContent = fs.readFileSync(filePath);

    const form = new FormData();
    form.append('file', fileContent, {
        filename: 'test_import_oracle.csv',
        contentType: 'text/csv'
    });

    console.log('Uploading file to /api/upload...');

    const response = await fetch('http://localhost:3000/api/upload', {
        method: 'POST',
        body: form,
        headers: form.getHeaders()
    });

    const result = await response.json();
    console.log('Upload response:', JSON.stringify(result, null, 2));

    if (result.fileId) {
        console.log('\nProcessing file...');
        const processResponse = await fetch(`http://localhost:3000/api/process/${encodeURIComponent(result.fileId)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ confirmMapping: false })
        });

        const processResult = await processResponse.json();
        console.log('Process response:', JSON.stringify(processResult, null, 2));
    }
}

uploadFile().catch(console.error);

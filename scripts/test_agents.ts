
import { orchestrateImport } from '../lib/import-orchestrator';
import * as path from 'path';

async function main() {
    const filePath = path.join(process.cwd(), 'container_test_data.xlsx'); // Make sure this file exists or use a dummy
    const fileName = 'test_import_' + Date.now() + '.xlsx';

    console.log(`Starting test import for ${filePath}...`);

    try {
        const result = await orchestrateImport(filePath, fileName, 'TEST_USER');
        console.log('Orchestration complete:', JSON.stringify(result, null, 2));
    } catch (err) {
        console.error('Orchestration failed:', err);
    }
}

main();

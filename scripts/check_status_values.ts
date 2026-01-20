import { prisma } from '../lib/prisma';

async function checkStatusValues() {
    console.log('=== CHECKING STATUS VALUES IN RAW DATA ===\n');

    const rows = await prisma.rawRow.findMany({
        where: { importLogId: 'Horizon Tracking Report.xlsx' },
        take: 20
    });

    console.log(`Found ${rows.length} raw rows for Horizon Tracking Report\n`);

    const statusValues = new Set<string>();

    rows.forEach((row, index) => {
        const data = JSON.parse(row.data);

        // Try different possible status field names
        const status = data['Current Status'] ||
            data['Status'] ||
            data['Container Status'] ||
            data['status'] ||
            data['CURRENT STATUS'];

        if (status) {
            statusValues.add(String(status).trim());
        }

        if (index < 5) {
            console.log(`Row ${index + 1} sample:`, Object.keys(data).slice(0, 5).join(', '));
            console.log(`  Status field value:`, status || 'NOT FOUND');
        }
    });

    console.log('\n=== UNIQUE STATUS VALUES ===\n');
    Array.from(statusValues).sort().forEach(status => {
        console.log(`  - "${status}"`);
    });

    await prisma.$disconnect();
}

checkStatusValues().catch(console.error);

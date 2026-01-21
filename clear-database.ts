/**
 * Clear database - complete deletion including RawRow table
 */

import { PrismaClient } from '@prisma/client';

async function clearDatabase() {
    const prisma = new PrismaClient();

    console.log('⚠️  WARNING: This will delete ALL container data!\n');

    try {
        // Delete in correct order to respect foreign keys
        console.log('Step 1: Deleting activity logs...');
        const activityLogs = await prisma.activityLog.deleteMany({});
        console.log(`✅ Deleted ${activityLogs.count} activity logs`);

        console.log('\nStep 2: Deleting agent processing logs...');
        const agentLogs = await prisma.agentProcessingLog.deleteMany({});
        console.log(`✅ Deleted ${agentLogs.count} agent logs`);

        console.log('\nStep 3: Deleting shipment-container relationships...');
        const shipmentContainers = await prisma.shipmentContainer.deleteMany({});
        console.log(`✅ Deleted ${shipmentContainers.count} relationships`);

        console.log('\nStep 4: Deleting containers...');
        const containers = await prisma.container.deleteMany({});
        console.log(`✅ Deleted ${containers.count} containers`);

        console.log('\nStep 5: Deleting shipments...');
        const shipments = await prisma.shipment.deleteMany({});
        console.log(`✅ Deleted ${shipments.count} shipments`);

        console.log('\nStep 6: Deleting raw rows...');
        const rawRows = await prisma.rawRow.deleteMany({});
        console.log(`✅ Deleted ${rawRows.count} raw rows`);

        console.log('\nStep 7: Deleting import logs...');
        const importLogs = await prisma.importLog.deleteMany({});
        console.log(`✅ Deleted ${importLogs.count} import logs`);

        console.log('\n' + '='.repeat(50));
        console.log('✅ Database cleared successfully!');
        console.log('='.repeat(50));
        console.log('\nTotal records deleted:');
        console.log(`  Activity Logs:        ${activityLogs.count}`);
        console.log(`  Agent Logs:           ${agentLogs.count}`);
        console.log(`  Shipment Containers:  ${shipmentContainers.count}`);
        console.log(`  Containers:           ${containers.count}`);
        console.log(`  Shipments:            ${shipments.count}`);
        console.log(`  Raw Rows:             ${rawRows.count}`);
        console.log(`  Import Logs:          ${importLogs.count}`);
        console.log('\nYou can now re-import your data with the fixed logic.');

    } catch (error: any) {
        console.error('\n❌ Error:', error.message);
        if (error.code) {
            console.error('Error code:', error.code);
        }
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

clearDatabase()
    .then(() => {
        console.log('\n✅ Done');
        process.exit(0);
    })
    .catch(() => {
        console.error('\n❌ Script failed');
        process.exit(1);
    });

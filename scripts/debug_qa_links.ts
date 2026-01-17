
import { prisma } from '../lib/prisma';

async function debugLinks() {
    console.log("🔍 STARTING DATABASE INVESTIGATION...");

    // We can't know the exact filename from the prompt safely without listing, 
    // but the user mentioned '1768589149864-Horizon Tracking Report.xlsx'.
    // Let's find the most recent import log just to be sure or use that one.

    const recentImport = await prisma.importLog.findFirst({
        orderBy: { importedOn: 'desc' }
    });

    if (!recentImport) {
        console.log("❌ No ImportLog found!");
        return;
    }

    const fileName = recentImport.fileName;
    console.log(`📂 Analyzing most recent import: "${fileName}"`);

    // 1. Check ImportLog
    const log = await prisma.importLog.findUnique({
        where: { fileName }
    });
    console.log(`1. ImportLog exists? ${!!log}`);

    // 2. Check linked containers
    const linkedCount = await prisma.container.count({
        where: { importLogId: fileName }
    });
    console.log(`2. Containers linked via importLogId: ${linkedCount}`);

    // 3. Check orphaned containers (created recently)
    // We'll look for containers created in the last 24 hours that have no link
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const orphanedCount = await prisma.container.count({
        where: {
            importLogId: null,
            createdAt: { gt: oneDayAgo }
        }
    });
    console.log(`3. Orphaned containers (last 24h): ${orphanedCount}`);

    // 4. RawRows linked
    const rawRowCount = await prisma.rawRow.count({
        where: { importLogId: fileName }
    });
    console.log(`4. RawRows linked to import: ${rawRowCount}`);

    // 5. Containers reachable via RawRow
    // Prisma equivalent of the JOIN query
    const viaRawRows = await prisma.container.count({
        where: {
            rawRows: {
                some: {
                    importLogId: fileName
                }
            }
        }
    });
    console.log(`5. Containers reachable via RawRow relation: ${viaRawRows}`);

    // 6. Agent Processing Logs
    const agentStats = await prisma.agentProcessingLog.groupBy({
        by: ['stage'],
        where: {
            container: {
                createdAt: { gt: oneDayAgo }
            }
        },
        _count: {
            _all: true
        }
    });
    console.log("6. Agent Processing Logs (Last 24h):");
    console.table(agentStats);

    // 7. INSPECT METADATA
    console.log("\n7. Inspecting Metadata for 5 containers...");
    const sampleContainers = await prisma.container.findMany({
        where: { importLogId: fileName },
        take: 5
    });

    for (const c of sampleContainers) {
        const meta = c.metadata as any;
        console.log(`Container: ${c.containerNumber}`);
        console.log(`  rawRowId in metadata? ${meta?._internal?.rawRowId || 'MISSING'}`);
        if (meta?._internal?.rawRowId) {
            // Check if this raw row actually exists
            const rr = await prisma.rawRow.findUnique({ where: { id: meta._internal.rawRowId } });
            console.log(`  RawRow exists in DB? ${!!rr} (ID: ${meta._internal.rawRowId})`);
            console.log(`  RawRow.containerId linked? ${rr?.containerId === c.containerNumber ? 'YES' : 'NO'} (Actual: ${rr?.containerId})`);
        }
    }
}

debugLinks()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

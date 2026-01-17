
import { prisma } from '../lib/prisma';
import { runAuditor } from '../agents/auditor';

const TARGET_FILE = '1768589149864-Horizon Tracking Report.xlsx';

async function fix() {
    console.log(`Starting fix for ${TARGET_FILE}...`);

    // 1. Get Containers for this import
    const containers = await prisma.container.findMany({
        where: { importLogId: TARGET_FILE }
    });
    console.log(`Found ${containers.length} containers linked to import.`);

    // 2. Get RawRows
    const rawRows = await prisma.rawRow.findMany({
        where: { importLogId: TARGET_FILE }
    });
    console.log(`Found ${rawRows.length} raw rows.`);

    // 3. Map Container -> RawRow via data inspection
    const cntrToRow = new Map();
    const regex = /^[A-Z]{4}\d{7}$/;

    for (const r of rawRows) {
        const d = JSON.parse(r.data);
        for (const v of Object.values(d)) {
            if (typeof v === 'string') {
                const clean = v.trim().toUpperCase();
                // Remove spaces/dashes if common
                const normalized = clean.replace(/[^A-Z0-9]/g, '');
                if (normalized.length === 11 && regex.test(normalized)) {
                    cntrToRow.set(normalized, r);
                    // Break inner loop, assume one container per row main ID
                    break;
                }
            }
        }
    }
    console.log(`Mapped ${cntrToRow.size} rows to container numbers.`);

    // 4. Update loops
    let updatedCount = 0;
    let auditedCount = 0;

    // Process in serial to avoid rate limits
    for (const c of containers) {
        if (cntrToRow.has(c.containerNumber)) {
            const row = cntrToRow.get(c.containerNumber);

            // Debug: Check if already linked
            const meta = (c.metadata as any) || {};
            let needsSave = false;

            if (!meta._internal) {
                meta._internal = {};
                needsSave = true;
            }

            if (!meta._internal.rawRowId) {
                console.log(`Linking ${c.containerNumber} -> RawRow ${row.id}`);
                meta._internal.rawRowId = row.id;
                meta._internal.importLogId = TARGET_FILE; // Ensure this is set too
                needsSave = true;
            }

            if (needsSave) {
                await prisma.container.update({
                    where: { containerNumber: c.containerNumber },
                    data: { metadata: meta }
                });

                await prisma.rawRow.update({
                    where: { id: row.id },
                    data: { containerId: c.containerNumber }
                });
                updatedCount++;
            }

            // Run Auditor (Only if missing logs? No, forcing it ensures quality report)
            // To be safe, let's just run it.
            process.stdout.write(`Auditing ${c.containerNumber}... `);
            try {
                await runAuditor({
                    containerNumber: c.containerNumber,
                    databaseRow: c,
                    rawData: {
                        raw: { originalRow: JSON.parse(row.data) },
                        mapping: {}
                    }
                });
                console.log("✅");
                auditedCount++;
            } catch (e) {
                console.log("❌ Failed");
                console.error(e);
            }
        } else {
            console.warn(`Could not find raw row for ${c.containerNumber}`);
        }
    }

    console.log(`\nProcess Complete.`);
    console.log(`Linked: ${updatedCount}`);
    console.log(`Audited: ${auditedCount}`);
}

fix().catch(e => {
    console.error(e);
    process.exit(1);
}).finally(() => prisma.$disconnect());

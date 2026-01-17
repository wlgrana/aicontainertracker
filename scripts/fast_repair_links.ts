
import { prisma } from '../lib/prisma';
import { runAuditor } from '../agents/auditor';

const TARGET_FILE = '1768589149864-Horizon Tracking Report.xlsx';
const CONCURRENCY = 5;

async function fix() {
    console.log(`Starting FAST fix for ${TARGET_FILE}...`);
    const containers = await prisma.container.findMany({ where: { importLogId: TARGET_FILE } });
    const rawRows = await prisma.rawRow.findMany({ where: { importLogId: TARGET_FILE } });

    // Build Map
    const cntrToRow = new Map();
    const regex = /^[A-Z]{4}\d{7}$/;
    for (const r of rawRows) {
        const d = JSON.parse(r.data);
        for (const v of Object.values(d)) {
            if (typeof v === 'string') {
                const clean = v.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
                if (clean.length === 11 && regex.test(clean)) {
                    cntrToRow.set(clean, r);
                    break;
                }
            }
        }
    }

    // Helper function
    const processContainer = async (c: any) => {
        if (!cntrToRow.has(c.containerNumber)) return;
        const row = cntrToRow.get(c.containerNumber);

        // 1. Link (Idempotent)
        const meta = (c.metadata as any) || {};
        if (!meta._internal?.rawRowId) {
            if (!meta._internal) meta._internal = {};
            meta._internal.rawRowId = row.id;
            meta._internal.importLogId = TARGET_FILE;

            await prisma.container.update({
                where: { containerNumber: c.containerNumber },
                data: { metadata: meta }
            });
            await prisma.rawRow.update({
                where: { id: row.id },
                data: { containerId: c.containerNumber }
            });
            console.log(`Linked ${c.containerNumber}`);
        }

        // 2. Audit (Skip if exists)
        const existing = await prisma.agentProcessingLog.findFirst({
            where: { containerId: c.containerNumber, stage: 'AUDITOR' }
        });

        if (existing) {
            return;
        }

        try {
            await runAuditor({
                containerNumber: c.containerNumber,
                databaseRow: c,
                rawData: { raw: { originalRow: JSON.parse(row.data) }, mapping: {} }
            });
            console.log(`✅ Audited ${c.containerNumber}`);
        } catch (e) {
            console.error(`❌ Failed ${c.containerNumber}`);
        }
    };

    // Batched Execution
    for (let i = 0; i < containers.length; i += CONCURRENCY) {
        const batch = containers.slice(i, i + CONCURRENCY);
        console.log(`Processing batch ${i + 1}-${Math.min(i + CONCURRENCY, containers.length)} of ${containers.length}...`);
        await Promise.all(batch.map(c => processContainer(c)));
    }
}

fix().catch(console.error).finally(() => prisma.$disconnect());

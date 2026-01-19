
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyEnrichment() {
    console.log(">>> VERIFYING ENRICHMENT DATA <<<");

    // Check for specific containers
    const containers = await prisma.container.findMany({
        where: {
            containerNumber: { in: ['ENRICH001', 'ENRICH002', 'ENRICH003'] }
        },
        orderBy: { containerNumber: 'asc' }
    });

    if (containers.length === 0) {
        console.log("❌ No target containers (ENRICH001-003) found.");

        // Debug: Show recent containers
        const recent = await prisma.container.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: { containerNumber: true, createdAt: true, importLogId: true }
        });
        console.log("Most recent 5 containers in DB:", recent);
        return;
    }

    // Print logic verification
    for (const c of containers) {
        console.log(`\n----------------------------------------`);
        console.log(`Container: ${c.containerNumber}`);
        console.log(`Raw Status (Canonical): ${c.currentStatus}`);
        console.log(`Raw ServiceType (Canonical): ${c.serviceType}`);

        const ai = c.aiDerived as any;
        if (ai && ai.fields) {
            console.log(`AI Derived: present`);
            if (ai.fields.serviceType) {
                console.log(`  -> ServiceType: ${ai.fields.serviceType.value}`);
                console.log(`  -> Rationale: ${ai.fields.serviceType.rationale}`);
            } else {
                console.log(`  -> ServiceType: NONE`);
            }
        } else {
            console.log(`AI Derived: NULL/EMPTY`);
        }
    }
}

verifyEnrichment().finally(() => prisma.$disconnect());

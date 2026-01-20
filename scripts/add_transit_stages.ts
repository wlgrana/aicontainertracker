import { prisma } from '../lib/prisma';

async function addTransitStages() {
    console.log('Adding missing transit stages...');

    const stages = [
        { stageName: 'Booked', stageCode: 'BOOKED', sequence: 1, category: 'PRE_SHIPMENT' },
        { stageName: 'Loaded', stageCode: 'LOADED', sequence: 5, category: 'IN_TRANSIT' },
        { stageName: 'In Transit', stageCode: 'IN_TRANSIT', sequence: 7, category: 'IN_TRANSIT' },
        { stageName: 'Discharged', stageCode: 'DISCHARGED', sequence: 10, category: 'IN_TRANSIT' },
        { stageName: 'Arrived', stageCode: 'ARRIVED', sequence: 15, category: 'ARRIVAL' },
        { stageName: 'Customs Cleared', stageCode: 'CUSTOMS_CLEARED', sequence: 16, category: 'ARRIVAL' },
        { stageName: 'Out for Delivery', stageCode: 'OUT_FOR_DELIVERY', sequence: 18, category: 'DELIVERY' },
        { stageName: 'Delivered', stageCode: 'DELIVERED', sequence: 20, category: 'DELIVERY' },
        { stageName: 'Empty Returned', stageCode: 'EMPTY_RETURNED', sequence: 25, category: 'DELIVERY' },
    ];

    for (const stage of stages) {
        try {
            const result = await prisma.transitStage.upsert({
                where: { stageName: stage.stageName },
                update: {},
                create: stage
            });
            console.log(`✅ Added/verified: ${stage.stageCode} - ${stage.stageName}`);
        } catch (error: any) {
            console.error(`❌ Failed to add ${stage.stageName}:`, error.message);
        }
    }

    // List all stages
    const allStages = await prisma.transitStage.findMany({
        orderBy: { sequence: 'asc' }
    });

    console.log('\n📋 All Transit Stages:');
    console.table(allStages.map(s => ({
        Name: s.stageName,
        Code: s.stageCode,
        Category: s.category,
        Sequence: s.sequence
    })));

    await prisma.$disconnect();
    console.log('\n✅ Done!');
}

addTransitStages().catch(console.error);

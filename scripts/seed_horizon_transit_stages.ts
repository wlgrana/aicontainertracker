import { prisma } from '../lib/prisma';

async function addMissingTransitStages() {
    console.log('=== ADDING MISSING TRANSIT STAGES ===\n');

    // Define the missing stages based on the Horizon Tracking Report data
    // Only using fields that exist in the schema: stageName, stageCode, sequence, category
    const newStages = [
        {
            stageName: 'BCN',
            stageCode: 'BCN',
            sequence: 2,
            category: 'PRE_SHIPMENT'
        },
        {
            stageName: 'VSL',
            stageCode: 'VSL',
            sequence: 8,
            category: 'IN_TRANSIT'
        },
        {
            stageName: 'LCL',
            stageCode: 'LCL',
            sequence: 3,
            category: 'PRE_SHIPMENT'
        },
        {
            stageName: 'RTN',
            stageCode: 'RTN',
            sequence: 26,
            category: 'DELIVERY'
        }
    ];

    console.log(`Adding ${newStages.length} new transit stages...\n`);

    for (const stage of newStages) {
        try {
            const result = await prisma.transitStage.upsert({
                where: { stageName: stage.stageName },
                update: {
                    stageCode: stage.stageCode,
                    sequence: stage.sequence,
                    category: stage.category
                },
                create: stage
            });

            console.log(`✅ ${result.stageName} (${result.stageCode}) - Sequence: ${result.sequence}, Category: ${result.category}`);
        } catch (error: any) {
            console.error(`❌ Failed to add ${stage.stageName}:`, error.message);
            console.error('   Full error:', error);
        }
    }

    console.log('\n=== VERIFICATION ===\n');

    // Verify all stages now exist
    const allStages = await prisma.transitStage.findMany({
        orderBy: { sequence: 'asc' }
    });

    console.log(`Total transit stages in database: ${allStages.length}\n`);

    // Check for the specific problematic stages
    const requiredStages = ['BCN', 'RTN', 'VSL', 'LCL'];
    for (const stageName of requiredStages) {
        const found = allStages.find(s => s.stageName === stageName);
        if (found) {
            console.log(`✅ "${stageName}" is now in database`);
        } else {
            console.log(`❌ "${stageName}" still missing!`);
        }
    }

    await prisma.$disconnect();
    console.log('\n✅ Transit stage seeding complete!');
}

addMissingTransitStages().catch(console.error);

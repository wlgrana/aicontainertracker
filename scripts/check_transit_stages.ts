import { prisma } from '../lib/prisma';

async function checkTransitStages() {
    console.log('=== CHECKING TRANSIT STAGES ===\n');

    const stages = await prisma.transitStage.findMany({
        orderBy: { sequence: 'asc' }
    });

    console.log(`Found ${stages.length} transit stages in database:\n`);

    stages.forEach((stage, index) => {
        console.log(`${index + 1}. ${stage.stageName} (${stage.stageCode})`);
        console.log(`   Sequence: ${stage.sequence}, Category: ${stage.category}`);
        if (stage.definition) {
            console.log(`   Definition: ${stage.definition}`);
        }
        console.log('');
    });

    // Check for specific stages mentioned in the error
    const problematicStages = ['BCN', 'RTN', 'Booked', 'Discharged', 'In Transit', 'Delivered'];

    console.log('\n=== CHECKING FOR SPECIFIC STAGES ===\n');

    for (const stageName of problematicStages) {
        const found = stages.find(s =>
            s.stageName === stageName ||
            s.stageCode === stageName
        );

        if (found) {
            console.log(`✅ "${stageName}" exists as: ${found.stageName} (${found.stageCode})`);
        } else {
            console.log(`❌ "${stageName}" NOT FOUND`);
        }
    }

    await prisma.$disconnect();
}

checkTransitStages().catch(console.error);

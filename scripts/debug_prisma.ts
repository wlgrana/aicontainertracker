
import { prisma } from '../lib/prisma';

async function debug() {
    console.log("Checking models...");
    const models = [
        'aceStatusLog', 'aCEStatusLog',
        'dcsaEventMap', 'dCSAEventMap'
    ];

    for (const m of models) {
        if ((prisma as any)[m]) {
            console.log(`✅ ${m} exists`);
        } else {
            console.log(`❌ ${m} does not exist`);
        }
    }

    console.log("All Keys:", Object.keys(prisma).filter(k => !k.startsWith('_') && !k.startsWith('$')));
}

debug()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

import { prisma } from './lib/prisma';

async function main() {
    const stages = [
        { stageName: 'BOOK', sequence: 1, category: 'PRE-TRANSIT' },
        { stageName: 'ARR', sequence: 2, category: 'PORT-IN' },
        { stageName: 'DEP', sequence: 3, category: 'TRANSIT' },
        { stageName: 'HSEA', sequence: 4, category: 'TRANSIT' },
        { stageName: 'DIS', sequence: 5, category: 'PORT-OUT' },
        { stageName: 'CGO', sequence: 6, category: 'PORT-OUT' },
        { stageName: 'DEL', sequence: 7, category: 'FINAL' },
    ];

    for (const s of stages) {
        await prisma.transitStage.upsert({
            where: { stageName: s.stageName },
            update: s,
            create: s
        });
    }
    console.log("Seeded Transit Stages.");
}

main().catch(console.error).finally(() => prisma.$disconnect());

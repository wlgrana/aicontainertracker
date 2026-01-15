
import { prisma } from './lib/prisma';

async function main() {
    const stages = await prisma.transitStage.findMany();
    console.log(stages.map(s => `${s.stageCode} (${s.stageName})`));
    await prisma.$disconnect();
}

main().catch(console.error);

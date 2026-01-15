
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const containerNumber = process.argv[2];
    if (!containerNumber) {
        console.error("Please provide container number");
        return;
    }

    console.log(`Inspecting ${containerNumber}...`);

    const container = await prisma.container.findUnique({
        where: { containerNumber },
        include: {
            events: { orderBy: { eventDateTime: 'desc' } },
            riskAssessment: true
        }
    });

    console.log(JSON.stringify(container, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());

import { PrismaClient } from '@prisma/client';
import { runExceptionClassifier } from './agents/exception-classifier';

const prisma = new PrismaClient();

async function main() {
    const containerNumber = 'MSCU1234567';

    // Clean up if exists
    await prisma.containerEvent.deleteMany({ where: { containerId: containerNumber } });
    await prisma.container.deleteMany({ where: { containerNumber } });

    console.log("Creating Container...");

    const now = new Date();
    const eta = new Date(); eta.setDate(now.getDate() + 3);
    const lfd = new Date(); lfd.setDate(now.getDate() + 7);

    const container = await prisma.container.create({
        data: {
            containerNumber,
            containerType: '40GP',
            currentStatus: 'DEP', // Departed POL
            currentLocation: 'Shanghai',
            carrier: 'Maersk',
            pol: 'Shanghai',
            pod: 'Los Angeles',
            eta: eta,
            lastFreeDay: lfd,
            statusLastUpdated: now, // Just happened
        }
    });

    // Simulate Event creation (normally done by Normalizer/Ingestion)
    await prisma.containerEvent.create({
        data: {
            containerId: containerNumber,
            stageName: 'DEP',
            eventDateTime: now,
            location: 'Shanghai',
            source: 'TestScript',
            notes: 'Initial creation'
        }
    });

    console.log("Running Exception Classifier...");
    await runExceptionClassifier(containerNumber);

    console.log("\n=== VERIFICATION RESULTS ===");

    const resultContainer = await prisma.container.findUnique({
        where: { containerNumber },
        include: { events: true }
    });

    console.log("1. CONTAINER RECORD:");
    console.log(JSON.stringify(resultContainer, null, 2));

    console.log("\n2. EVENTS:");
    console.log(JSON.stringify(resultContainer?.events, null, 2));

    console.log("\n3. EXCEPTIONS:");
    if (resultContainer?.hasException) {
        console.log(`FLAGGED: ${resultContainer.exceptionType} (Owner: ${resultContainer.exceptionOwner})`);
    } else {
        console.log("No exceptions flagged (Correct for 'DEP' status).");
    }

}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());

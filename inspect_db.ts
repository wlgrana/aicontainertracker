
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function inspect() {
    console.log("Inspecting Reference Data...");

    console.log("\n--- Carrier ---");
    const carriers = await prisma.carrier.findMany();
    if (carriers.length === 0) console.log("Empty");
    else console.table(carriers);

    console.log("\n--- Port ---");
    const ports = await prisma.port.findMany();
    if (ports.length === 0) console.log("Empty");
    else console.table(ports);

    console.log("\n--- Forwarder ---");
    const forwarders = await prisma.forwarder.findMany();
    if (forwarders.length === 0) console.log("Empty");
    else console.table(forwarders);

    console.log("\n--- TransitStage ---");
    const stages = await prisma.transitStage.findMany();
    console.log(`Count: ${stages.length}`);
    if (stages.length > 0) console.table(stages);

    console.log("\n--- DemurrageRate ---");
    const rates = await prisma.demurrageRate.findMany();
    if (rates.length === 0) console.log("Empty");
    else console.table(rates);
}

inspect()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());

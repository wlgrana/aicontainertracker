import { PrismaClient } from '@prisma/client';

// Ensure env is loaded
try { process.loadEnvFile(); } catch (e) { }

const prisma = new PrismaClient();

async function testWrite() {
    console.log("Testing Write...");
    const num = `TEST-${Date.now()}`;
    await prisma.container.create({
        data: {
            containerNumber: num,
            currentStatus: 'TEST_WRITE'
        }
    });
    console.log(`Wrote: ${num}`);

    const found = await prisma.container.findUnique({
        where: { containerNumber: num }
    });
    console.log(found ? "✅ Verified Read" : "❌ Read Failed");
}

testWrite()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

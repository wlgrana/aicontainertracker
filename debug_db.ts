import { PrismaClient } from '@prisma/client';

async function debugConnection() {
    console.log("=== DEBUGGING DB CONNECTION ===\n");

    // Check Env
    const url = process.env.DATABASE_URL;
    if (!url) {
        console.log("❌ DATABASE_URL is undefined in process.env");
    } else {
        const masked = url.replace(/:[^:]+@/, ':****@');
        console.log(`✅ DATABASE_URL found: ${masked}`);
    }

    const prisma = new PrismaClient();

    try {
        console.log("🔄 Attempting to connect...");
        await prisma.$connect();
        console.log("✅ Connected successfully.");

        console.log("🔄 Testing write...");
        const testContainer = await prisma.container.create({
            data: {
                containerNumber: 'TEST-CONNECTION-001',
                status: 'TEST',
                type: 'TEST'
            }
        });
        console.log(`✅ Wrote test container: ${testContainer.containerNumber}`);

        console.log("🔄 Testing read...");
        const readBack = await prisma.container.findUnique({
            where: { containerNumber: 'TEST-CONNECTION-001' }
        });

        if (readBack) {
            console.log(`✅ Read back successful: ${readBack.containerNumber}`);
        } else {
            console.log("❌ Read back failed.");
        }

    } catch (e: any) {
        console.error("❌ Connection/Write Error:", e.message);
    } finally {
        await prisma.$disconnect();
    }
}

debugConnection();

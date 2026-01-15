
import { PrismaClient } from '@prisma/client';

try {
    process.loadEnvFile();
} catch (e) {
    // fallback for older node or environments
}

const prisma = new PrismaClient();

async function main() {
    try {
        await prisma.$connect();
        console.log("Connected to DB!");
        const count = await prisma.container.count();
        console.log("Container count:", count);
    } catch (e) {
        console.error("Connection failed:", e.message);
    } finally {
        await prisma.$disconnect();
    }
}
main();

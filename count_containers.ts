
import { prisma } from './lib/prisma';

try { process.loadEnvFile(); } catch (e) { }

async function main() {
    try {
        const count = await prisma.container.count();
        console.log(`Total Containers in DB: ${count}`);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();


import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

// Try to load env file manually if not loaded
try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        console.log("Found .env file at " + envPath);
        const envContent = fs.readFileSync(envPath, 'utf-8');
        envContent.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value && !process.env[key.trim()]) {
                process.env[key.trim()] = value.trim();
            }
        });
    } else {
        console.log("No .env file found in root.");
    }
} catch (e) {
    console.error("Error loading .env:", e);
}

const prisma = new PrismaClient();

async function check() {
    console.log("=== DIAGNOSTIC CHECK ===");
    const url = process.env.DATABASE_URL;
    console.log("DATABASE_URL Env Var: " + (url ? "Set" : "Missing"));
    if (url) {
        // Mask password
        const masked = url.replace(/:([^:@]+)@/, ':****@');
        console.log("URL Value (Masked): " + masked);
    }

    try {
        const cCount = await prisma.container.count();
        console.log(`Container Count: ${cCount}`);

        const exceptionCount = await prisma.container.count({ where: { hasException: true } });
        console.log(`Exception Count: ${exceptionCount}`);

        const errors = await prisma.container.findMany({
            where: { hasException: true },
            select: { containerNumber: true, exceptionType: true, lastFreeDay: true }
        });
        console.log("Exceptions:", JSON.stringify(errors, null, 2));

        const iaCount = await prisma.importLog.count();
        console.log(`ImportLog Count: ${iaCount}`);

        console.log("Attempting Dummy Write...");
        const dummy = await prisma.importLog.create({
            data: {
                fileName: `dummy_${Date.now()}`,
                fileURL: 'test',
                status: 'PENDING'
            }
        });
        console.log("Dummy Write Success: " + dummy.fileName);

        // Clean up
        await prisma.importLog.delete({ where: { fileName: dummy.fileName } });
        console.log("Dummy Cleaned.");

    } catch (e: any) {
        console.error("DB Operation Failed:", e.message || e);
        if (e.code) console.error("Code:", e.code);
    }
}

check().finally(() => prisma.$disconnect());

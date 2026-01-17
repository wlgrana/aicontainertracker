
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyTimeline() {
    console.log('🔍 Verifying Agent Processing Timeline Architecture...');

    try {
        // 1. Verify Prisma Client has the new model
        if (!('agentProcessingLog' in prisma)) {
            throw new Error('❌ AgentProcessingLog model not found in Prisma Client. Did you run `npx prisma generate`?');
        }
        console.log('✅ AgentProcessingLog model exists in Prisma Client.');

        // 2. Check for existing logs
        const count = await prisma.agentProcessingLog.count();
        console.log(`📊 Found ${count} existing Agent Processing Logs.`);

        if (count > 0) {
            const sample = await prisma.agentProcessingLog.findFirst({
                take: 1,
                orderBy: { timestamp: 'desc' },
                include: { container: true }
            });
            console.log('📝 Latest Log Sample:', {
                id: sample?.id,
                container: sample?.containerId,
                stage: sample?.stage,
                status: sample?.status,
                timestamp: sample?.timestamp
            });
        } else {
            console.log('ℹ️ No logs found yet. This is expected if no data has been ingested since the update.');
        }

        // 3. Test Write (Rollback immediately)
        // We need a valid container ID to test relation.
        const container = await prisma.container.findFirst();

        if (container) {
            console.log(`🧪 Testing Write to AgentProcessingLog for Container ${container.containerNumber}...`);

            const testLog = await prisma.agentProcessingLog.create({
                data: {
                    containerId: container.containerNumber,
                    stage: 'ARCHIVIST',
                    status: 'COMPLETED',
                    timestamp: new Date(),
                    output: { note: "Verification Script Test" },
                    confidence: 1.0
                }
            });

            console.log('✅ Write Successful:', testLog.id);

            // Cleanup
            await prisma.agentProcessingLog.delete({
                where: { id: testLog.id }
            });
            console.log('✅ Cleanup Successful (Test log deleted).');

        } else {
            console.log('⚠️ No containers found in DB. Skipping write test.');
        }

        console.log('\n🎉 Verification Complete: Backend schema and Prisma Client are correctly configured!');

    } catch (error) {
        console.error('\n❌ Verification Failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

verifyTimeline();

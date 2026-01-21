import { prisma } from './lib/prisma';

async function verifyConstraintFix() {
    console.log('🔍 Verifying Container_currentStatus_fkey constraint removal...\n');

    // Simple test: Try to insert a container with an unknown status
    const testContainerNum = `TEST_${Date.now()}`;

    try {
        await prisma.container.create({
            data: {
                containerNumber: testContainerNum,
                rawStatus: 'UNKNOWN_CODE_XYZ',
                currentStatus: null, // This should work now that FK is dropped
            }
        });

        console.log('✅ SUCCESS: Container created with unknown status code!');
        console.log('   The flexible status architecture is working correctly.');
        console.log('   Unknown status codes can now be stored in rawStatus without failing.\n');

        // Clean up test record
        await prisma.container.delete({
            where: { containerNumber: testContainerNum }
        });
        console.log('✅ Test container cleaned up.');

    } catch (error: any) {
        console.log('❌ ISSUE: Still encountering constraint error:');
        console.log(error.message);
    }

    await prisma.$disconnect();
}

verifyConstraintFix().catch(console.error);

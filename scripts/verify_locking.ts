
import { PrismaClient } from '@prisma/client';
import { updateContainer } from '../app/actions/operational/actions';
import { saveAssessment } from '../app/actions/ai/persistence';

const prisma = new PrismaClient();

async function runTest() {
    console.log("=== STARTING FIELD LOCKING VERIFICATION ===");

    // 1. Setup: Create a test container and linked SHIPMENT
    const testId = "TEST-LOCK-" + Date.now();
    const testShipmentId = "SHP-" + testId;
    console.log(`Creating test container: ${testId} linked to ${testShipmentId}`);

    await prisma.shipment.create({
        data: {
            shipmentReference: testShipmentId,
            finalDestination: "OLD_DEST",
            businessUnit: "OLD_BU"
        }
    });

    await prisma.container.create({
        data: {
            containerNumber: testId,
            containerType: "20GP",
            carrier: "OLD_CARRIER",
            pol: "OLD_POL",
            pod: "OLD_POD",
            businessUnit: "OLD_BU",
            shipmentContainers: {
                create: {
                    shipmentId: testShipmentId
                }
            }
        }
    });

    try {
        // 2. Test: Manual Update (Should Lock)
        console.log("\n--- TEST 1: Manual Update Locks Field ---");
        const manualUpdate = { pol: "MANUAL_POL" };
        await updateContainer(testId, manualUpdate);

        const afterManual = await prisma.container.findUnique({ where: { containerNumber: testId } });
        console.log("POL after manual update:", afterManual?.pol);
        let lockedFields = (afterManual?.metadata as any)?.lockedFields || [];
        console.log("Locked fields:", lockedFields);

        if (afterManual?.pol !== "MANUAL_POL") throw new Error("Manual update failed to apply.");
        if (!lockedFields.includes("pol")) throw new Error("Manual update failed to lock 'pol'.");
        console.log("✅ TEST 1 PASSED");

        // 3. Test: Linked Field Update (Should Lock & Sync)
        console.log("\n--- TEST 2: Linked Field Update (Dest/BU) ---");
        // Update finalDestination (Shipment) and businessUnit (Both)
        const linkedUpdate = { finalDestination: "MANUAL_DEST", businessUnit: "MANUAL_BU" };
        await updateContainer(testId, linkedUpdate);

        const afterLinkedContainer = await prisma.container.findUnique({ where: { containerNumber: testId } });
        const afterLinkedShipment = await prisma.shipment.findUnique({ where: { shipmentReference: testShipmentId } });

        lockedFields = (afterLinkedContainer?.metadata as any)?.lockedFields || [];
        console.log("Container BU:", afterLinkedContainer?.businessUnit);
        console.log("Shipment Dest:", afterLinkedShipment?.finalDestination);
        console.log("Shipment BU:", afterLinkedShipment?.businessUnit);
        console.log("Locked fields:", lockedFields);

        if (afterLinkedContainer?.businessUnit !== "MANUAL_BU") throw new Error("Container BU failed to update");
        if (afterLinkedShipment?.businessUnit !== "MANUAL_BU") throw new Error("Shipment BU failed to sync");
        if (afterLinkedShipment?.finalDestination !== "MANUAL_DEST") throw new Error("Shipment Dest failed to update");
        if (!lockedFields.includes("finalDestination")) throw new Error("finalDestination not locked");
        if (!lockedFields.includes("businessUnit")) throw new Error("businessUnit not locked");
        console.log("✅ TEST 2 PASSED");

        // 4. Test: AI Overwrite (Should be Rejected)
        console.log("\n--- TEST 3: AI Overwrite Respects Lock (Container & Shipment) ---");
        // Simulate AI trying to revert everything
        const aiAnalysis = {
            structured_metadata: {
                pol: "AI_POL",
                pod: "AI_POD", // unlocked, should update
                final_destination: "AI_DEST",
                business_unit: "AI_BU",
                health_score: 95
            },
            classification: { status: { operational: "ON_RAIL" } }
        };

        await saveAssessment(testId, aiAnalysis);

        const afterAiContainer = await prisma.container.findUnique({ where: { containerNumber: testId } });
        const afterAiShipment = await prisma.shipment.findUnique({ where: { shipmentReference: testShipmentId } });

        console.log("POL after AI (Should be MANUAL_POL):", afterAiContainer?.pol);
        console.log("Dest after AI (Should be MANUAL_DEST):", afterAiShipment?.finalDestination);
        console.log("BU after AI (Should be MANUAL_BU):", afterAiShipment?.businessUnit);
        console.log("POD after AI (Should be AI_POD):", afterAiContainer?.pod);

        if (afterAiContainer?.pol !== "MANUAL_POL") throw new Error("AI incorrectly overwrote locked field 'pol'!");
        if (afterAiShipment?.finalDestination !== "MANUAL_DEST") throw new Error("AI incorrectly overwrote locked field 'finalDestination'!");
        if (afterAiShipment?.businessUnit !== "MANUAL_BU") throw new Error("AI incorrectly overwrote locked field 'businessUnit'!");
        if (afterAiContainer?.pod !== "AI_POD") throw new Error("AI failed to update unlocked field 'pod'.");
        console.log("✅ TEST 3 PASSED");

    } catch (e) {
        console.error("❌ TEST FAILED:", e);
    } finally {
        // Cleanup
        console.log("\nCleaning up...");
        await prisma.shipmentContainer.deleteMany({ where: { containerId: testId } });
        await prisma.container.delete({ where: { containerNumber: testId } });
        await prisma.shipment.delete({ where: { shipmentReference: testShipmentId } });
        await prisma.$disconnect();
    }
}

runTest();

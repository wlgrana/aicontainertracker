import { prisma } from '@/lib/prisma';
import { mediumThink } from '@/lib/ai';

export async function runExceptionClassifier(containerId: string) {
    const container = await prisma.container.findUnique({
        where: { containerNumber: containerId },
        include: {
            stage: true,
            shipmentContainers: {
                include: { shipment: true }
            }
        }
    });

    if (!container) return;

    // --- LIFECYCLE GUARD: Prevent "Zombie Alerts" ---
    // If the container is operationally complete, do NOT run expensive AI checks or flag it.

    // Stages considered "Complete" or "Safe from Port Risk"
    const COMPLETED_STAGES = ['REL', 'AVL', 'CGO', 'DEL', 'RET'];

    // Calculate days since Gate Out (if applicable)
    const daysSinceGateOut = container.gateOutDate
        ? (new Date().getTime() - new Date(container.gateOutDate).getTime()) / (1000 * 3600 * 24)
        : 0;

    const isOperationallyComplete =
        (container.stage?.stageName && COMPLETED_STAGES.includes(container.stage.stageName)) ||
        (container.gateOutDate && daysSinceGateOut > 14);

    if (isOperationallyComplete) {
        // CLEANUP ROUTINE: Clear "Zombie Alerts"
        // If the container is done, it shouldn't have active exceptions.
        if (container.hasException || container.exceptionType) {
            console.log(`[ExceptionClassifier] 🧹 Clearing zombie exception for completed container: ${containerId} (Stage: ${container.stage?.stageName})`);

            await prisma.container.update({
                where: { containerNumber: containerId },
                data: {
                    hasException: false,
                    exceptionType: null,
                    exceptionOwner: null,
                    exceptionDate: null,
                    updatedAt: new Date() // Force timestamp update for verification
                }
            });
        }
        return; // EXIT EARLY
    }

    const now = new Date();
    let exceptionType = null;
    let exceptionOwner = null;

    // --- RULE-BASED DETECTION (Fast) ---

    // Rule 1: Demurrage Risk (LFD Passed)
    if (container.lastFreeDay && container.lastFreeDay < now) {
        if ((container.stage?.sequence || 0) < 170) {
            exceptionType = 'Demurrage Risk';
            exceptionOwner = 'Distribution';
        }
    }

    // Rule 2: Customs Hold
    if (container.currentStatus === 'CUS') {
        const daysInStage = (now.getTime() - (container.statusLastUpdated?.getTime() || 0)) / (1000 * 3600 * 24);
        if (daysInStage > 5) {
            exceptionType = 'Customs Hold';
            exceptionOwner = 'Freight Team';
        }
    }

    // --- AI-BASED DETECTION (Medium Think) ---
    if (!exceptionType) {
        try {
            const prompt = `
            Analyze this container data for any operational exceptions or anomalies:
            CONTAINER: ${JSON.stringify(container, null, 2)}
            NOW: ${now.toISOString()}
            
            Look for:
            - Incorrect status sequences
            - Missing ETA when ETD passed
            - Unusual delays at any stage
            
            Return ONLY a JSON object:
            {
              "isException": boolean,
              "type": "string | null",
              "owner": "string | null",
              "reason": "string | null"
            }
            `;
            const textResponse = await mediumThink(prompt);
            const text = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            const res = JSON.parse(text);

            if (res.isException) {
                exceptionType = res.type;
                exceptionOwner = res.owner;
            }
        } catch (e) {
            console.error("AI Exception Classification failed:", e);
        }
    }

    // Update Container if exception found
    if (exceptionType) {
        await prisma.container.update({
            where: { containerNumber: containerId },
            data: {
                hasException: true,
                exceptionType,
                exceptionOwner,
                exceptionDate: now
            }
        });
    } else {
        // Clear exception if resolved
        if (container.hasException) {
            await prisma.container.update({
                where: { containerNumber: containerId },
                data: {
                    hasException: false,
                    exceptionType: null,
                    exceptionOwner: null,
                    exceptionDate: null
                }
            });
        }
    }
}

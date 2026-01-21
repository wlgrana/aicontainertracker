/**
 * Re-process existing containers through the fixed data normalizer
 * This will update aiOperationalStatus, healthScore, daysInTransit, and aiAttentionCategory
 * for all containers based on their existing data.
 */

import { prisma } from '../lib/prisma';

async function reprocessContainers() {
    console.log('🔄 Starting container reprocessing...\n');

    // Get all containers with their metadata
    const containers = await prisma.container.findMany({
        include: {
            metadata: true
        }
    });

    console.log(`Found ${containers.length} containers to reprocess\n`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const container of containers) {
        try {
            // Extract dates
            const deliveryDate = container.deliveryDate;
            const emptyReturnDate = container.emptyReturnDate;
            const gateOutDate = container.gateOutDate;
            const atd = container.atd;
            const ata = container.ata;
            const lastFreeDay = container.lastFreeDay;

            // Recalculate AI metrics using the FIXED logic
            const now = new Date();
            let daysInTransit = 0;

            // Calculate Days In Transit (from ATD/ETD to Delivery or Now)
            const departureDate = atd || container.etd;
            if (departureDate) {
                const start = new Date(departureDate);
                // For delivered containers, calculate to delivery date; otherwise to now
                const endDate = deliveryDate ? new Date(deliveryDate) : now;
                const diffTime = Math.abs(endDate.getTime() - start.getTime());
                daysInTransit = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            }

            // Calculate Health Score
            let healthScore = 100;
            const lfd = lastFreeDay ? new Date(lastFreeDay) : null;
            if (lfd) {
                const lfdDate = new Date(lfd);
                // Only penalize if past LFD AND not delivered AND not returned
                if (now > lfdDate && !deliveryDate && !emptyReturnDate) {
                    healthScore -= 50; // Critical hit if past LFD and not delivered/returned
                } else if ((lfdDate.getTime() - now.getTime()) < (2 * 24 * 60 * 60 * 1000) && !deliveryDate && !emptyReturnDate) {
                    healthScore -= 20; // Risk if < 2 days and not delivered/returned
                }
            } else if (!deliveryDate && !emptyReturnDate) {
                // Only penalize for missing LFD if container is still active
                healthScore -= 10;
            }

            // Determine AI Standard Status - Complete mapping for all stage codes
            let aiStatus = 'In Transit'; // Default
            const stageName = container.currentStatus; // This is the canonical status code

            if (stageName === 'DEL' || deliveryDate) aiStatus = 'Delivered';
            else if (stageName === 'RET' || emptyReturnDate) aiStatus = 'Completed';
            else if (stageName === 'CGO') aiStatus = 'Gated Out';
            else if (stageName === 'OFD') aiStatus = 'Out for Delivery';
            else if (stageName === 'STRP') aiStatus = 'Empty Return';
            else if (['REL', 'AVL'].includes(stageName || '')) aiStatus = 'Available for Pickup';
            else if (['DIS', 'INSP'].includes(stageName || '')) aiStatus = 'Discharged';
            else if (stageName === 'ARR' || ata) aiStatus = 'Arrived at Port';
            else if (stageName === 'CUS') aiStatus = 'Customs Hold';
            else if (['BOOK', 'CEP', 'CGI', 'STUF', 'LOA'].includes(stageName || '')) aiStatus = 'Booked';
            else if (['DEP', 'TS1', 'TSD', 'TSL', 'TS1D'].includes(stageName || '')) aiStatus = 'In Transit';

            // Determine Attention Category
            let attention = 'Routine';
            if (deliveryDate || emptyReturnDate) attention = 'Resolved';
            else if (healthScore < 60) attention = 'Critical';
            else if (healthScore < 90) attention = 'Warning';

            // Update container
            await prisma.container.update({
                where: { containerNumber: container.containerNumber },
                data: {
                    aiOperationalStatus: aiStatus,
                    healthScore: healthScore,
                    daysInTransit: daysInTransit,
                    aiAttentionCategory: attention,
                    updatedAt: new Date()
                }
            });

            updated++;

            // Log significant changes
            if (container.aiOperationalStatus !== aiStatus) {
                console.log(`✅ ${container.containerNumber}: "${container.aiOperationalStatus}" → "${aiStatus}"`);
            }

        } catch (error) {
            console.error(`❌ Error processing ${container.containerNumber}:`, error);
            errors++;
        }
    }

    console.log('\n=== Reprocessing Complete ===');
    console.log(`✅ Updated: ${updated}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
}

// Run the script
reprocessContainers()
    .then(() => {
        console.log('\n✅ Script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Script failed:', error);
        process.exit(1);
    });

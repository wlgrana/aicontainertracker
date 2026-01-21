/**
 * Quick fix: Update aiOperationalStatus in database for all containers
 * This applies the fixed logic to derive status from existing data
 */

import { prisma } from './lib/prisma';

async function fixContainerStatuses() {
    console.log('🔄 Updating container statuses in database...\n');

    // Get all containers
    const containers = await prisma.container.findMany({
        select: {
            containerNumber: true,
            deliveryDate: true,
            emptyReturnDate: true,
            gateOutDate: true,
            currentStatus: true,
            ata: true,
            aiOperationalStatus: true
        }
    });

    console.log(`Found ${containers.length} containers\n`);

    let updated = 0;
    const updates: Array<{ containerNumber: string; oldStatus: string | null; newStatus: string }> = [];

    for (const container of containers) {
        // Derive correct status using the FIXED logic
        let correctStatus = 'In Transit'; // Default

        if (container.deliveryDate || container.currentStatus === 'DEL') {
            correctStatus = 'Delivered';
        } else if (container.emptyReturnDate || container.currentStatus === 'RET') {
            correctStatus = 'Completed';
        } else if (container.currentStatus === 'CGO' || container.gateOutDate) {
            correctStatus = 'Gated Out';
        } else if (container.currentStatus === 'OFD') {
            correctStatus = 'Out for Delivery';
        } else if (container.currentStatus === 'STRP') {
            correctStatus = 'Empty Return';
        } else if (['REL', 'AVL'].includes(container.currentStatus || '')) {
            correctStatus = 'Available for Pickup';
        } else if (['DIS', 'INSP'].includes(container.currentStatus || '')) {
            correctStatus = 'Discharged';
        } else if (container.currentStatus === 'ARR' || container.ata) {
            correctStatus = 'Arrived at Port';
        } else if (container.currentStatus === 'CUS') {
            correctStatus = 'Customs Hold';
        } else if (['BOOK', 'CEP', 'CGI', 'STUF', 'LOA'].includes(container.currentStatus || '')) {
            correctStatus = 'Booked';
        } else if (['DEP', 'TS1', 'TSD', 'TSL', 'TS1D'].includes(container.currentStatus || '')) {
            correctStatus = 'In Transit';
        }

        // Only update if status is different
        if (container.aiOperationalStatus !== correctStatus) {
            await prisma.container.update({
                where: { containerNumber: container.containerNumber },
                data: { aiOperationalStatus: correctStatus }
            });

            updates.push({
                containerNumber: container.containerNumber,
                oldStatus: container.aiOperationalStatus,
                newStatus: correctStatus
            });
            updated++;
        }
    }

    console.log('\n=== Update Complete ===');
    console.log(`✅ Updated: ${updated} containers\n`);

    if (updates.length > 0) {
        console.log('📋 Changes made:');
        updates.slice(0, 10).forEach(u => {
            console.log(`  ${u.containerNumber}: "${u.oldStatus || 'null'}" → "${u.newStatus}"`);
        });
        if (updates.length > 10) {
            console.log(`  ... and ${updates.length - 10} more`);
        }
    }
}

fixContainerStatuses()
    .then(() => {
        console.log('\n✅ Database update complete');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Update failed:', error);
        process.exit(1);
    });

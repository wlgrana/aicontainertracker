
import { prisma } from '../lib/prisma';

async function seedStages() {
    console.log("🌱 Seeding Transit Stages...");

    const stages = [
        { code: "BOOK", name: "Booking Confirmed", definition: "Booking has been confirmed by carrier" },
        { code: "CEP", name: "Container Empty Pickup", definition: "Empty container picked up from depot" },
        { code: "CGI", name: "Container Gate In", definition: "Full container gated in at origin port" },
        { code: "STUF", name: "Stuffing", definition: "Container loaded with cargo" },
        { code: "LOA", name: "Loaded on Vessel", definition: "Container loaded onto vessel" },
        { code: "DEP", name: "Vessel Departure", definition: "Vessel departed from origin port" },
        { code: "TS1", name: "Transshipment Arrival", definition: "Arrived at transshipment port" },
        { code: "TSD", name: "Transshipment Departure", definition: "Departed from transshipment port" },
        { code: "TSL", name: "Transshipment Loaded", definition: "Loaded onto connecting vessel" },
        { code: "TS1D", name: "Transshipment Discharged", definition: "Discharged at transshipment port" },
        { code: "ARR", name: "Vessel Arrival", definition: "Vessel arrived at destination port" },
        { code: "DIS", name: "Discharged", definition: "Container discharged from vessel" },
        { code: "INSP", name: "Customs Inspection", definition: "Under customs inspection" },
        { code: "CUS", name: "Customs Clearance", definition: "Customs clearance process" },
        { code: "REL", name: "Customs Released", definition: "Released by customs" },
        { code: "AVL", name: "Available for Pickup", definition: "Container available for pickup" },
        { code: "CGO", name: "Container Gate Out", definition: "Full container gated out from terminal" },
        { code: "OFD", name: "Out for Delivery", definition: "Container out for delivery to final destination" },
        { code: "DEL", name: "Delivered", definition: "Cargo delivered to consignee" },
        { code: "STRP", name: "Stripping", definition: "Container unloaded/stripped" },
        { code: "RET", name: "Empty Return", definition: "Empty container returned to depot" },
        { code: "O", name: "Other", definition: "Other status" }
    ];

    let seq = 10;
    for (const stage of stages) {
        await prisma.transitStage.upsert({
            where: { stageName: stage.code },
            update: {},
            create: {
                stageName: stage.code,
                stageCode: stage.code,
                sequence: seq,
                category: "Standard"
            }
        });
        seq += 10;
    }

    console.log(`✅ Seeded ${stages.length} stages.`);
}

seedStages()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });


import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Seeding Reference Data...");

    // --- CARRIERS ---
    const carriers = [
        { carrierName: 'Maersk', scac: 'MAEU', shortName: 'Maersk', trackingURL: 'https://www.maersk.com/tracking/' },
        { carrierName: 'MSC', scac: 'MSCU', shortName: 'MSC', trackingURL: 'https://www.msc.com/track-a-shipment' },
        { carrierName: 'Hapag-Lloyd', scac: 'HLCU', shortName: 'Hapag', trackingURL: 'https://www.hapag-lloyd.com/en/online-business/tracing/tracing-by-booking.html' },
        { carrierName: 'CMA CGM', scac: 'CMDU', shortName: 'CMA CGM', trackingURL: 'https://www.cma-cgm.com/ebusiness/tracking' },
        { carrierName: 'COSCO', scac: 'COSU', shortName: 'COSCO', trackingURL: 'https://lines.coscoshipping.com/home/Tracking' },
        { carrierName: 'ONE', scac: 'ONEY', shortName: 'ONE', trackingURL: 'https://ecomm.one-line.com/ecom/CUP_HOM_3301.do' },
        { carrierName: 'Evergreen', scac: 'EGLV', shortName: 'Evergreen', trackingURL: 'https://www.shipmentlink.com/servlet/TDB1_CargoTracking.do' },
        { carrierName: 'ZIM', scac: 'ZIMU', shortName: 'ZIM', trackingURL: 'https://www.zim.com/tools/track-a-shipment' },
    ];

    for (const c of carriers) {
        await prisma.carrier.upsert({
            where: { carrierName: c.carrierName },
            update: c,
            create: c
        });
    }
    console.log(`Seeded ${carriers.length} Carriers.`);

    // --- PORTS ---
    const ports = [
        { portName: 'Los Angeles', portCode: 'USLAX', country: 'United States', region: 'West Coast' },
        { portName: 'Long Beach', portCode: 'USLGB', country: 'United States', region: 'West Coast' },
        { portName: 'New York', portCode: 'USNYC', country: 'United States', region: 'East Coast' },
        { portName: 'Savannah', portCode: 'USSAV', country: 'United States', region: 'East Coast' },
        { portName: 'Rotterdam', portCode: 'NLRTM', country: 'Netherlands', region: 'Europe' },
        { portName: 'Shanghai', portCode: 'CNSHA', country: 'China', region: 'Asia' },
        { portName: 'Singapore', portCode: 'SGSIN', country: 'Singapore', region: 'Asia' },
    ];

    for (const p of ports) {
        await prisma.port.upsert({
            where: { portName: p.portName },
            update: p,
            create: p
        });
    }
    console.log(`Seeded ${ports.length} Ports.`);

    // --- FORWARDERS ---
    const forwarders = [
        { forwarderName: 'Flexport', shortName: 'Flexport', contactEmail: 'support@flexport.com' },
        { forwarderName: 'Kuehne+Nagel', shortName: 'K+N', contactEmail: 'info@kuehne-nagel.com' },
        { forwarderName: 'DHL Global Forwarding', shortName: 'DHL', contactEmail: 'dgf.cs@dhl.com' },
        { forwarderName: 'DSV', shortName: 'DSV', contactEmail: 'info@dsv.com' },
        { forwarderName: 'DB Schenker', shortName: 'Schenker', contactEmail: 'cs@dbschenker.com' },
    ];

    for (const f of forwarders) {
        await prisma.forwarder.upsert({
            where: { forwarderName: f.forwarderName },
            update: f,
            create: f
        });
    }
    console.log(`Seeded ${forwarders.length} Forwarders.`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());

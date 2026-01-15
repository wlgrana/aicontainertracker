
import * as XLSX from 'xlsx';

// Copying the logic from data-normalizer for verification
const parseDate = (val: any): string | undefined => {
    if (!val) return undefined;

    let d: Date;
    if (typeof val === 'number') {
        if (val > 20000) {
            d = new Date(Math.round((val - 25569) * 86400 * 1000));
        } else {
            d = new Date(val);
        }
    } else {
        d = new Date(val);
    }

    return isNaN(d.getTime()) ? undefined : d.toISOString();
};

function verify() {
    console.log("Verifying Date Fix Logic...");

    console.log("\n1. Testing Excel Serial Number Parsing (Fallback Logic):");
    const serial = 44927; // ~Jan 1 2023
    const parsed = parseDate(serial);
    console.log(`Input: ${serial}, Output: ${parsed}`);
    // Expected: 2023-01-01T00:00:00.000Z (depending on timezone/hydration, but clearly not 1970)

    if (parsed && parsed.startsWith('2023')) {
        console.log("✅ Success: Serial number parsed correctly.");
    } else {
        console.log("❌ Failure: Serial number parsed incorrectly.");
    }

    console.log("\n2. Testing cellDates: true with XLSX:");
    const wb = XLSX.utils.book_new();
    const data = [
        ["Date"],
        [44927]
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    // Explicitly casting as we did in the fix
    const json = XLSX.utils.sheet_to_json(ws, { cellDates: true } as any);
    const row = json[0] as any;
    console.log(`With cellDates: true, raw value is:`, row['Date']);

    if (row['Date'] instanceof Date) {
        console.log(`✅ Success: cellDates: true returns a Date object: ${row['Date'].toISOString()}`);
    } else {
        console.log(`❌ Failure: cellDates: true did not return a Date object (got ${typeof row['Date']})`);
    }
}

verify();

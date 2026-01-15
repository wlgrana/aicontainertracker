
import * as XLSX from 'xlsx';

function reproduce() {
    console.log("Creating workbook with a date...");
    const wb = XLSX.utils.book_new();
    // 44927 is approx Jan 1 2023
    const data = [
        ["Date"],
        [44927], // Raw serial number for a date
        ["2023-01-01"] // String date
    ];
    // Create sheet without cellDates: true (simulating current behavior if date is stored as number in Excel)
    // Note: If we create from AOA, we rely on how we pass data. 
    // To properly simulate, we need to see how sheet_to_json behaves with numbers.

    // Let's manually create a sheet where a cell is a number but formatted as date? 
    // Or just pass a number.
    const ws = XLSX.utils.aoa_to_sheet(data);

    console.log("Reading with default sheet_to_json:");
    const jsonDefault = XLSX.utils.sheet_to_json(ws, { defval: "" });
    console.log(JSON.stringify(jsonDefault, null, 2));

    const row = jsonDefault[0] as any;
    const val = row['Date'];
    console.log(`Value read: ${val} (type: ${typeof val})`);

    if (typeof val === 'number') {
        const d = new Date(val);
        console.log(`new Date(${val}) = ${d.toISOString()}`);
    }

    console.log("\nReading with cellDates: true:");
    const jsonDates = XLSX.utils.sheet_to_json(ws, { defval: "", cellDates: true } as any);
    // Note: cellDates: true only works if the cell has number format applied in Excel. 
    // Since we created AOA without format, it might just stay number.
    // However, the issue is that IF it comes as number, our code fails.

    console.log("Checking fix logic (Excel Serial to JS Date):");
    const excelSerial = 44927;
    // Excel base date is Dec 30 1899 usually? Or Jan 1 1900?
    // Unix epoch is 25569 days after 1900-01-01?
    // Let's use a known conversion.
    const dateFromSerial = new Date(Math.round((excelSerial - 25569) * 86400 * 1000));
    console.log(`Converted ${excelSerial} -> ${dateFromSerial.toISOString()}`);
}

reproduce();

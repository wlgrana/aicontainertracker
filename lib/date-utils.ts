
export function safeDate(val: any): Date | null {
    if (!val) return null;

    // Explicitly handle Numeric Strings (Excel Serial)
    // If we rely on new Date("45719"), it parses as Year 45719 which crashes DB
    if (typeof val === 'number' || (typeof val === 'string' && val.match(/^\d+(\.\d+)?$/))) {
        const num = parseFloat(String(val));
        // Excel Range (1954 - 2064) - serial 20000 is year 1954, 60000 is year 2064
        if (num > 20000 && num < 60000) {
            // Excel base date: Dec 30 1899
            // Formula: (serial - 25569) * 86400 * 1000
            // We use a small epsilon for floating point precision if needed, but simple formula usually works.
            const ms = Math.round((num - 25569) * 86400 * 1000);
            return new Date(ms);
        }
        // Timestamp (milliseconds) check
        if (num > 946684800000) return new Date(num); // > Year 2000
    }

    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;

    return null;
}

export function isExcelSerial(val: any): boolean {
    if (!val) return false;
    if (typeof val === 'number') return val > 20000 && val < 60000;
    if (typeof val === 'string' && val.match(/^\d+(\.\d+)?$/)) {
        const num = parseFloat(val);
        return num > 20000 && num < 60000;
    }
    return false;
}

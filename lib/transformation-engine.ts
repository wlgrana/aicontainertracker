
export function excelDateToJS(serial: number): Date {
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    return new Date(utc_value * 1000);
}

export function parseDate(value: any): string | null {
    if (!value) return null;
    if (typeof value === 'number') {
        // Excel serial
        try { return excelDateToJS(value).toISOString(); } catch (e) { return null; }
    }
    if (typeof value === 'string') {
        const d = new Date(value);
        if (!isNaN(d.getTime())) return d.toISOString();
    }
    return null;
}

export function transformValue(value: any, type: string): any {
    if (value === null || value === undefined) return null;

    switch (type) {
        case 'date_conversion':
            return parseDate(value);
        case 'number':
        case 'float':
        case 'int':
            if (typeof value === 'number') return value;
            const cleaned = String(value).replace(/[^0-9.-]/g, '');
            return parseFloat(cleaned) || 0;
        case 'clean_string':
        case 'direct':
        case 'semantic':
        default:
            if (typeof value === 'string') return value.trim();
            return String(value);
    }
}

export function transformRow(rawData: any[], headers: string[], mapping: any) {
    const containerFields: any = {};
    const meta: any = {};

    // Helper to get value by header name
    const getValue = (headerName: string) => {
        if (!Array.isArray(rawData)) {
            return rawData[headerName];
        }
        const idx = headers.indexOf(headerName);
        if (idx === -1) return undefined;
        return rawData[idx];
    };

    const mappedHeaders = new Set(Object.values(mapping.fieldMappings as Record<string, any>).map((m: any) => m.sourceHeader));

    // 1. Map Known Schema Fields
    for (const [targetField, rule] of Object.entries(mapping.fieldMappings as Record<string, any>)) {
        const sourceHeader = rule.sourceHeader;
        const rawVal = getValue(sourceHeader);

        const transformed = transformValue(rawVal, (rule as any).transformationType || 'direct');

        containerFields[targetField] = {
            value: transformed,
            originalValue: rawVal,
            confidence: 1.0,
            source: sourceHeader
        };
    }

    // 2. Capture Unmapped to Meta
    if (headers.length > 0) {
        headers.forEach((h: string, i: number) => {
            if (!mappedHeaders.has(h)) {
                meta[h] = rawData[i];
            }
        });
    } else {
        // Fallback for object-based data if any (legacy safety)
        if (!Array.isArray(rawData)) {
            for (const [key, val] of Object.entries(rawData)) {
                if (!mappedHeaders.has(key)) meta[key] = val;
            }
        }
    }

    // Flatten for easy object access (simulation of DB row)
    const flat: any = { metadata: meta }; // Nest meta, don't spread!
    for (const [key, obj] of Object.entries(containerFields)) {
        flat[key] = (obj as any).value;
    }

    return {
        fields: containerFields,
        meta: meta,
        flat: flat
    };
}

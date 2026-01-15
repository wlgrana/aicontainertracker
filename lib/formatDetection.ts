import { KNOWN_FORMATS, KnownFormatDefinition } from './knownFormats';

export interface FormatDetectionResult {
    isKnownFormat: boolean;
    format: KnownFormatDefinition | null;
    confidence: number;
    matchedHeaders: string[];
    unmatchedHeaders: string[];
}

export function detectFormat(headers: string[]): FormatDetectionResult {
    const headersLower = headers.map(h => h.toLowerCase().trim());

    let bestMatch: FormatDetectionResult = {
        isKnownFormat: false,
        format: null,
        confidence: 0,
        matchedHeaders: [],
        unmatchedHeaders: headers
    };

    for (const format of KNOWN_FORMATS) {
        const requiredLower = format.requiredHeaders.map(h => h.toLowerCase().trim());

        // Check how many required headers are present
        const matchedRequired = requiredLower.filter(req =>
            headersLower.some(h => h.includes(req) || req.includes(h))
        );

        const confidence = matchedRequired.length / requiredLower.length;

        // If all required headers match, this is a known format
        if (confidence >= 0.8 && confidence > bestMatch.confidence) {
            // Find all headers that map to this format
            const mappingKeysLower = Object.keys(format.columnMapping).map(k => k.toLowerCase().trim());

            const matched = headers.filter(h =>
                mappingKeysLower.some(mk =>
                    h.toLowerCase().trim() === mk ||
                    h.toLowerCase().trim().includes(mk) ||
                    mk.includes(h.toLowerCase().trim())
                )
            );

            const unmatched = headers.filter(h => !matched.includes(h));

            bestMatch = {
                isKnownFormat: true,
                format: format,
                confidence: confidence,
                matchedHeaders: matched,
                unmatchedHeaders: unmatched
            };
        }
    }

    return bestMatch;
}

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Dictionary Learning - Header Mapping Cache
 * 
 * This module provides in-memory caching and database persistence
 * for Excel header to canonical field mappings.
 */

export interface HeaderMappingEntry {
    excelHeader: string;
    canonicalField: string;
    confidence: number;
    timesUsed: number;
}

/**
 * Load all header mappings from database into memory
 * Returns a Map for O(1) lookup: excelHeader (lowercase) -> canonicalField
 */
export async function loadHeaderMappings(): Promise<Map<string, HeaderMappingEntry>> {
    const mappings = await prisma.headerMapping.findMany({
        orderBy: {
            timesUsed: 'desc' // Prioritize most-used mappings
        }
    });

    const lookupMap = new Map<string, HeaderMappingEntry>();

    for (const mapping of mappings) {
        const key = mapping.excelHeader.toLowerCase().trim();

        // If multiple mappings exist for same header, keep the one with highest usage
        const existing = lookupMap.get(key);
        if (!existing || mapping.timesUsed > existing.timesUsed) {
            lookupMap.set(key, {
                excelHeader: mapping.excelHeader,
                canonicalField: mapping.canonicalField,
                confidence: mapping.confidence,
                timesUsed: mapping.timesUsed
            });
        }
    }

    console.log(`[Dictionary] Loaded ${lookupMap.size} header mappings from database`);
    return lookupMap;
}

/**
 * Check if a header exists in the dictionary
 */
export function getDictionaryMatch(
    header: string,
    dictionaryMap: Map<string, HeaderMappingEntry>
): HeaderMappingEntry | null {
    const key = header.toLowerCase().trim();
    return dictionaryMap.get(key) || null;
}

/**
 * Save or update a header mapping in the database
 * Called after successful import with high-confidence AI mappings
 */
export async function saveHeaderMapping(
    excelHeader: string,
    canonicalField: string,
    confidence: number
): Promise<void> {
    try {
        // Check if mapping already exists
        const existing = await prisma.headerMapping.findFirst({
            where: {
                excelHeader: excelHeader,
                canonicalField: canonicalField
            }
        });

        if (existing) {
            // Increment usage counter and update last used timestamp
            await prisma.headerMapping.update({
                where: { id: existing.id },
                data: {
                    timesUsed: { increment: 1 },
                    lastUsedAt: new Date()
                }
            });
            console.log(`[Dictionary] Updated mapping: "${excelHeader}" -> "${canonicalField}" (used ${existing.timesUsed + 1} times)`);
        } else {
            // Create new mapping
            await prisma.headerMapping.create({
                data: {
                    excelHeader,
                    canonicalField,
                    confidence,
                    timesUsed: 1
                }
            });
            console.log(`[Dictionary] Created new mapping: "${excelHeader}" -> "${canonicalField}" (confidence: ${confidence})`);
        }
    } catch (error) {
        console.error(`[Dictionary] Error saving mapping "${excelHeader}" -> "${canonicalField}":`, error);
    }
}

/**
 * Save multiple header mappings in batch
 * Only saves mappings with confidence >= threshold
 */
export async function saveHeaderMappingsBatch(
    mappings: Array<{ excelHeader: string; canonicalField: string; confidence: number }>,
    confidenceThreshold: number = 0.9
): Promise<number> {
    const highConfidenceMappings = mappings.filter(m => m.confidence >= confidenceThreshold);

    if (highConfidenceMappings.length === 0) {
        console.log(`[Dictionary] No mappings met confidence threshold (${confidenceThreshold})`);
        return 0;
    }

    console.log(`[Dictionary] Saving ${highConfidenceMappings.length} high-confidence mappings...`);

    for (const mapping of highConfidenceMappings) {
        await saveHeaderMapping(mapping.excelHeader, mapping.canonicalField, mapping.confidence);
    }

    return highConfidenceMappings.length;
}

/**
 * Delete a specific header mapping (for admin cleanup)
 */
export async function deleteHeaderMapping(id: string): Promise<void> {
    await prisma.headerMapping.delete({
        where: { id }
    });
    console.log(`[Dictionary] Deleted mapping with ID: ${id}`);
}

/**
 * Get all header mappings for admin view
 */
export async function getAllHeaderMappings() {
    return await prisma.headerMapping.findMany({
        orderBy: [
            { timesUsed: 'desc' },
            { canonicalField: 'asc' }
        ]
    });
}

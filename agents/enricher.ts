
import { EnricherInput, EnricherOutput, AiDerivedData, AiDerivedField } from '../types/agents';

/**
 * ENRICHER AGENT
 * 
 * Role: Post-persistence enrichment of container data.
 * Philosophy: 
 *  1. Zero Overwrite: Never touch canonical fields.
 *  2. Zero Data Loss: Read from preserved raw metadata.
 *  3. Transparency: All derived data lives in 'aiDerived' column.
 */

export function runEnricher(input: EnricherInput): EnricherOutput {
    // 1. Initialize empty derived structure
    const derived: AiDerivedData = {
        lastRun: new Date().toISOString(),
        mode: input.mode,
        fields: {}
    };

    const { container, rawMetadata } = input;
    const raw = rawMetadata || {};
    const canonical = container;

    // --- RULE 1: Service Type Inference ---
    // Heuristic: LCL/FCL regex on various raw fields OR canonical status
    // Gating: Only run if canonical ServiceType is missing
    if (!canonical.serviceType) {
        const serviceTypeResult = inferServiceType(raw, canonical);
        if (serviceTypeResult) {
            derived.fields['serviceType'] = serviceTypeResult;
        }
    }

    // --- RULE 2: Status Inference ---
    // Triangulate between ATD, ATA, and currentStatus
    // Gating: Built-in to inferStatus (checks if current is weak/missing)
    const statusInference = inferStatus(canonical, raw);
    if (statusInference) {
        derived.fields['statusInference'] = statusInference;
        derived.statusInference = statusInference.value; // Convenience top-level
    }

    // --- RULE 3: Destination Cleaning ---
    // Standardize 'Ship to City'
    // Gating: Only run if canonical FinalDestination is missing
    if (!canonical.finalDestination) {
        const destResult = cleanDestination(raw, canonical);
        if (destResult) {
            derived.fields['finalDestination'] = destResult;
        }
    }

    // --- MODE SPECIFIC: ON_DEMAND ---
    if (input.mode === 'ON_DEMAND') {
        // Here we would run async/expensive estimates (e.g. ETA calculation)
        // For Phase 1, we just return the deterministic results
    }

    if (process.env.LOG_LEVEL === 'trace') {
        console.log(`[Enricher-TRACE] Input for ${input.container.containerNumber}:`);
        console.log(JSON.stringify(input, null, 2));
        console.log(`[Enricher-TRACE] Derived Result:`);
        console.log(JSON.stringify(derived, null, 2));
    }
    return {
        containerNumber: container.containerNumber,
        aiDerived: derived,
        summary: `Enriched ${Object.keys(derived.fields).length} fields`
    };
}

// ==========================================
// DETERMINISTIC RULES
// ==========================================


function inferServiceType(raw: Record<string, any>, canonical: Record<string, any>): AiDerivedField | null {
    // fields to check in order of likelihood
    const candidates = ['Shipping Type', 'Container Type', 'Service', 'Svc Type', 'Load Type', 'Ship Type', 'Status', 'Current Status'];

    // 1. Check Canonical Status first (often mislabeled as Status)
    if (canonical.currentStatus) {
        const val = String(canonical.currentStatus).toUpperCase();
        if (isFCL(val)) return createServiceTypeResult('FCL', 'HIGH', 'canonical.currentStatus', 'Found FCL pattern in Status');
        if (isLCL(val)) return createServiceTypeResult('LCL', 'HIGH', 'canonical.currentStatus', 'Found LCL pattern in Status');
    }

    // 2. Find the first existing raw field
    let foundValue: string | null = null;
    let foundKey: string | null = null;

    for (const key of Object.keys(raw)) {
        const normKey = key.toLowerCase().replace(/[^a-z]/g, '');
        if (candidates.some(c => normKey.includes(c.toLowerCase().replace(/[^a-z]/g, '')))) {
            if (raw[key]) {
                foundValue = String(raw[key]);
                foundKey = key;
                break;
            }
        }
    }

    if (!foundValue || !foundKey) return null;

    const val = foundValue.toUpperCase();
    if (isLCL(val)) return createServiceTypeResult('LCL', 'HIGH', foundKey, `Matched 'LCL' in '${foundKey}'`);
    if (isFCL(val)) return createServiceTypeResult('FCL', 'HIGH', foundKey, `Matched FCL/Size pattern in '${foundKey}'`);

    return null;
}

// Helpers
const isLCL = (v: string) => v.includes('LCL') || v.includes('LESS');
const isFCL = (v: string) => v.includes('FCL') || v.includes('FULL') || v.includes('CY/CY') || v.includes('20') || valIsContainerSize(v);
const valIsContainerSize = (v: string) => (v.includes('40') || v.includes('20')) && (v.includes('HC') || v.includes('ST') || v.includes('GP') || v.includes('DV'));

const createServiceTypeResult = (value: string, confidence: 'HIGH' | 'MED' | 'LOW', source: string, rationale: string): AiDerivedField => ({
    value, confidence, source, rationale, method: 'Regex_ServiceType'
});


function inferStatus(canonical: Record<string, any>, raw: Record<string, any>): AiDerivedField | null {
    // Priority: DEL > CGO > RET > ARR > DEP > BOOK
    const deliveryDate = canonical.deliveryDate;
    const gateOutDate = canonical.gateOutDate;
    const emptyReturnDate = canonical.emptyReturnDate;
    const ata = canonical.ata;
    const atd = canonical.atd;
    const etd = canonical.etd;
    const current = canonical.currentStatus;

    // Helper to check if date is valid
    const has = (d: any) => d && new Date(d).toString() !== 'Invalid Date';

    // 1. DELIVERED
    if (has(deliveryDate)) {
        if (current !== 'DEL') {
            return mkStatus('DEL', 'HIGH', 'canonical.deliveryDate', 'Delivery date present');
        }
    }

    // 2. EMPTY RETURN (after delivery, usually) - Note: User logic put RET after CGO? 
    // Usually: GateOut -> Delivery -> EmptyReturn. 
    // Let's follow user Spec: "IF deliveryDate exists -> DEL... ELSE IF gateOutDate -> CGO... ELSE IF emptyReturnDate -> RET"
    // Wait, physically RET comes last. If I have RET date, I must be done.
    // User spec: 
    // IF deliveryDate exists → "DEL"
    // ELSE IF gateOutDate exists → "CGO"
    // ELSE IF emptyReturnDate exists → "RET"
    // This implies if I have all 3, I am DEL. If I only have GateOut, I am CGO.
    // Actually, if I have EmptyReturn, I have completed the cycle. RET is final.
    // Let's refine based on Logical Flow:
    // If EmptyReturn exists -> RET
    // Else if Delivery exists -> DEL
    // Else if GateOut exists -> CGO
    // Else if ATA exists -> ARR/DIS
    // Else if ATD exists -> DEP
    // Else if ETD exists -> BOOK

    // User's specific requested order was: DEL first.
    // "IF deliveryDate exists → Status = "DEL""
    // That means if I have DeliveryDate, I am DEL. Even if I have EmptyReturn? 
    // Maybe "Delivered" is the state they want to see if multiple exist.
    // Let's strictly follow the "ELSE IF" chain provided by USER in SCENARIO 2.

    if (has(deliveryDate)) return mkStatus('DEL', 'HIGH', 'canonical.deliveryDate', 'Delivery date exists');

    if (has(gateOutDate)) return mkStatus('CGO', 'HIGH', 'canonical.gateOutDate', 'Gate Out date exists');

    if (has(emptyReturnDate)) return mkStatus('RET', 'HIGH', 'canonical.emptyReturnDate', 'Empty Return date exists');

    if (has(ata)) {
        // "ARR" or "DIS". DIS is Discharged. ARR is Arrived.
        // If we have no other info, ARR is safer.
        // User said: "Status = "ARR" or "DIS" (depends on if discharged)"
        // Since we don't have discharge date separate in canonical usually (ATA is arrival), Default to ARR.
        if (current !== 'ARR' && current !== 'DIS') {
            return mkStatus('ARR', 'HIGH', 'canonical.ata', 'ATA exists');
        }
    }

    if (has(atd)) return mkStatus('DEP', 'HIGH', 'canonical.atd', 'ATD exists');

    if (has(etd) && (!current || current === '')) return mkStatus('BOOK', 'MED', 'canonical.etd', 'ETD exists (assuming Booked)');

    return null;
}

const mkStatus = (val: string, conf: 'HIGH' | 'MED' | 'LOW', src: string, why: string): AiDerivedField => ({
    value: val, confidence: conf, source: src, rationale: why, method: 'Date_Inference'
});

function cleanDestination(raw: Record<string, any>, canonical: Record<string, any>): AiDerivedField | null {
    // Try to find raw city
    const candidates = ['Ship to City', 'Delv Place', 'Final Dest', 'Destination'];
    let val: string | null = null;
    let source: string | null = null;

    for (const key of Object.keys(raw)) {
        if (candidates.some(c => key.toLowerCase().includes(c.toLowerCase()))) {
            if (raw[key]) {
                val = String(raw[key]);
                source = key;
                break;
            }
        }
    }

    if (!val || !source) return null;

    // Logic: Title Case
    let cleaned = val.toLowerCase().replace(/(^|\s)\S/g, l => l.toUpperCase()).trim();

    // Logic: Append state if POD gives a hint? (Too complex for simple heuristic without DB)
    // Just return cleaned for now

    if (cleaned !== val) {
        return {
            value: cleaned,
            confidence: 'MED',
            source: source,
            method: 'Text_Cleanup',
            rationale: 'Standardized capitalization'
        };
    }

    return null;
}

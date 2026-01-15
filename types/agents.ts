// ============================================
// ARCHIVIST TYPES
// ============================================

export interface ArchivistInput {
    filePath: string;
    fileName: string;
    uploadedBy?: string;
}

export interface ArchivistOutput {
    importLogId: string;
    rawRowIds: string[];
    headers: string[];
    rowCount: number;
    fileMetadata: {
        fileName: string;
        sheetName: string;
        uploadedAt: string;
        fileHash: string;
    };
}

// ============================================
// TRANSLATOR TYPES
// ============================================

export interface TranslatorInput {
    importLogId: string;
    headers: string[];
    rawRows: RawRowData[];
    existingSchemaFields: string[];
    transitStages: string[];
    auditorFeedback?: AuditorFeedback; // For revision rounds
}

export interface RawRowData {
    id: string;
    rowIndex: number;
    rawData: Record<string, any>;
}

export interface TranslatorOutput {
    schemaMapping: SchemaMapping;
    containers: MappedContainer[];
    events: MappedEvent[];
    confidenceReport: ConfidenceReport;
}

export interface SchemaMapping {
    detectedForwarder: string | null;
    fieldMappings: Record<string, FieldMapping>;
    unmappedSourceFields: UnmappedField[];
    missingSchemaFields: string[];
}

export interface FieldMapping {
    sourceHeader: string;
    targetField: string;
    confidence: number;
    transformationType: 'direct' | 'semantic' | 'date_conversion' | 'code_lookup';
    notes?: string;
}

export interface UnmappedField {
    sourceHeader: string;
    sampleValue: any;
    suggestedField: string | null;
    potentialMeaning: string;
    confidence: number;
}

export interface MappedContainer {
    rawRowId: string;
    fields: Record<string, MappedValue>;
    overallConfidence: number;
    flagsForReview: string[];
}

export interface MappedValue {
    value: any;
    originalValue: any;
    confidence: number;
    source: string;
    transformation?: string;
}

export interface MappedEvent {
    rawRowId: string;
    containerId?: string;
    stageName: string;
    eventDateTime: string;
    location?: string;
    source: 'ExcelImport';
    confidence: number;
    derivedFrom: string;
}

export interface ConfidenceReport {
    overallScore: number;
    totalFields: number;
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
    flaggedForReview: number;
    summary: string;
}

// ============================================
// AUDITOR TYPES
// ============================================

export interface AuditorInput {
    containerNumber: string;
    rawData: {
        raw: {
            originalRow: Record<string, any>;
        };
        mapping: Record<string, any>;
    };
    databaseRow: Record<string, any>;
}

export interface AuditorOutput {
    containerNumber: string;
    auditResult: "PASS" | "FAIL";
    verified: VerifiedField[];
    lost: LostField[];
    wrong: WrongField[];
    unmapped: UnmappedFieldAudit[];
    corrections: {
        fieldsToUpdate: Record<string, any>;
        metadataToAdd: Record<string, any>;
    };
    summary: {
        totalRawFields: number;
        verified: number;
        lost: number;
        wrong: number;
        unmapped: number;
        captureRate: string;
        recommendation: "AUTO_CORRECT" | "HUMAN_REVIEW";
    };
}

export interface VerifiedField {
    field: string;
    rawField: string;
    rawValue: any;
    dbValue: any;
    status: "MATCH";
    note?: string;
}

export interface LostField {
    field: string;
    rawField: string;
    rawValue: any;
    dbValue: null | undefined;
    severity: "high" | "medium" | "low";
    correction: {
        column: string;
        value: any;
    };
    convertedValue?: any;
}

export interface WrongField {
    field: string;
    rawField: string;
    rawValue: any;
    dbValue: any;
    severity: "high" | "medium" | "low";
    correction: {
        column: string;
        value: any;
    };
}

export interface UnmappedFieldAudit {
    rawField: string;
    rawValue: any;
    suggestedStorage: string;
    severity: "low" | "medium" | "high";
}

// Legacy type referenced by TranslatorInput
export type AuditorFeedback = any;

// Legacy FinalReport if needed (likely unused now)
export interface FinalReport {
    approvedAt: string;
    totalContainers: number;
    totalEvents: number;
    averageConfidence: number;
    flaggedForHumanReview: FlaggedContainer[];
    summary: string;
}

export interface FlaggedContainer {
    rawRowId: string;
    containerNumber: string;
    reasons: string[];
}

// ============================================
// ORACLE CHAT TYPES
// ============================================

export interface OracleChatContext {
    containerId: string;
    containerNumber: string;
    currentStatus: string;
    carrier: string;
    pol: string;
    pod: string;
    finalDestination: string;
    eta: string | null;
    ata: string | null;
    etd: string | null;
    atd: string | null;
    lastFreeDay: string | null;
    deliveryDate: string | null;
    events: ContainerEventSummary[];
    attentionFlags: AttentionFlagSummary[];
    dataQuality: {
        importSource: string;
        importDate: string;
        overallConfidence: number;
        flaggedFields: string[];
    };
}

export interface ContainerEventSummary {
    date: string;
    stageName: string;
    location: string;
    source: string;
    confidence: number;
}

export interface AttentionFlagSummary {
    id: string;
    priority: string;
    reason: string;
    status: 'active' | 'resolved';
    createdAt: string;
}

export interface OracleChatMessage {
    role: 'user' | 'assistant';
    content: string;
    toolCalls?: ToolCall[];
}

export interface ToolCall {
    name: string;
    arguments: Record<string, any>;
    result?: any;
}

# Shipment Tracker Agent Architecture Review
**Date**: January 21, 2026  
**Reviewer**: AI Assistant  
**Trigger**: Status bug discovery (delivered containers showing "In Transit")

---

## Executive Summary

The Shipment Tracker employs a **12-agent architecture** organized into three tiers:
1. **Ingestion Pipeline** (5 agents): Archivist → Schema Detector → Translator → Data Normalizer → Auditor
2. **Post-Processing** (3 agents): Enricher, Exception Classifier, Director
3. **Continuous Improvement** (4 agents): Improvement Analyzer, Dictionary Updater, Improvement Orchestrator, Oracle Chat

### Critical Findings

✅ **Strengths**:
- Well-separated concerns with clear agent responsibilities
- Robust retry logic and error handling in most agents
- Strong data provenance tracking (zero data loss philosophy)
- AI-powered learning loop for schema evolution

❌ **Critical Gaps Identified**:
1. **No Validation Agent** - Business logic inconsistencies not caught
2. **Incomplete Status Mappings** - Only 5 of 21 stage codes mapped in data-normalizer
3. **Health Score Logic Errors** - Delivered containers penalized for LFD violations
4. **Days in Transit Calculation** - Not adjusted for delivered containers
5. **Exception Classifier Gaps** - Doesn't check for delivered status

---

## Agent-by-Agent Analysis

### **Tier 1: Ingestion Pipeline**

#### 1. **Archivist** (`agents/archivist.ts`)
**Role**: Excel file ingestion and metadata preservation  
**Status**: ✅ **HEALTHY**

**Responsibilities**:
- Upload Excel files to storage
- Detect header rows using AI
- Create ImportLog records
- Preserve raw data for forensics

**Strengths**:
- Robust header detection with AI fallback
- Complete file hash tracking for deduplication
- Proper error handling and logging

**Issues**: None identified

**Recommendations**: None

---

#### 2. **Schema Detector** (`agents/schema-detector.ts`)
**Role**: Map vendor-specific headers to canonical schema  
**Status**: ✅ **HEALTHY**

**Responsibilities**:
- Detect carrier format from headers
- Map columns to canonical fields
- Identify unmapped fields with AI insights
- Cache status code mappings

**Strengths**:
- Comprehensive canonical field list (40+ fields)
- AI-powered unmapped field analysis
- Format detection and caching

**Issues**: None identified

**Recommendations**:
- Consider adding validation for required field coverage
- Add metrics for mapping confidence distribution

---

#### 3. **Translator** (`agents/translator.ts`)
**Role**: Transform vendor data to canonical format  
**Status**: ⚠️ **NEEDS ATTENTION**

**Responsibilities**:
- Apply schema mappings to raw data
- Normalize status codes
- Convert dates to ISO format
- Load business unit and ontology dictionaries

**Strengths**:
- Comprehensive status code mapping dictionary (30+ codes)
- Robust date conversion logic
- Heuristic fallback when AI unavailable
- Retry logic with exponential backoff

**Issues**:
1. **Status normalization happens here AND in data-normalizer** - potential for inconsistency
2. Some status codes map to human-readable names ("In Transit") while others use codes ("DEL")

**Recommendations**:
- Consolidate status normalization to single location
- Standardize on either codes or human-readable names throughout pipeline
- Add validation that normalized status exists in TransitStage table

---

#### 4. **Data Normalizer** (`agents/data-normalizer.ts`)
**Role**: Normalize data and calculate AI metrics  
**Status**: 🔴 **CRITICAL ISSUES FOUND & FIXED**

**Responsibilities**:
- Parse and validate dates
- Detect delivery/return dates from unmapped fields
- Calculate days in transit
- Calculate health scores
- Determine AI operational status
- Categorize attention level

**Issues Found**:
1. ✅ **FIXED**: Missing delivered status check (original bug)
2. ✅ **FIXED**: Incomplete stage-to-status mappings (only 5 of 21 codes)
3. ✅ **FIXED**: Health score penalizing delivered containers
4. ✅ **FIXED**: Days in transit not adjusted for delivery date
5. ✅ **FIXED**: Attention category not prioritizing delivered/returned

**Recommendations**:
- Add unit tests for all 21 stage codes
- Add validation that `aiOperationalStatus` aligns with `stageName`
- Consider extracting AI metrics calculation to separate agent

---

#### 5. **Auditor** (`agents/auditor.ts`)
**Role**: Verify data integrity after persistence  
**Status**: ⚠️ **LIMITED SCOPE**

**Responsibilities**:
- Compare raw data to database record
- Identify lost fields
- Identify wrong values
- Identify unmapped fields

**Strengths**:
- AI-powered discrepancy detection
- Comprehensive logging to AgentProcessingLog
- Retry logic with timeout

**Issues**:
1. **Only checks data integrity, not business logic**
2. Doesn't validate status consistency (e.g., delivery date vs status)
3. Doesn't check for required field completeness

**Recommendations**:
- Expand to include business logic validation
- Add checks for:
  - Status consistency with dates
  - Required field completeness
  - Health score accuracy
  - Days in transit reasonableness

---

### **Tier 2: Post-Processing Agents**

#### 6. **Enricher** (`agents/enricher.ts`)
**Role**: Derive additional fields from raw data  
**Status**: ✅ **HEALTHY**

**Responsibilities**:
- Infer service type (FCL/LCL)
- Infer status from dates
- Clean destination names
- Store all derived data in `aiDerived` JSON column

**Strengths**:
- Zero overwrite philosophy (never touches canonical fields)
- Transparent derivation with confidence scores
- Deterministic rules with clear rationale

**Issues**: None identified

**Recommendations**:
- Consider adding more inference rules:
  - Container type from container number
  - Carrier from BL prefix
  - Business unit from shipper/consignee

---

#### 7. **Exception Classifier** (`agents/exception-classifier.ts`)
**Role**: Detect operational exceptions  
**Status**: ⚠️ **NEEDS ENHANCEMENT**

**Responsibilities**:
- Detect demurrage risk (past LFD)
- Detect customs holds
- Use AI for anomaly detection
- Clear "zombie alerts" for completed containers

**Strengths**:
- Lifecycle guards prevent false alerts on completed containers
- Hybrid rule-based + AI approach
- Automatic cleanup of stale exceptions

**Issues**:
1. **Doesn't check for delivery date** - only checks `emptyReturnDate`
2. Completed stages list missing some codes (e.g., 'DEL', 'STRP', 'OFD')
3. AI prompt doesn't include delivery date context

**Recommendations**:
- Add delivery date to lifecycle guard
- Expand COMPLETED_STAGES to include all terminal stages
- Update AI prompt to include delivery date context

---

#### 8. **Director** (`agents/director.ts`)
**Role**: Determine UI state and demurrage calculations  
**Status**: ✅ **HEALTHY**

**Responsibilities**:
- Calculate demurrage based on LFD
- Determine container mode (COMPLETE, ACTIVE, RISK_MONITOR, TRANSIT, RISK_DETENTION)
- Provide UI theme colors and progress steps

**Strengths**:
- Robust date handling
- Clear mode logic with lifecycle awareness
- Separate detention vs demurrage calculations

**Issues**: None identified

**Recommendations**:
- Consider checking `deliveryDate` in addition to `gateOutDate` for ACTIVE mode

---

### **Tier 3: Continuous Improvement**

#### 9. **Improvement Analyzer** (`agents/improvement-analyzer.ts`)
**Role**: Analyze unmapped fields and suggest improvements  
**Status**: ✅ **HEALTHY**

**Responsibilities**:
- Analyze unmapped headers
- Suggest canonical field mappings
- Provide confidence scores
- Recommend actions (ADD_SYNONYM, etc.)

**Strengths**:
- AI-powered with full ontology context
- Structured JSON output
- Confidence-based recommendations

**Issues**: None identified

**Recommendations**: None

---

#### 10. **Dictionary Updater** (`agents/dictionary-updater.ts`)
**Role**: Update ontology with approved suggestions  
**Status**: ✅ **HEALTHY**

**Responsibilities**:
- Add synonyms to ontology
- Add pending fields for manual review
- Version bump ontology
- Handle nested synonym structures

**Strengths**:
- Robust field definition search with multiple variations
- Confidence threshold enforcement
- Automatic version management

**Issues**: None identified

**Recommendations**:
- Add validation that added synonyms don't conflict with existing mappings

---

#### 11. **Improvement Orchestrator** (`agents/improvement-orchestrator.ts`)
**Role**: Run iterative improvement loops on benchmark files  
**Status**: ✅ **HEALTHY**

**Responsibilities**:
- Run full pipeline on benchmark files
- Calculate coverage and quality scores
- Trigger analyzer and updater
- Track iteration metrics
- Stop when targets met or no improvements

**Strengths**:
- Comprehensive scoring system
- Isolated database mode for testing
- Detailed iteration tracking
- Automatic stop conditions

**Issues**: None identified

**Recommendations**:
- Consider adding regression detection (score decrease alerts)

---

#### 12. **Oracle Chat** (`agents/oracle-chat.ts`)
**Role**: Conversational AI for container queries  
**Status**: ✅ **HEALTHY**

**Responsibilities**:
- Answer user questions about containers
- Provide context-aware responses
- Offer tool calls (add_note, update_status)

**Strengths**:
- Full container context hydration
- Tool integration for actions
- Event and flag awareness

**Issues**: None identified

**Recommendations**:
- Add more tools (request_pickup, escalate_exception, etc.)

---

## Critical Gap: Missing Validation Agent

### **Problem**
The current architecture has no agent that validates **business logic consistency**. The Auditor only checks data integrity (lost/wrong fields), not logical consistency.

### **Example Issues Not Caught**:
- ✅ Container has delivery date but status says "In Transit" (FIXED in data-normalizer)
- ⚠️ Container past LFD but health score is 100
- ⚠️ Container with gate out date but no delivery date showing "Delivered"
- ⚠️ Days in transit > 365 (likely data error)
- ⚠️ ATA before ATD (impossible timeline)

### **Recommendation: Create Validation Agent**

```typescript
// agents/validator.ts
export interface ValidationRule {
  name: string;
  check: (container: any) => boolean;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  message: string;
}

const VALIDATION_RULES: ValidationRule[] = [
  {
    name: 'delivery_status_consistency',
    check: (c) => {
      if (c.deliveryDate && c.aiOperationalStatus !== 'Delivered') {
        return false; // FAIL
      }
      return true;
    },
    severity: 'ERROR',
    message: 'Container has delivery date but status is not "Delivered"'
  },
  {
    name: 'health_score_delivered',
    check: (c) => {
      if (c.deliveryDate && c.healthScore < 90) {
        return false; // FAIL
      }
      return true;
    },
    severity: 'WARNING',
    message: 'Delivered container has low health score'
  },
  {
    name: 'timeline_consistency',
    check: (c) => {
      if (c.ata && c.atd && new Date(c.ata) < new Date(c.atd)) {
        return false; // FAIL
      }
      return true;
    },
    severity: 'ERROR',
    message: 'Arrival date is before departure date'
  },
  {
    name: 'days_in_transit_reasonable',
    check: (c) => {
      if (c.daysInTransit && c.daysInTransit > 365) {
        return false; // FAIL
      }
      return true;
    },
    severity: 'WARNING',
    message: 'Days in transit exceeds 1 year'
  },
  {
    name: 'lfd_health_score_consistency',
    check: (c) => {
      const now = new Date();
      const lfd = c.lastFreeDay ? new Date(c.lastFreeDay) : null;
      if (lfd && lfd < now && !c.deliveryDate && !c.emptyReturnDate && c.healthScore >= 90) {
        return false; // FAIL
      }
      return true;
    },
    severity: 'WARNING',
    message: 'Container past LFD but health score is high'
  }
];

export async function runValidator(containerNumber: string) {
  const container = await prisma.container.findUnique({
    where: { containerNumber },
    include: { /* ... */ }
  });

  const failures: ValidationFailure[] = [];

  for (const rule of VALIDATION_RULES) {
    if (!rule.check(container)) {
      failures.push({
        rule: rule.name,
        severity: rule.severity,
        message: rule.message,
        containerNumber
      });
    }
  }

  if (failures.length > 0) {
    await prisma.agentProcessingLog.create({
      data: {
        containerId: containerNumber,
        stage: 'VALIDATOR',
        status: failures.some(f => f.severity === 'ERROR') ? 'FAILED' : 'COMPLETED',
        timestamp: new Date(),
        findings: { failures }
      }
    });
  }

  return { passed: failures.length === 0, failures };
}
```

---

## Agent Execution Flow

### **Import Pipeline**
```
1. User uploads Excel → Archivist
2. Archivist → Schema Detector
3. Schema Detector → Data Normalizer (for each row)
4. Data Normalizer → Translator
5. Translator → Persistence (lib/persistence.ts)
6. Persistence → Auditor
7. Auditor → Enricher (optional)
8. Enricher → Exception Classifier (optional)
```

### **Post-Import Processing**
```
1. Exception Classifier runs on schedule or trigger
2. Director calculates UI state on page load
3. Oracle Chat available for user queries
```

### **Continuous Improvement Loop**
```
1. Improvement Orchestrator triggers on benchmark files
2. Orchestrator → Full pipeline → Analyzer
3. Analyzer → Dictionary Updater
4. Repeat until targets met
```

---

## Recommendations Summary

### **Immediate Actions** (Critical)
1. ✅ **COMPLETED**: Fix data-normalizer status mappings
2. ✅ **COMPLETED**: Fix health score logic
3. ✅ **COMPLETED**: Fix days in transit calculation
4. 🔲 **Create Validation Agent** with business logic rules
5. 🔲 **Update Exception Classifier** to check delivery dates

### **Short-term Improvements** (High Priority)
1. 🔲 Add unit tests for all 21 stage codes
2. 🔲 Consolidate status normalization to single location
3. 🔲 Expand Auditor to include business logic validation
4. 🔲 Add more inference rules to Enricher

### **Long-term Enhancements** (Medium Priority)
1. 🔲 Add regression detection to Improvement Orchestrator
2. 🔲 Add more tools to Oracle Chat
3. 🔲 Create metrics dashboard for agent performance
4. 🔲 Add agent execution time tracking

---

## Metrics to Track

### **Agent Performance**
- Execution time per agent
- Success/failure rates
- Retry counts
- AI token usage

### **Data Quality**
- Field coverage percentage
- Mapping confidence distribution
- Validation failure rates by rule
- Exception detection accuracy

### **Learning Loop**
- Synonyms added per iteration
- Coverage improvement per iteration
- Time to convergence
- Benchmark file scores

---

## Conclusion

The Shipment Tracker agent architecture is **well-designed** with clear separation of concerns and robust error handling. However, the discovery of the status bug revealed a **critical gap**: the lack of a **Validation Agent** to catch business logic inconsistencies.

**Key Takeaway**: Data integrity checks (Auditor) are not sufficient. We need **business logic validation** to catch issues like:
- Status inconsistencies with dates
- Health score calculation errors
- Timeline impossibilities
- Metric calculation errors

The fixes applied to the data-normalizer address the immediate issues, but a Validation Agent would have caught these bugs during the import process, preventing them from reaching production.

**Recommendation**: Implement the Validation Agent as the next priority to prevent similar issues in the future.

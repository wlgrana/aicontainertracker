# Validator Agent Implementation Plan
**Created**: January 21, 2026  
**Status**: 📋 Ready for Implementation  
**Priority**: 🔴 High  
**Estimated Time**: 1-2 hours

---

## Background

### Problem Statement
The status bug (delivered containers showing "In Transit") revealed a critical architectural gap: **no agent validates business logic consistency**. While the Auditor checks data integrity (lost/wrong fields), it doesn't catch logical inconsistencies like:

- Container has delivery date but status says "In Transit"
- Container past LFD but health score is 100
- ATA before ATD (impossible timeline)
- Days in transit > 365 (likely data error)

### Root Cause Analysis
The bug occurred because:
1. Data Normalizer had incomplete logic for `aiOperationalStatus`
2. No agent validated that status was consistent with dates
3. Bug reached production undetected

### Solution
Create a **Validator Agent** that runs after enrichment to validate business logic consistency and flag issues before they reach production.

---

## Architecture

### Agent Position in Pipeline
```
Import Flow:
Archivist → Schema Detector → Data Normalizer → Translator → Persistence 
  → Auditor → Enricher → **VALIDATOR** ← NEW
  → Exception Classifier
```

### Design Principles
1. **Non-Destructive**: Never modifies data, only reports issues
2. **Comprehensive**: Validates all critical business logic
3. **Actionable**: Provides clear error messages with context
4. **Performant**: Uses deterministic rules (no AI calls)
5. **Extensible**: Easy to add new validation rules

---

## Implementation Specification

### File Structure
```
agents/
  ├── validator.ts                    # Main validator agent
  ├── validation-rules.ts             # Rule definitions
  └── prompts/
      └── validator-system.md         # AI prompt (future enhancement)

types/
  └── agents.ts                       # Add ValidatorInput/Output types
```

### Type Definitions

```typescript
// types/agents.ts

export type ValidationSeverity = 'ERROR' | 'WARNING' | 'INFO';

export interface ValidationRule {
  id: string;                         // Unique rule identifier
  name: string;                       // Human-readable name
  description: string;                // What this rule checks
  severity: ValidationSeverity;       // Error level
  check: (container: any) => boolean; // Validation function (returns true if VALID)
  getMessage: (container: any) => string; // Error message generator
  category: 'STATUS' | 'DATES' | 'METRICS' | 'TIMELINE' | 'BUSINESS_LOGIC';
}

export interface ValidationFailure {
  ruleId: string;
  ruleName: string;
  severity: ValidationSeverity;
  category: string;
  message: string;
  containerNumber: string;
  timestamp: Date;
  context?: Record<string, any>; // Additional debugging context
}

export interface ValidatorInput {
  containerNumber: string;
  skipLogging?: boolean;
}

export interface ValidatorOutput {
  passed: boolean;
  failures: ValidationFailure[];
  warnings: ValidationFailure[];
  infos: ValidationFailure[];
  summary: string;
}
```

---

## Validation Rules

### Category 1: Status Consistency

#### Rule 1.1: Delivery Status Consistency
```typescript
{
  id: 'delivery_status_consistency',
  name: 'Delivery Status Consistency',
  description: 'Containers with delivery dates must have "Delivered" status',
  severity: 'ERROR',
  category: 'STATUS',
  check: (c) => {
    if (!c.deliveryDate) return true; // N/A
    return c.aiOperationalStatus === 'Delivered';
  },
  getMessage: (c) => 
    `Container has delivery date (${c.deliveryDate}) but status is "${c.aiOperationalStatus}"`
}
```

#### Rule 1.2: Return Status Consistency
```typescript
{
  id: 'return_status_consistency',
  name: 'Return Status Consistency',
  description: 'Containers with empty return dates must have "Completed" status',
  severity: 'ERROR',
  category: 'STATUS',
  check: (c) => {
    if (!c.emptyReturnDate) return true;
    return c.aiOperationalStatus === 'Completed';
  },
  getMessage: (c) => 
    `Container has empty return date (${c.emptyReturnDate}) but status is "${c.aiOperationalStatus}"`
}
```

#### Rule 1.3: Gate Out Status Consistency
```typescript
{
  id: 'gate_out_status_consistency',
  name: 'Gate Out Status Consistency',
  description: 'Containers with gate out dates should not show "In Transit" or "At Port"',
  severity: 'WARNING',
  category: 'STATUS',
  check: (c) => {
    if (!c.gateOutDate) return true;
    if (c.deliveryDate || c.emptyReturnDate) return true; // Already delivered/returned
    return !['In Transit', 'Arrived at Port', 'Discharged'].includes(c.aiOperationalStatus);
  },
  getMessage: (c) => 
    `Container gated out on ${c.gateOutDate} but status is "${c.aiOperationalStatus}"`
}
```

### Category 2: Timeline Consistency

#### Rule 2.1: ATA After ATD
```typescript
{
  id: 'ata_after_atd',
  name: 'Arrival After Departure',
  description: 'Actual arrival must be after actual departure',
  severity: 'ERROR',
  category: 'TIMELINE',
  check: (c) => {
    if (!c.ata || !c.atd) return true;
    return new Date(c.ata) >= new Date(c.atd);
  },
  getMessage: (c) => 
    `Arrival date (${c.ata}) is before departure date (${c.atd})`
}
```

#### Rule 2.2: Delivery After Departure
```typescript
{
  id: 'delivery_after_departure',
  name: 'Delivery After Departure',
  description: 'Delivery date must be after departure date',
  severity: 'ERROR',
  category: 'TIMELINE',
  check: (c) => {
    if (!c.deliveryDate || !c.atd) return true;
    return new Date(c.deliveryDate) >= new Date(c.atd);
  },
  getMessage: (c) => 
    `Delivery date (${c.deliveryDate}) is before departure date (${c.atd})`
}
```

#### Rule 2.3: Gate Out After Arrival
```typescript
{
  id: 'gate_out_after_arrival',
  name: 'Gate Out After Arrival',
  description: 'Gate out date should be after arrival at port',
  severity: 'WARNING',
  category: 'TIMELINE',
  check: (c) => {
    if (!c.gateOutDate || !c.ata) return true;
    return new Date(c.gateOutDate) >= new Date(c.ata);
  },
  getMessage: (c) => 
    `Gate out date (${c.gateOutDate}) is before arrival date (${c.ata})`
}
```

### Category 3: Metrics Accuracy

#### Rule 3.1: Health Score for Delivered Containers
```typescript
{
  id: 'health_score_delivered',
  name: 'Health Score for Delivered Containers',
  description: 'Delivered containers should have high health scores',
  severity: 'WARNING',
  category: 'METRICS',
  check: (c) => {
    if (!c.deliveryDate) return true;
    return c.healthScore >= 90;
  },
  getMessage: (c) => 
    `Delivered container has low health score (${c.healthScore}/100)`
}
```

#### Rule 3.2: Days in Transit Reasonable
```typescript
{
  id: 'days_in_transit_reasonable',
  name: 'Days in Transit Reasonable',
  description: 'Days in transit should be less than 1 year',
  severity: 'WARNING',
  category: 'METRICS',
  check: (c) => {
    if (c.daysInTransit === null || c.daysInTransit === undefined) return true;
    return c.daysInTransit <= 365;
  },
  getMessage: (c) => 
    `Days in transit (${c.daysInTransit}) exceeds 1 year - possible data error`
}
```

#### Rule 3.3: Days in Transit Non-Negative
```typescript
{
  id: 'days_in_transit_positive',
  name: 'Days in Transit Non-Negative',
  description: 'Days in transit cannot be negative',
  severity: 'ERROR',
  category: 'METRICS',
  check: (c) => {
    if (c.daysInTransit === null || c.daysInTransit === undefined) return true;
    return c.daysInTransit >= 0;
  },
  getMessage: (c) => 
    `Days in transit is negative (${c.daysInTransit}) - calculation error`
}
```

### Category 4: Business Logic

#### Rule 4.1: LFD vs Health Score
```typescript
{
  id: 'lfd_health_score_consistency',
  name: 'LFD vs Health Score Consistency',
  description: 'Containers past LFD should have reduced health scores',
  severity: 'WARNING',
  category: 'BUSINESS_LOGIC',
  check: (c) => {
    const now = new Date();
    const lfd = c.lastFreeDay ? new Date(c.lastFreeDay) : null;
    
    if (!lfd) return true; // N/A
    if (c.deliveryDate || c.emptyReturnDate) return true; // Completed
    if (lfd >= now) return true; // Not past LFD yet
    
    // Past LFD and not completed - health score should be < 90
    return c.healthScore < 90;
  },
  getMessage: (c) => {
    const daysOverdue = Math.ceil((new Date().getTime() - new Date(c.lastFreeDay).getTime()) / (1000 * 60 * 60 * 24));
    return `Container is ${daysOverdue} days past LFD but health score is ${c.healthScore}/100`;
  }
}
```

#### Rule 4.2: Required Fields for Active Containers
```typescript
{
  id: 'required_fields_active',
  name: 'Required Fields for Active Containers',
  description: 'Active containers must have carrier, POL, POD',
  severity: 'WARNING',
  category: 'BUSINESS_LOGIC',
  check: (c) => {
    if (c.deliveryDate || c.emptyReturnDate) return true; // Completed
    return !!(c.carrier && c.pol && c.pod);
  },
  getMessage: (c) => {
    const missing = [];
    if (!c.carrier) missing.push('carrier');
    if (!c.pol) missing.push('POL');
    if (!c.pod) missing.push('POD');
    return `Active container missing required fields: ${missing.join(', ')}`;
  }
}
```

### Category 5: Date Validity

#### Rule 5.1: Future Dates
```typescript
{
  id: 'no_future_actual_dates',
  name: 'No Future Actual Dates',
  description: 'Actual dates (ATD, ATA, delivery) cannot be in the future',
  severity: 'ERROR',
  category: 'DATES',
  check: (c) => {
    const now = new Date();
    const actualDates = [
      { name: 'ATD', value: c.atd },
      { name: 'ATA', value: c.ata },
      { name: 'Delivery', value: c.deliveryDate },
      { name: 'Gate Out', value: c.gateOutDate },
      { name: 'Empty Return', value: c.emptyReturnDate }
    ];
    
    for (const date of actualDates) {
      if (date.value && new Date(date.value) > now) {
        return false;
      }
    }
    return true;
  },
  getMessage: (c) => {
    const now = new Date();
    const futureDates = [];
    if (c.atd && new Date(c.atd) > now) futureDates.push(`ATD (${c.atd})`);
    if (c.ata && new Date(c.ata) > now) futureDates.push(`ATA (${c.ata})`);
    if (c.deliveryDate && new Date(c.deliveryDate) > now) futureDates.push(`Delivery (${c.deliveryDate})`);
    if (c.gateOutDate && new Date(c.gateOutDate) > now) futureDates.push(`Gate Out (${c.gateOutDate})`);
    if (c.emptyReturnDate && new Date(c.emptyReturnDate) > now) futureDates.push(`Empty Return (${c.emptyReturnDate})`);
    return `Actual dates in the future: ${futureDates.join(', ')}`;
  }
}
```

---

## Implementation Code

### agents/validation-rules.ts
```typescript
import { ValidationRule } from '../types/agents';

export const VALIDATION_RULES: ValidationRule[] = [
  // STATUS CONSISTENCY RULES
  {
    id: 'delivery_status_consistency',
    name: 'Delivery Status Consistency',
    description: 'Containers with delivery dates must have "Delivered" status',
    severity: 'ERROR',
    category: 'STATUS',
    check: (c) => {
      if (!c.deliveryDate) return true;
      return c.aiOperationalStatus === 'Delivered';
    },
    getMessage: (c) => 
      `Container has delivery date (${c.deliveryDate}) but status is "${c.aiOperationalStatus}"`
  },
  
  {
    id: 'return_status_consistency',
    name: 'Return Status Consistency',
    description: 'Containers with empty return dates must have "Completed" status',
    severity: 'ERROR',
    category: 'STATUS',
    check: (c) => {
      if (!c.emptyReturnDate) return true;
      return c.aiOperationalStatus === 'Completed';
    },
    getMessage: (c) => 
      `Container has empty return date (${c.emptyReturnDate}) but status is "${c.aiOperationalStatus}"`
  },

  {
    id: 'gate_out_status_consistency',
    name: 'Gate Out Status Consistency',
    description: 'Containers with gate out dates should not show "In Transit" or "At Port"',
    severity: 'WARNING',
    category: 'STATUS',
    check: (c) => {
      if (!c.gateOutDate) return true;
      if (c.deliveryDate || c.emptyReturnDate) return true;
      return !['In Transit', 'Arrived at Port', 'Discharged'].includes(c.aiOperationalStatus);
    },
    getMessage: (c) => 
      `Container gated out on ${c.gateOutDate} but status is "${c.aiOperationalStatus}"`
  },

  // TIMELINE CONSISTENCY RULES
  {
    id: 'ata_after_atd',
    name: 'Arrival After Departure',
    description: 'Actual arrival must be after actual departure',
    severity: 'ERROR',
    category: 'TIMELINE',
    check: (c) => {
      if (!c.ata || !c.atd) return true;
      return new Date(c.ata) >= new Date(c.atd);
    },
    getMessage: (c) => 
      `Arrival date (${c.ata}) is before departure date (${c.atd})`
  },

  {
    id: 'delivery_after_departure',
    name: 'Delivery After Departure',
    description: 'Delivery date must be after departure date',
    severity: 'ERROR',
    category: 'TIMELINE',
    check: (c) => {
      if (!c.deliveryDate || !c.atd) return true;
      return new Date(c.deliveryDate) >= new Date(c.atd);
    },
    getMessage: (c) => 
      `Delivery date (${c.deliveryDate}) is before departure date (${c.atd})`
  },

  {
    id: 'gate_out_after_arrival',
    name: 'Gate Out After Arrival',
    description: 'Gate out date should be after arrival at port',
    severity: 'WARNING',
    category: 'TIMELINE',
    check: (c) => {
      if (!c.gateOutDate || !c.ata) return true;
      return new Date(c.gateOutDate) >= new Date(c.ata);
    },
    getMessage: (c) => 
      `Gate out date (${c.gateOutDate}) is before arrival date (${c.ata})`
  },

  // METRICS ACCURACY RULES
  {
    id: 'health_score_delivered',
    name: 'Health Score for Delivered Containers',
    description: 'Delivered containers should have high health scores',
    severity: 'WARNING',
    category: 'METRICS',
    check: (c) => {
      if (!c.deliveryDate) return true;
      return c.healthScore >= 90;
    },
    getMessage: (c) => 
      `Delivered container has low health score (${c.healthScore}/100)`
  },

  {
    id: 'days_in_transit_reasonable',
    name: 'Days in Transit Reasonable',
    description: 'Days in transit should be less than 1 year',
    severity: 'WARNING',
    category: 'METRICS',
    check: (c) => {
      if (c.daysInTransit === null || c.daysInTransit === undefined) return true;
      return c.daysInTransit <= 365;
    },
    getMessage: (c) => 
      `Days in transit (${c.daysInTransit}) exceeds 1 year - possible data error`
  },

  {
    id: 'days_in_transit_positive',
    name: 'Days in Transit Non-Negative',
    description: 'Days in transit cannot be negative',
    severity: 'ERROR',
    category: 'METRICS',
    check: (c) => {
      if (c.daysInTransit === null || c.daysInTransit === undefined) return true;
      return c.daysInTransit >= 0;
    },
    getMessage: (c) => 
      `Days in transit is negative (${c.daysInTransit}) - calculation error`
  },

  // BUSINESS LOGIC RULES
  {
    id: 'lfd_health_score_consistency',
    name: 'LFD vs Health Score Consistency',
    description: 'Containers past LFD should have reduced health scores',
    severity: 'WARNING',
    category: 'BUSINESS_LOGIC',
    check: (c) => {
      const now = new Date();
      const lfd = c.lastFreeDay ? new Date(c.lastFreeDay) : null;
      
      if (!lfd) return true;
      if (c.deliveryDate || c.emptyReturnDate) return true;
      if (lfd >= now) return true;
      
      return c.healthScore < 90;
    },
    getMessage: (c) => {
      const daysOverdue = Math.ceil((new Date().getTime() - new Date(c.lastFreeDay).getTime()) / (1000 * 60 * 60 * 24));
      return `Container is ${daysOverdue} days past LFD but health score is ${c.healthScore}/100`;
    }
  },

  {
    id: 'required_fields_active',
    name: 'Required Fields for Active Containers',
    description: 'Active containers must have carrier, POL, POD',
    severity: 'WARNING',
    category: 'BUSINESS_LOGIC',
    check: (c) => {
      if (c.deliveryDate || c.emptyReturnDate) return true;
      return !!(c.carrier && c.pol && c.pod);
    },
    getMessage: (c) => {
      const missing = [];
      if (!c.carrier) missing.push('carrier');
      if (!c.pol) missing.push('POL');
      if (!c.pod) missing.push('POD');
      return `Active container missing required fields: ${missing.join(', ')}`;
    }
  },

  // DATE VALIDITY RULES
  {
    id: 'no_future_actual_dates',
    name: 'No Future Actual Dates',
    description: 'Actual dates (ATD, ATA, delivery) cannot be in the future',
    severity: 'ERROR',
    category: 'DATES',
    check: (c) => {
      const now = new Date();
      const actualDates = [
        { name: 'ATD', value: c.atd },
        { name: 'ATA', value: c.ata },
        { name: 'Delivery', value: c.deliveryDate },
        { name: 'Gate Out', value: c.gateOutDate },
        { name: 'Empty Return', value: c.emptyReturnDate }
      ];
      
      for (const date of actualDates) {
        if (date.value && new Date(date.value) > now) {
          return false;
        }
      }
      return true;
    },
    getMessage: (c) => {
      const now = new Date();
      const futureDates = [];
      if (c.atd && new Date(c.atd) > now) futureDates.push(`ATD (${c.atd})`);
      if (c.ata && new Date(c.ata) > now) futureDates.push(`ATA (${c.ata})`);
      if (c.deliveryDate && new Date(c.deliveryDate) > now) futureDates.push(`Delivery (${c.deliveryDate})`);
      if (c.gateOutDate && new Date(c.gateOutDate) > now) futureDates.push(`Gate Out (${c.gateOutDate})`);
      if (c.emptyReturnDate && new Date(c.emptyReturnDate) > now) futureDates.push(`Empty Return (${c.emptyReturnDate})`);
      return `Actual dates in the future: ${futureDates.join(', ')}`;
    }
  }
];
```

### agents/validator.ts
```typescript
import { prisma } from '@/lib/prisma';
import { ValidatorInput, ValidatorOutput, ValidationFailure } from '../types/agents';
import { VALIDATION_RULES } from './validation-rules';

export async function runValidator(input: ValidatorInput): Promise<ValidatorOutput> {
  console.log(`[Validator] Validating container ${input.containerNumber}...`);

  // Fetch container with all related data
  const container = await prisma.container.findUnique({
    where: { containerNumber: input.containerNumber },
    include: {
      stage: true,
      shipmentContainers: {
        include: { shipment: true }
      }
    }
  });

  if (!container) {
    throw new Error(`Container ${input.containerNumber} not found`);
  }

  const failures: ValidationFailure[] = [];
  const warnings: ValidationFailure[] = [];
  const infos: ValidationFailure[] = [];

  // Run all validation rules
  for (const rule of VALIDATION_RULES) {
    try {
      const isValid = rule.check(container);
      
      if (!isValid) {
        const failure: ValidationFailure = {
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          category: rule.category,
          message: rule.getMessage(container),
          containerNumber: input.containerNumber,
          timestamp: new Date(),
          context: {
            description: rule.description
          }
        };

        // Categorize by severity
        if (rule.severity === 'ERROR') {
          failures.push(failure);
        } else if (rule.severity === 'WARNING') {
          warnings.push(failure);
        } else {
          infos.push(failure);
        }
      }
    } catch (error) {
      console.error(`[Validator] Error running rule ${rule.id}:`, error);
      // Continue with other rules
    }
  }

  const allFailures = [...failures, ...warnings, ...infos];
  const passed = failures.length === 0;

  // Generate summary
  let summary = '';
  if (passed) {
    if (warnings.length > 0) {
      summary = `Validation passed with ${warnings.length} warning(s)`;
    } else {
      summary = 'All validation checks passed';
    }
  } else {
    summary = `Validation failed: ${failures.length} error(s), ${warnings.length} warning(s)`;
  }

  // Log to AgentProcessingLog if not skipped
  if (!input.skipLogging && allFailures.length > 0) {
    try {
      await prisma.agentProcessingLog.create({
        data: {
          containerId: input.containerNumber,
          stage: 'VALIDATOR',
          status: passed ? 'COMPLETED' : 'FAILED',
          timestamp: new Date(),
          findings: {
            summary,
            errors: failures.length,
            warnings: warnings.length,
            infos: infos.length
          },
          output: {
            failures: allFailures.map(f => ({
              rule: f.ruleId,
              severity: f.severity,
              category: f.category,
              message: f.message
            }))
          }
        }
      });
    } catch (logErr) {
      console.error(`[Validator] Failed to log processing event:`, logErr);
    }
  }

  return {
    passed,
    failures,
    warnings,
    infos,
    summary
  };
}
```

---

## Integration Points

### 1. Import Orchestrator
Add validator to the import pipeline:

```typescript
// lib/import-orchestrator.ts

// After enricher runs
if (enrichResult) {
  // Run validator
  const validationResult = await runValidator({
    containerNumber: normalized.container.containerNumber,
    skipLogging: false
  });

  if (!validationResult.passed) {
    console.warn(`[Validator] Container ${normalized.container.containerNumber} failed validation:`, validationResult.summary);
    // Optionally: flag container for review
  }
}
```

### 2. Manual Re-Run Action
Add ability to manually trigger validation:

```typescript
// app/actions/reRunAgentAction.ts

export async function runValidatorAgent(containerNumber: string) {
  try {
    const result = await runValidator({
      containerNumber,
      skipLogging: false
    });

    return {
      success: result.passed,
      summary: result.summary,
      failures: result.failures,
      warnings: result.warnings
    };
  } catch (error) {
    return {
      success: false,
      error: String(error)
    };
  }
}
```

### 3. Batch Validation Script
Create script to validate all containers:

```typescript
// scripts/validate-all-containers.ts

import { prisma } from '../lib/prisma';
import { runValidator } from '../agents/validator';

async function validateAllContainers() {
  const containers = await prisma.container.findMany({
    select: { containerNumber: true }
  });

  console.log(`Validating ${containers.length} containers...`);

  let passed = 0;
  let failed = 0;
  const criticalIssues: string[] = [];

  for (const container of containers) {
    const result = await runValidator({
      containerNumber: container.containerNumber,
      skipLogging: true // Don't spam logs
    });

    if (result.passed) {
      passed++;
    } else {
      failed++;
      if (result.failures.length > 0) {
        criticalIssues.push(`${container.containerNumber}: ${result.summary}`);
      }
    }
  }

  console.log(`\n=== Validation Summary ===`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`\nCritical Issues:`);
  criticalIssues.forEach(issue => console.log(`  - ${issue}`));
}

validateAllContainers();
```

---

## Testing Strategy

### Unit Tests
```typescript
// __tests__/agents/validator.test.ts

describe('Validator Agent', () => {
  describe('delivery_status_consistency', () => {
    it('should pass for delivered container with correct status', () => {
      const container = {
        deliveryDate: '2026-01-15',
        aiOperationalStatus: 'Delivered'
      };
      const rule = VALIDATION_RULES.find(r => r.id === 'delivery_status_consistency');
      expect(rule.check(container)).toBe(true);
    });

    it('should fail for delivered container with wrong status', () => {
      const container = {
        deliveryDate: '2026-01-15',
        aiOperationalStatus: 'In Transit'
      };
      const rule = VALIDATION_RULES.find(r => r.id === 'delivery_status_consistency');
      expect(rule.check(container)).toBe(false);
    });
  });

  // Add tests for all rules...
});
```

### Integration Tests
```typescript
// __tests__/integration/validator-pipeline.test.ts

describe('Validator Pipeline Integration', () => {
  it('should catch status bug in import pipeline', async () => {
    // Import container with delivery date
    // Verify validator catches status inconsistency
  });

  it('should log validation failures to AgentProcessingLog', async () => {
    // Run validator on invalid container
    // Verify log entry created
  });
});
```

---

## Monitoring & Metrics

### Dashboard Metrics
- Validation pass rate (overall and by rule)
- Most common validation failures
- Validation failures by category
- Trend over time

### Alerts
- Alert when validation pass rate drops below threshold
- Alert on critical validation failures (ERROR severity)
- Alert on new validation rule failures

---

## Future Enhancements

### Phase 2: AI-Powered Validation
- Add AI validation for complex patterns
- Anomaly detection using historical data
- Predictive validation (flag potential future issues)

### Phase 3: Auto-Correction
- Suggest fixes for validation failures
- Auto-correct low-risk issues with user approval
- Learning from manual corrections

### Phase 4: Custom Rules
- Allow users to define custom validation rules
- Rule builder UI
- Rule versioning and testing

---

## Rollout Plan

### Phase 1: Development (Week 1)
- [ ] Implement validation rules
- [ ] Implement validator agent
- [ ] Add unit tests
- [ ] Add integration tests

### Phase 2: Testing (Week 2)
- [ ] Run batch validation on production data
- [ ] Analyze validation failures
- [ ] Tune rule thresholds
- [ ] Fix any false positives

### Phase 3: Integration (Week 3)
- [ ] Integrate into import pipeline
- [ ] Add manual re-run action
- [ ] Create validation dashboard
- [ ] Deploy to production

### Phase 4: Monitoring (Week 4)
- [ ] Monitor validation metrics
- [ ] Gather user feedback
- [ ] Iterate on rules
- [ ] Document learnings

---

## Success Criteria

1. **Bug Prevention**: Validator catches the status bug type automatically
2. **Performance**: Validation adds < 100ms to import pipeline
3. **Accuracy**: < 5% false positive rate
4. **Coverage**: All critical business logic validated
5. **Adoption**: Integrated into all import flows

---

## Appendix: Example Validation Output

```json
{
  "passed": false,
  "failures": [
    {
      "ruleId": "delivery_status_consistency",
      "ruleName": "Delivery Status Consistency",
      "severity": "ERROR",
      "category": "STATUS",
      "message": "Container has delivery date (2026-01-15T00:00:00.000Z) but status is \"In Transit\"",
      "containerNumber": "HDMU2765032",
      "timestamp": "2026-01-21T20:49:00.000Z",
      "context": {
        "description": "Containers with delivery dates must have \"Delivered\" status"
      }
    }
  ],
  "warnings": [
    {
      "ruleId": "health_score_delivered",
      "ruleName": "Health Score for Delivered Containers",
      "severity": "WARNING",
      "category": "METRICS",
      "message": "Delivered container has low health score (75/100)",
      "containerNumber": "HDMU2765032",
      "timestamp": "2026-01-21T20:49:00.000Z",
      "context": {
        "description": "Delivered containers should have high health scores"
      }
    }
  ],
  "infos": [],
  "summary": "Validation failed: 1 error(s), 1 warning(s)"
}
```

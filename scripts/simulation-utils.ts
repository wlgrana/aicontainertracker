
import fs from 'fs';
import path from 'path';

const STATUS_FILE = path.join(process.cwd(), 'simulation_status.json');

export interface SimulationStatus {
    step: string;
    progress: number;
    message: string;
    metrics?: Record<string, any>;
    agentData?: Record<string, any>;
    timestamp: number;
}

export function updateStatus(status: Partial<SimulationStatus>) {
    let current: SimulationStatus = { step: 'IDLE', progress: 0, message: 'Ready', timestamp: Date.now() };
    if (fs.existsSync(STATUS_FILE)) {
        try { current = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8')); } catch (e) { }
    }
    const next = { ...current, ...status, timestamp: Date.now() };

    // Merge metrics deep
    if (status.metrics) {
        next.metrics = {
            ...current.metrics,
            ...status.metrics,
            baseline: { ...current.metrics?.baseline, ...status.metrics.baseline },
            final: { ...current.metrics?.final, ...status.metrics.final },
            improvement: { ...current.metrics?.improvement, ...status.metrics.improvement },
            source: { ...current.metrics?.source, ...status.metrics.source }
        };
    }

    // Merge Agent Data deep
    if (status.agentData) {
        next.agentData = {
            ...current.agentData,
            ...status.agentData,
            archivist: status.agentData.archivist ? { ...current.agentData?.archivist, ...status.agentData.archivist } : current.agentData?.archivist,
            translator: status.agentData.translator ? { ...current.agentData?.translator, ...status.agentData.translator } : current.agentData?.translator,
            auditor: status.agentData.auditor ? { ...current.agentData?.auditor, ...status.agentData.auditor } : current.agentData?.auditor,
            learner: status.agentData.learner ? { ...current.agentData?.learner, ...status.agentData.learner } : current.agentData?.learner,
        };
    }

    fs.writeFileSync(STATUS_FILE, JSON.stringify(next, null, 2));
}

export function getActiveFilename(): string {
    if (fs.existsSync(STATUS_FILE)) {
        try {
            const current = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'));
            return current.agentData?.archivist?.filename || "Horizon Tracking Report.xlsx";
        } catch (e) { }
    }
    return "Horizon Tracking Report.xlsx";
}

export function getActiveOptions(): { enrichEnabled: boolean } {
    if (fs.existsSync(STATUS_FILE)) {
        try {
            const current = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'));
            return { enrichEnabled: !!current.enrichEnabled };
        } catch (e) { }
    }
    return { enrichEnabled: false };
}

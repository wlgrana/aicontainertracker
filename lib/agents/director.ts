
import { format, differenceInDays } from "date-fns";

export interface DirectorState {
    mode: 'COMPLETE' | 'ACTIVE' | 'RISK_MONITOR' | 'TRANSIT' | 'RISK_DETENTION';
    headline: string;
    summary: string;
    showRiskCard: boolean;
    showActions: boolean;
    progressStep: number;
    themeColor: 'emerald' | 'blue' | 'amber' | 'slate' | 'red';
    // Demurrage Logic
    lfdValid: boolean;
    demurrage: {
        total: number;
        daysOverdue: number; // positive = overdue
        dailyRate: number;
        status: 'safe' | 'warning' | 'critical' | 'overdue' | 'unknown';
    };
}

export function getDirectorState(container: any): DirectorState {
    const formatDate = (d: string | Date | null) => d ? format(new Date(d), 'MMM d') : 'Unknown Date';

    // --- Demurrage Calculation ---
    // Fix 1: Robust Date Handling
    const now = new Date();
    const lfdDate = container.lastFreeDay ? new Date(container.lastFreeDay) : null;
    const lfdValid = !!lfdDate && !isNaN(lfdDate.getTime());

    const demurrage: DirectorState['demurrage'] = {
        total: 0,
        daysOverdue: 0,
        dailyRate: 150,
        status: 'unknown'
    };

    if (lfdValid && lfdDate) {
        // differenceInDays(later, earlier) returns positive
        // We want days remaining: LFD - Now
        // If LFD is PAST, this is negative.
        // But user wants "Days Overdue". 
        // Logic:
        // Remaining = differenceInDays(lfdDate, now)
        // If Remaining < 0, Overdue = Math.abs(Remaining)

        const daysRemaining = differenceInDays(lfdDate, now);

        if (daysRemaining < 0) {
            demurrage.status = 'overdue';
            demurrage.daysOverdue = Math.abs(daysRemaining);
            // Fix 3: Uncap Math
            demurrage.total = demurrage.daysOverdue * demurrage.dailyRate;
        } else if (daysRemaining <= 3) {
            demurrage.status = 'critical';
        } else if (daysRemaining <= 7) {
            demurrage.status = 'warning';
        } else {
            demurrage.status = 'safe';
        }
    } else {
        // If no LFD, status is safe unless we are in Risk Monitor mode? 
        // Actually, if we are in RiskMonitor but no LFD, it's 'unknown' exposure which is risky.
        // Let the mode logic decide visual prominence, but here logic is about the calculation.
        demurrage.status = 'unknown';
    }


    // --- Mode Logic ---

    // 1. COMPLETE
    if (container.emptyReturnDate) {
        return {
            mode: 'COMPLETE',
            headline: 'RETURNED / COMPLETE',
            summary: `Mission Complete: Container returned empty to depot on ${formatDate(container.emptyReturnDate)}. No further actions required.`,
            showRiskCard: false,
            showActions: false,
            progressStep: 5,
            themeColor: 'emerald',
            lfdValid,
            demurrage // Keeps whatever was calc'd, but UI will hide it
        };
    }

    // 2. ACTIVE (Gate Out)
    if (container.gateOutDate || ['DEL', 'DELIVERED', 'CGO'].includes(container.currentStatus)) {

        // Detention Risk Check
        const gateOut = container.gateOutDate ? new Date(container.gateOutDate) : (container.statusLastUpdated ? new Date(container.statusLastUpdated) : now);
        const daysSinceGateOut = differenceInDays(now, gateOut);

        if (daysSinceGateOut > 14) {
            // DETENTION MODE
            // Override demurrage object for Detention calculation
            const detentionDays = daysSinceGateOut - 10; // Assume 10 days free time for detention
            const detentionTotal = Math.max(0, detentionDays * 175); // $175/day detention rate

            return {
                mode: 'RISK_DETENTION',
                headline: 'DETENTION ALERT / OVERDUE',
                summary: `Status Critical: Container gated out ${daysSinceGateOut} days ago and has not been returned. Daily detention fees are accumulating.`,
                showRiskCard: true,
                showActions: true,
                progressStep: 4,
                themeColor: 'red',
                lfdValid: true, // Force valid so we don't show "Unknown" card
                demurrage: {
                    total: detentionTotal,
                    daysOverdue: daysSinceGateOut, // Showing total days out as overdue context
                    dailyRate: 175,
                    status: 'overdue'
                }
            };
        }

        return {
            mode: 'ACTIVE',
            headline: 'GATE OUT / DEPARTED',
            summary: `Transit Active: Cargo departed terminal on ${formatDate(container.gateOutDate || container.statusLastUpdated)}. Currently en route to destination.`,
            showRiskCard: false,
            showActions: false,
            progressStep: 4,
            themeColor: 'blue',
            lfdValid,
            demurrage
        };
    }

    // 3. RISK MONITOR (At Port)
    if (container.ata || ['ARR', 'DIS', 'AVL', 'REL', 'CUS'].includes(container.currentStatus)) {
        return {
            mode: 'RISK_MONITOR',
            headline: 'ARRIVED / DISCHARGED',
            summary: `At Port: Vessel arrived ${formatDate(container.ata || container.statusLastUpdated)}. Please monitor Last Free Day (${formatDate(container.lastFreeDay)}).`,
            showRiskCard: true,
            showActions: true,
            progressStep: 3,
            themeColor: 'amber',
            lfdValid,
            demurrage
        };
    }

    // 4. TRANSIT
    return {
        mode: 'TRANSIT',
        headline: 'ON VESSEL / IN TRANSIT',
        summary: `Vessel is currently underway. ETA: ${formatDate(container.eta)}.`,
        showRiskCard: false,
        showActions: false,
        progressStep: 2,
        themeColor: 'slate',
        lfdValid,
        demurrage
    };
}

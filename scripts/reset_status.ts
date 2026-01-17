
import { updateStatus } from './simulation-utils';
updateStatus({ step: 'IDLE', progress: 0, message: 'Ready', metrics: {}, agentData: {} });
console.log("Status reset to IDLE.");

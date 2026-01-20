/**
 * Environment Detection Utilities
 * 
 * Detects whether the application is running in Vercel (serverless)
 * or local development environment to enable dual execution paths.
 */

/**
 * Check if running in Vercel serverless environment
 */
export function isVercel(): boolean {
    return process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;
}

/**
 * Check if running in local development environment
 */
export function isLocal(): boolean {
    return !isVercel();
}

/**
 * Get environment name for logging
 */
export function getEnvironmentName(): string {
    if (isVercel()) {
        return process.env.VERCEL_ENV || 'vercel';
    }
    return 'local';
}

#!/usr/bin/env tsx
/**
 * Test to demonstrate the new log filename format
 */

// Simulate the filename generation logic
function generateLogFilename(filename: string | undefined): string {
    const timestamp = Date.now();
    const baseFilename = (filename || 'unknown').replace(/\.xlsx$/i, '').replace(/[^a-z0-9_-]/gi, '_');
    return `${baseFilename}_${timestamp}.log`;
}

console.log('Log Filename Generation Examples:\n');
console.log('═'.repeat(70));

const testCases = [
    'Horizon Tracking Report.xlsx',
    'test_enrich_service_misplaced.xlsx',
    'My Container Data 2024.xlsx',
    'special!@#$%chars.xlsx',
    undefined
];

testCases.forEach(testFile => {
    const logName = generateLogFilename(testFile);
    console.log(`Input:  ${testFile || '(no filename)'}`);
    console.log(`Output: ${logName}`);
    console.log('─'.repeat(70));
});

console.log('\n✅ New format: filename_timestamp.log');
console.log('   - Removes .xlsx extension');
console.log('   - Replaces special characters with underscores');
console.log('   - Keeps the actual filename for easy identification');

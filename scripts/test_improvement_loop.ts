
import { prisma } from '../lib/prisma';

async function main() {
    const rootUrl = 'http://localhost:3000';

    // 1. Find the import log
    console.log("Finding most recent import...");
    const importLog = await prisma.importLog.findFirst({
        orderBy: { importedOn: 'desc' },
    });

    if (!importLog) throw new Error("No import log found");
    console.log(`Using Import: ${importLog.fileName}`);

    // Test Loop
    for (let i = 1; i <= 3; i++) {
        console.log(`\n--- Test Run ${i}/3 ---`);

        // 2. Start Job
        console.log("Triggering improvement job...");
        try {
            // Correct Endpoint: /api/imports/[id]/improve
            const improveUrl = `${rootUrl}/api/imports/${encodeURIComponent(importLog.fileName)}/improve`;

            const res = await fetch(improveUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });

            if (!res.ok) {
                console.error(`Failed to start job: ${res.status} ${res.statusText}`);
                const txt = await res.text();
                console.error(txt);
                continue;
            }

            const json = await res.json(); // { jobId: "..." }
            const jobId = json.jobId;
            console.log(`Job Created: ${jobId}`);

            // 3. Poll
            const start = Date.now();
            const MAX_WAIT = 300000; // 5 minutes max (Translator is slow)

            while (true) {
                if (Date.now() - start > MAX_WAIT) {
                    console.log("\n❌ Timeout!");
                    break;
                }

                await new Promise(r => setTimeout(r, 5000)); // Poll every 5s
                const statusRes = await fetch(`${rootUrl}/api/improvement-jobs/${jobId}`);
                const statusJson = await statusRes.json();

                process.stdout.write(`\rStatus: ${statusJson.status} (${statusJson.progress}%)  `);

                if (statusJson.status === 'COMPLETED') {
                    console.log(`\n✅ Completed in ${((Date.now() - start) / 1000).toFixed(1)}s`);
                    break;
                }
                if (statusJson.status === 'FAILED') {
                    console.log(`\n❌ Failed: ${statusJson.error}`);
                    break;
                }
            }
        } catch (e) {
            console.error("Error calling API:", e);
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());

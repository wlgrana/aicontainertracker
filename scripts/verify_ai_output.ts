
import { analyzeContainer } from "../app/actions/analyzeContainer";

// Mock prisma and AI to test standalone if needed, or just run valid container
async function main() {
    const containerNumber = "TEMU6038570"; // From user screenshot
    console.log(`Analyzing ${containerNumber}...`);
    try {
        const result = await analyzeContainer(containerNumber);
        console.log("Analysis Result:");
        console.log(JSON.stringify(result.structured_metadata, null, 2));
    } catch (e) {
        console.error("Analysis Failed:", e);
    }
}

main();

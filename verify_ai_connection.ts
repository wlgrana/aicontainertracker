
// Load env first
try {
    process.loadEnvFile();
    console.log("Loaded .env");
} catch (e) {
    console.log("No .env file found or supported, trying process.env");
}

async function verifyAI() {
    const { client, highThink } = await import('./lib/ai');

    console.log("Testing Basic Connection...");
    console.log("Endpoint:", process.env.AZURE_AI_ENDPOINT);
    console.log("Model:", process.env.AZURE_AI_MODEL);

    try {
        const result = await highThink("Say 'Hello Deepseek' and nothing else.");
        console.log("Result:", result);
        if (result.includes("Deepseek") || result.includes("Hello")) {
            console.log("✅ Deepseek Connection Successful!");
        } else {
            console.log("⚠️ Response received but unexpected:", result);
        }
    } catch (e) {
        console.error("❌ Connection Failed:", e);
    }
}

verifyAI();


try {
    process.loadEnvFile();
    console.log("Loaded .env");
} catch (e) { console.log("Load failed", e.message); }

console.log("ENDPOINT:", process.env.AZURE_AI_ENDPOINT);
console.log("KEY:", process.env.AZURE_AI_KEY);
console.log("MODEL:", process.env.AZURE_AI_MODEL);

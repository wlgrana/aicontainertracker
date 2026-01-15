try {
    process.loadEnvFile();
    console.log("✅ process.loadEnvFile() succeeded");
} catch (e: any) {
    console.log(`❌ process.loadEnvFile() failed: ${e.message}`);
}

const url = process.env.DATABASE_URL;
if (url) {
    console.log(`✅ DATABASE_URL is set: ${url.substring(0, 15)}...`);
} else {
    console.log("❌ DATABASE_URL is NOT set");
}

console.log(`Node Version: ${process.version}`);

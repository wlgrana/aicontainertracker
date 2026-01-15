import OpenAI from "openai";

const apiKey = process.env.AZURE_AI_KEY;
const baseURL = process.env.AZURE_AI_ENDPOINT;
const modelName = process.env.AZURE_AI_MODEL || "DeepSeek-V3.2";

if (!apiKey || !baseURL) {
    console.warn("AZURE_AI_KEY or AZURE_AI_ENDPOINT is not set.");
}

export const client = new OpenAI({
    apiKey: apiKey || "dummy-key", // Prevent crash in dev/test if key missing
    baseURL: baseURL || "https://api.openai.com/v1", // Default if missing
    dangerouslyAllowBrowser: true // Only if used client-side, but this is mostly server-side.
});

// Helper to simulate the "Think" levels via Temperature
export async function generateAIResponse(prompt: string, temperature: number = 0.7): Promise<string> {
    try {
        const response = await client.chat.completions.create({
            model: modelName,
            messages: [{ role: "user", content: prompt }],
            temperature: temperature,
        });
        return response.choices[0].message.content || "";
    } catch (e) {
        console.error("AI Generation Failed:", e);
        throw e;
    }
}

// Abstractions for backward compatibility / easy refactoring
export const highThink = (prompt: string) => generateAIResponse(prompt, 0.2);
export const mediumThink = (prompt: string) => generateAIResponse(prompt, 0.4);
export const lowThink = (prompt: string) => generateAIResponse(prompt, 0.7);


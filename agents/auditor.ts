
import { AuditorInput, AuditorOutput } from '../types/agents';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';

const AZURE_ENDPOINT = process.env.AZURE_AI_ENDPOINT || "";
const AZURE_API_KEY = process.env.AZURE_AI_KEY || "";
// Use a faster/cheaper model for Auditor if available, otherwise same
const AZURE_DEPLOYMENT = process.env.AZURE_AI_MODEL || "gpt-4o";

function getAIClient() {
    if (AZURE_ENDPOINT && AZURE_API_KEY) {
        if (AZURE_ENDPOINT.includes('/v1')) {
            const baseURL = AZURE_ENDPOINT.endsWith('/') ? AZURE_ENDPOINT.slice(0, -1) : AZURE_ENDPOINT;
            return new OpenAI({
                apiKey: AZURE_API_KEY,
                baseURL: baseURL,
            });
        }
        return new OpenAI({
            apiKey: AZURE_API_KEY,
            baseURL: `${AZURE_ENDPOINT}/openai/deployments/${AZURE_DEPLOYMENT}`,
            defaultQuery: { 'api-version': '2024-02-15-preview' },
            defaultHeaders: { 'api-key': AZURE_API_KEY }
        });
    }
    throw new Error("Azure AI credentials missing");
}

export async function runAuditor(input: AuditorInput): Promise<AuditorOutput> {
    console.log(`[Auditor] Auditing container ${input.containerNumber}...`);

    const client = getAIClient();
    const systemPrompt = fs.readFileSync(path.join(process.cwd(), 'agents/prompts/auditor-system.md'), 'utf-8');
    let userPromptTemplate = fs.readFileSync(path.join(process.cwd(), 'agents/prompts/auditor-user.md'), 'utf-8');

    const currentPrompt = userPromptTemplate
        .replace('${containerNumber}', input.containerNumber)
        .replace('${JSON.stringify(rawData.raw.originalRow, null, 2)}', JSON.stringify(input.rawData.raw.originalRow, null, 2))
        .replace('${JSON.stringify(rawData.mapping, null, 2)}', JSON.stringify(input.rawData.mapping, null, 2))
        .replace('${JSON.stringify(databaseRow, null, 2)}', JSON.stringify(input.databaseRow, null, 2));

    try {
        const response = await client.chat.completions.create({
            model: AZURE_DEPLOYMENT,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: currentPrompt }
            ],
            temperature: 0.1, // Very low temp for strict verification
            response_format: { type: 'json_object' }
        });

        const content = response.choices[0].message.content;
        if (!content) throw new Error("No content from Auditor AI");

        return JSON.parse(content) as AuditorOutput;

    } catch (err) {
        console.error(`[Auditor] Audit failed for ${input.containerNumber}:`, err);
        throw err;
    }
}

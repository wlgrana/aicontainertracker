
import { AnalyzerInput, AnalyzerOutput } from '../types/agents';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import * as yaml from 'yaml';

const prisma = new PrismaClient();

const AZURE_ENDPOINT = (process.env.AZURE_AI_ENDPOINT || "").trim();
const AZURE_API_KEY = (process.env.AZURE_AI_KEY || "").trim();
const AZURE_DEPLOYMENT = (process.env.AZURE_AI_MODEL || "gpt-4o").trim();

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

export async function runImprovementAnalyzer(input: AnalyzerInput): Promise<AnalyzerOutput> {
    console.log(`[Analyzer] Analyzing ${input.unmappedItems.length} unmapped items...`);

    if (input.unmappedItems.length === 0) {
        return { suggestions: [], summary: "No unmapped items to analyze." };
    }

    const client = getAIClient();
    const systemPrompt = fs.readFileSync(path.join(process.cwd(), 'agents/prompts/analyzer-system.md'), 'utf-8');
    const userPromptTemplate = fs.readFileSync(path.join(process.cwd(), 'agents/prompts/analyzer-user.md'), 'utf-8');

    // Load Canonical Schema from YAML to provide context
    const ontologyPath = path.join(process.cwd(), 'agents/dictionaries/container_ontology.yml');
    const ontology = yaml.parse(fs.readFileSync(ontologyPath, 'utf-8'));
    const canonicalSchema = Object.keys(ontology.required_fields || {}).concat(Object.keys(ontology.optional_fields || {})).join(', ');

    // Flatten existing synonyms for reference
    // We could format this nicely, or just dump relevant parts.
    // For brevity/cost, maybe just list fields. The AI knows common shipping terms.
    // Let's pass the raw YAML structure of fields but only specific keys to save tokens?
    // User requested "Current Dictionaries".
    // I'll assume passing the list of fields is sufficient for "Canonical Schema".
    // "Existing Synonyms" -> I'll generate a simplified JSON of field: [synonyms]
    const existingSynonyms: Record<string, string[]> = {};
    for (const [key, val] of Object.entries({ ...ontology.required_fields, ...ontology.optional_fields }) as any) {
        if (val.header_synonyms) existingSynonyms[key] = val.header_synonyms;
    }

    const currentPrompt = userPromptTemplate
        .replace('${canonicalSchema}', canonicalSchema)
        .replace('${unmappedItems}', JSON.stringify(input.unmappedItems, null, 2))
        .replace('${existingSynonyms}', JSON.stringify(existingSynonyms, null, 2));

    try {
        const response = await client.chat.completions.create({
            model: AZURE_DEPLOYMENT,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: currentPrompt }
            ],
            temperature: 0.2,
            response_format: { type: 'json_object' }
        });

        const content = response.choices[0].message.content;
        if (!content) throw new Error("No content from Analyzer AI");

        const result = JSON.parse(content) as AnalyzerOutput;

        // Log to AgentProcessingLog (Using a dummy container ID or job ID? 
        // Analyzer runs on Batch, not Container. 
        // Schema says containerId is required for AgentProcessingLog...
        // Wait, schema: `containerId String`, and `container Container @relation`.
        // So I cannot log Analyzer output to AgentProcessingLog if it's not tied to a specific container.

        // However, the input usually comes from a batch context.
        // We'll skip logging to AgentProcessingLog for the BATCH-level analysis, 
        // or log it to the ImprovementJob.logs field instead.
        // The plan says "Log to AgentProcessingLog". But schema Constraints...

        // Update: I will return the result and let the Worker log it to the ImprovementJob.

        return result;

    } catch (err) {
        console.error(`[Analyzer] Analysis failed:`, err);
        throw err;
    }
}

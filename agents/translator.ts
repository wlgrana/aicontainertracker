
import { PrismaClient } from '@prisma/client';
import { TranslatorInput, TranslatorOutput, RawRowData } from '../types/agents';
import OpenAI from 'openai'; // Using OpenAI SDK for configured model
import * as fs from 'fs';
import * as path from 'path';

// Assuming standard OpenAI client shared across project, or we instantiate here.
// The instructions mention "agents/translator.ts" uses a "high-reasoning model".
// We will access the Azure/DeepSeek client configured in the env.

const AZURE_ENDPOINT = process.env.AZURE_AI_ENDPOINT || "";
const AZURE_API_KEY = process.env.AZURE_AI_KEY || "";
const AZURE_DEPLOYMENT = process.env.AZURE_AI_MODEL || "gpt-4o"; // fallback

// Helper to init client
function getAIClient() {
    if (AZURE_ENDPOINT && AZURE_API_KEY) {
        // If endpoint includes /v1, treat as direct OpenAI-compatible endpoint (MaaS)
        if (AZURE_ENDPOINT.includes('/v1')) {
            const baseURL = AZURE_ENDPOINT.endsWith('/') ? AZURE_ENDPOINT.slice(0, -1) : AZURE_ENDPOINT;
            return new OpenAI({
                apiKey: AZURE_API_KEY,
                baseURL: baseURL,
            });
        }

        // Standard Azure Resource
        return new OpenAI({
            apiKey: AZURE_API_KEY,
            baseURL: `${AZURE_ENDPOINT}/openai/deployments/${AZURE_DEPLOYMENT}`,
            defaultQuery: { 'api-version': '2024-02-15-preview' },
            defaultHeaders: { 'api-key': AZURE_API_KEY }
        });
    }
    // Fallback or error
    throw new Error("Azure AI credentials missing");
}

const prisma = new PrismaClient();

export async function runTranslator(input: TranslatorInput): Promise<TranslatorOutput> {
    console.log(`[Translator] Starting translation for log: ${input.importLogId}`);

    const client = getAIClient();

    // Load prompts
    const systemPrompt = fs.readFileSync(path.join(process.cwd(), 'agents/prompts/translator-system.md'), 'utf-8');
    let userPromptTemplate = fs.readFileSync(path.join(process.cwd(), 'agents/prompts/translator-user.md'), 'utf-8');

    // Fill user prompt template
    // Note: We might need to handle batching if rows > 50, but guide says:
    // "First call: Detect schema from headers + first 5 rows"
    // "Subsequent calls: Apply detected schema to remaining rows"
    // For this MV implementation, we'll try to do it in one go if small, or split logic.
    // The guide implies the Agent *is* the logic that calls the AI.

    // Let's implement the "One Pass" logic first for the plan, or simple batching.
    // To strictly follow the prompt template, we feed All rows? The prompt says "Produce the complete mapping for ALL ${rawRows.length} rows".
    // Caution: Context window limits. 
    // Strategy: We will detect schema with first 5 rows, then if needed, map the rest programmatically or via batched AI calls.
    // However, the PROMPT asks for the mapping of ALL rows in the JSON output. 
    // Let's limit the rawRows sent to the AI to a manageable chunk (e.g. 20) for this implementation 
    // and loop if necessary, or trust the simple refactor for now.

    // PROPOSED LOGIC:
    // 1. Send Headers + First 5 Rows to get Schema + Mapped Data for those 5.
    // 2. We actually need mapping for ALL rows. 
    //    If we have 1000 rows, we can't send all to LLM in one go efficiently for data extraction output.
    //    BUT, the instructions say "Model ... high-reasoning".
    //    Let's refine: The Translator Output structure *contains* "containers: MappedContainer[]".
    //    So the output is expected to be the full set.

    // BATCHING IMPLEMENTATION:
    // 1. First call: Headers + 5 rows -> Get SchemaMapping + 5 Containers.
    // 2. Apply that SchemaMapping to the rest of the rows (programmatically? No, "Data Transformation" is an Agent responsibility).
    //    The agent is responsible for "Excel date conversion" etc. 
    //    Ideally, once we have the schema, we can run a faster/cheaper loop or code-based mapper if confidence is high.
    //    But the prompt implies the AI does the work.

    // Let's do the initial call with ALL rows if < 50, otherwise batch.

    const BATCH_SIZE = 50;
    const allMappedContainers: any[] = [];
    const allMappedEvents: any[] = [];
    let schemaMapping: any = null;
    let confidenceReport: any = null;

    // Clone rawRows to avoid mutation issues
    const rowsToProcess = [...input.rawRows];

    // Chunking loop
    for (let i = 0; i < rowsToProcess.length; i += BATCH_SIZE) {
        const chunk = rowsToProcess.slice(i, i + BATCH_SIZE);
        const isFirstBatch = i === 0;

        console.log(`[Translator] Processing batch ${i / BATCH_SIZE + 1} (${chunk.length} rows)...`);

        // Prepare prompt
        // Use the template
        const currentPrompt = userPromptTemplate
            .replace('${JSON.stringify(headers)}', JSON.stringify(input.headers))
            .replace('${JSON.stringify(rawRows.slice(0, 5), null, 2)}', JSON.stringify(chunk, null, 2)) // Sending FULL chunk with IDs
            .replace('${JSON.stringify(existingSchemaFields)}', JSON.stringify(input.existingSchemaFields))
            .replace('${JSON.stringify(transitStages)}', JSON.stringify(input.transitStages))
            .replace('${rawRows.length}', String(chunk.length));

        // Tweaking prompt for subsequent batches to enforce consistency if we had schema?
        // For now, simpler to just let it run. The "deterministic" temp should help.

        try {
            const response = await client.chat.completions.create({
                model: AZURE_DEPLOYMENT,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: currentPrompt }
                ],
                temperature: 0.1,
                response_format: { type: 'json_object' }
            });

            const content = response.choices[0].message.content;
            if (!content) throw new Error("No content from AI");

            const result = JSON.parse(content) as TranslatorOutput;

            // Update global state
            if (isFirstBatch) {
                schemaMapping = result.schemaMapping;
                confidenceReport = result.confidenceReport;
            }

            // Append containers and events
            // Need to ensure rawRowId matches. The AI might invent IDs if not careful.
            // The prompt sample input shows rawData dictionary. It doesn't explicitly pass rawRowIds in the prompt sample data block.
            // We must check if the AI returns them correctly. 
            // The prompt output format has "rawRowId": "abc123".
            // We need to ensure we pass the IDs in the prompt or match them by index.
            // The prompt sample data: ${JSON.stringify(rawRows.slice(0, 5))} where rawRows has structure {id, rowIndex, rawData}.
            // Ah, the user prompt template uses "rawRows.slice(0,5)" but in the implementation plan logic I see:
            // "rawRows.map(r => ({ id: r.id, rowIndex: r.rowIndex, rawData: ... }))"
            // So the ID *is* in the prompt input data. Excellent.

            allMappedContainers.push(...result.containers);
            allMappedEvents.push(...result.events);

        } catch (err) {
            console.error(`[Translator] Batch failed:`, err);
            throw err;
        }
    }

    return {
        schemaMapping: schemaMapping!,
        containers: allMappedContainers,
        events: allMappedEvents,
        confidenceReport: confidenceReport!
    };
}

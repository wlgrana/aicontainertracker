
import { OracleChatMessage, OracleChatContext } from '../types/agents';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';

const AZURE_ENDPOINT = process.env.AZURE_AI_ENDPOINT || "";
const AZURE_API_KEY = process.env.AZURE_AI_KEY || "";
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

export async function runOracleChat(
    messages: OracleChatMessage[],
    context: OracleChatContext
): Promise<OracleChatMessage> {
    const client = getAIClient();

    // Load system prompt and hydrate with context
    const systemPromptRaw = fs.readFileSync(path.join(process.cwd(), 'agents/prompts/oracle-system.md'), 'utf-8');

    // Simple handlebars-style replacement
    const hydratedPrompt = systemPromptRaw
        .replace('{{containerNumber}}', context.containerNumber)
        .replace('{{currentStatus}}', context.currentStatus)
        .replace('{{carrier}}', context.carrier)
        .replace('{{pol}}', context.pol)
        .replace('{{pod}}', context.pod)
        .replace('{{finalDestination}}', context.finalDestination)
        .replace('{{etd}}', context.etd || 'N/A')
        .replace('{{atd}}', context.atd || 'N/A')
        .replace('{{eta}}', context.eta || 'N/A')
        .replace('{{ata}}', context.ata || 'N/A')
        .replace('{{lastFreeDay}}', context.lastFreeDay || 'N/A')
        .replace('{{deliveryDate}}', context.deliveryDate || 'N/A')
        .replace('{{importSource}}', context.dataQuality.importSource)
        .replace('{{importDate}}', context.dataQuality.importDate)
        .replace('{{overallConfidence}}', String(context.dataQuality.overallConfidence))
        .replace('{{flaggedFields}}', context.dataQuality.flaggedFields.join(', ') || 'None');

    // Complex loops for events/flags would need a real templating engine ideally, 
    // but for this MVP we can append them or do basic string manipulation if needed.
    // The prompt template uses {{#each}}, which we need to handle or assume the AI can handle raw JSON if we dump it?
    // Let's just append the JSON block for the complex lists to the prompt end or replace a placeholder block.
    // Simpler approach:

    const eventsBlock = context.events.map(e => `- ${e.date}: ${e.stageName} @ ${e.location}`).join('\n');
    const flagsBlock = context.attentionFlags.map(f => `- [${f.priority}] ${f.reason} (${f.status})`).join('\n');

    // Replace the handlebars blocks with generated text
    // Warning: Regex replacement for multiline blocks is tricky. 
    // We'll trust that the prompt is structured such that we can just inject these lists.
    // Actually, let's just use string replacement on specific markers we control in the prompt file if we edited it,
    // but since I wrote the prompt file with {{#each}}, I should handle it.
    // Or... just don't support {{#each}} fully and just dump the data.
    // Let's replace the whole {{#each events}}...{{/each}} range with the data.
    // Since I generated the file, I know the content.

    // Hacky replacement for the MVP:
    const finalSystemPrompt = hydratedPrompt
        .replace(/{{#each events}}[\s\S]*?{{\/each}}/g, eventsBlock || "No recent events.")
        .replace(/{{#each attentionFlags}}[\s\S]*?{{\/each}}/g, flagsBlock || "No attention flags.");

    const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
        {
            type: "function",
            function: {
                name: "add_note",
                description: "Add a persistent note to this container's activity log",
                parameters: {
                    type: "object",
                    properties: {
                        note: { type: "string" },
                        category: { type: "string", enum: ["general", "exception", "follow_up", "resolution"] }
                    },
                    required: ["note"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "update_status",
                description: "Update the container's current transit status",
                parameters: {
                    type: "object",
                    properties: {
                        status: { type: "string", enum: ["BOOK", "DEP", "ARR", "DIS", "CUS", "REL", "OGF", "DLV", "EMP"] },
                        reason: { type: "string" }
                    },
                    required: ["status", "reason"]
                }
            }
        },
        // Add other tools...
    ];

    const response = await client.chat.completions.create({
        model: AZURE_DEPLOYMENT,
        messages: [
            { role: "system", content: finalSystemPrompt },
            ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
        ],
        tools: tools,
        tool_choice: "auto"
    });

    const msg = response.choices[0].message;

    // Convert to our generic interface
    return {
        role: 'assistant',
        content: msg.content || '',
        toolCalls: msg.tool_calls?.map((tc: any) => ({
            name: tc.function?.name || '',
            arguments: JSON.parse(tc.function?.arguments || '{}'),
            id: tc.id
        }))
    };
}

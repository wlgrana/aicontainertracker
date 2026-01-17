
import { AuditorInput, AuditorOutput } from '../types/agents';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const AZURE_ENDPOINT = (process.env.AZURE_AI_ENDPOINT || "").trim();
const AZURE_API_KEY = (process.env.AZURE_AI_KEY || "").trim();
// Use a faster/cheaper model for Auditor if available, otherwise same
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

export async function runAuditor(input: AuditorInput): Promise<AuditorOutput> {
    console.log(`[Auditor] Auditing container ${input.containerNumber}...`);

    const client = getAIClient();
    const systemPrompt = fs.readFileSync(path.join(process.cwd(), 'agents/prompts/auditor-system.md'), 'utf-8');
    const userPromptTemplate = fs.readFileSync(path.join(process.cwd(), 'agents/prompts/auditor-user.md'), 'utf-8');

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


        const result = JSON.parse(content) as AuditorOutput;

        // Log to AgentProcessingLog (if not skipped)
        if (!input.skipLogging) {
            try {
                await prisma.agentProcessingLog.create({
                    data: {
                        containerId: input.containerNumber,
                        stage: 'AUDITOR',
                        status: 'COMPLETED',
                        timestamp: new Date(),
                        findings: result.summary as any,
                        discrepancies: (result.lost.length > 0 || result.wrong.length > 0 || result.unmapped.length > 0) ? {
                            lost: result.lost,
                            wrong: result.wrong,
                            unmapped: result.unmapped
                        } : undefined,
                        output: (result.lost.length > 0 || result.wrong.length > 0) ? JSON.parse(JSON.stringify(result)) : { summary: 'No critical discrepancies' }
                    }
                });
            } catch (logErr) {
                console.error(`[Auditor] Failed to log processing event:`, logErr);
            }
        }

        return result;

    } catch (err) {
        console.error(`[Auditor] Audit failed for ${input.containerNumber}:`, err);

        // Try to log failure (if not skipped)
        if (!input.skipLogging) {
            try {
                await prisma.agentProcessingLog.create({
                    data: {
                        containerId: input.containerNumber,
                        stage: 'AUDITOR',
                        status: 'FAILED',
                        timestamp: new Date(),
                        output: { error: String(err) }
                    }
                });
            } catch {/* ignore */ }
        }

        throw err;
    }
}


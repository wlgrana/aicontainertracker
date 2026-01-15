'use server';

import { client } from "@/lib/ai";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

interface ChatResponse {
    message: string;
    toolCalls?: any[];
}

export async function chatWithOracle(containerId: string, history: ChatMessage[]): Promise<ChatResponse> {
    // 1. Fetch Context
    const container = await prisma.container.findUnique({
        where: { containerNumber: containerId },
        include: {
            shipmentContainers: {
                include: { shipment: true }
            },
            events: {
                orderBy: { eventDateTime: 'desc' },
                take: 10
            },
            activityLogs: {
                orderBy: { createdAt: 'desc' },
                take: 5
            }
        }
    });

    if (!container) throw new Error("Container not found");

    // 2. Construct System Prompt with Context
    // Helper: Get Business Unit
    const businessUnit = (container as any).businessUnit ||
        container.shipmentContainers?.[0]?.shipment?.businessUnit ||
        "Unknown";

    const systemPrompt = `You are the Mission Oracle, an advanced logistics AI assistant.
    
    CURRENT CONTEXT:
    Container: ${container.containerNumber}
    Business Unit: ${businessUnit}
    Status: ${container.currentStatus} (AI Status: ${(container as any).aiOperationalStatus})
    Location: ${container.currentLocation}
    Carrier: ${container.carrier}
    ETA: ${container.eta ? new Date(container.eta).toISOString().split('T')[0] : 'N/A'}
    LFD: ${container.lastFreeDay ? new Date(container.lastFreeDay).toISOString().split('T')[0] : 'N/A'}
    
    Recent Events:
    ${container.events.map(e => `- ${new Date(e.eventDateTime).toISOString().split('T')[0]}: ${e.stageName} @ ${e.location}`).join('\n')}

    Your Goal: Assist the user with this specific container. Answer questions based on the context. 
    You have tools to MODIFY the database. USE THEM when the user asks to update something.
    
    TOOLS AVAILABLE:
    - add_note(note: string): Add a persistent note to this container.
    - update_status(status: string, reason: string): Update the container's status.`;

    const messages = [
        { role: 'system', content: systemPrompt },
        ...history
    ];

    try {
        // 3. Call LLM (DeepSeek via OpenAI SDK)
        // Note: For full tool calling support with DeepSeek, we might need to parse JSON commands if native tools aren't fully supported in the specific model version. 
        // We'll use a robust JSON-based instruction pattern for compatibility.

        const response = await client.chat.completions.create({
            model: process.env.AZURE_AI_MODEL || "DeepSeek-V3",
            messages: messages as any,
            temperature: 0.3, // Lower temperature for reliable tool use
            tools: [
                {
                    type: "function",
                    function: {
                        name: "add_note",
                        description: "Add a note to the container",
                        parameters: {
                            type: "object",
                            properties: {
                                note: { type: "string", description: "The content of the note" }
                            },
                            required: ["note"]
                        }
                    }
                },
                {
                    type: "function",
                    function: {
                        name: "update_status",
                        description: "Update the container status",
                        parameters: {
                            type: "object",
                            properties: {
                                status: { type: "string", description: "New status code. Valid: DEP (In Transit), ARR (Arrived), DIS (Discharged), AVL (Available), DEL (Delivered), RET (Return)" },
                                reason: { type: "string", description: "Reason for the update" }
                            },
                            required: ["status", "reason"]
                        }
                    }
                }
            ],
            tool_choice: "auto"
        });

        const choice = response.choices[0];
        const initialMsg = choice.message;

        // 4. Handle Tool Calls
        if (initialMsg.tool_calls && initialMsg.tool_calls.length > 0) {
            const toolCall = initialMsg.tool_calls[0] as any;
            const args = JSON.parse(toolCall.function.arguments);

            let toolResult = "";

            if (toolCall.function.name === "add_note") {
                // Append note
                const existingNotes = container.notes ? container.notes + "\n" : "";
                const newNotes = `${existingNotes}[${new Date().toLocaleDateString()} Oracle Chat]: ${args.note}`;

                await prisma.container.update({
                    where: { containerNumber: containerId },
                    data: { notes: newNotes }
                });

                await prisma.activityLog.create({
                    data: {
                        containerId: containerId,
                        action: "USER_NOTE",
                        detail: args.note,
                        source: "Oracle Chat",
                        actor: "User via AI"
                    }
                });

                toolResult = "Note added successfully.";
            } else if (toolCall.function.name === "update_status") {
                let status = args.status.toUpperCase();
                const statusMap: Record<string, string> = {
                    "IN TRANSIT": "DEP", "DEPARTED": "DEP",
                    "ARRIVED": "ARR", "ARRIVAL": "ARR",
                    "DISCHARGED": "DIS", "DISCHARGE": "DIS",
                    "AVAILABLE": "AVL",
                    "DELIVERED": "DEL", "DELIVERY": "DEL",
                    "COMPLETED": "RET", "RETURN": "RET", "EMPTY RETURN": "RET"
                };
                if (statusMap[status]) status = statusMap[status];

                await prisma.container.update({
                    where: { containerNumber: containerId },
                    data: {
                        currentStatus: args.status,
                        statusLastUpdated: new Date()
                    }
                });

                await prisma.activityLog.create({
                    data: {
                        containerId: containerId,
                        action: "STATUS_UPDATE",
                        detail: `Status changed to ${args.status}. Reason: ${args.reason}`,
                        source: "Oracle Chat",
                        actor: "User via AI"
                    }
                });
                toolResult = `Status updated to ${args.status}.`;
            }

            // Report back to LLM for final confirmation
            const followUp = await client.chat.completions.create({
                model: process.env.AZURE_AI_MODEL || "DeepSeek-V3",
                messages: [
                    ...messages as any,
                    initialMsg,
                    { role: "tool", tool_call_id: toolCall.id, content: toolResult }
                ]
            });

            revalidatePath(`/dashboard`);
            return {
                message: followUp.choices[0].message.content || "Done.",
                toolCalls: [toolCall] // Return to UI so we can show "Oracle updated..."
            };
        }

        return {
            message: initialMsg.content || "I'm listening."
        };

    } catch (e) {
        console.error("Oracle Chat Error:", e);
        return { message: "I encountered an error processing your request." };
    }
}

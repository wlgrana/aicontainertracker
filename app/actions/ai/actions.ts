"use server";

// Mocking Gemini API for now, but following the structure
export async function askAiAssistant(containerNumber: string, context: any, question: string) {
    try {
        // In a real implementation, you'd use @google/generative-ai here
        // const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        // const prompt = `Context: ${JSON.stringify(context)}\nUser: ${question}`;

        // Simulating a smart response based on context
        let answer = "I've analyzed the mission profile for " + containerNumber + ". ";

        if (question.toLowerCase().includes("demurrage") || question.toLowerCase().includes("cost")) {
            const lfd = context.lastFreeDay ? new Date(context.lastFreeDay).toLocaleDateString() : "unknown";
            answer += `This container is currently at risk of demurrage. The Last Free Day was ${lfd}. Based on current terminal rates, you are incurring approximately $150/day in storage fees.`;
        } else if (question.toLowerCase().includes("stuck") || question.toLowerCase().includes("why")) {
            answer += `The container is currently in ${context.currentStatus} status. The full event log shows a delay at ${context.currentLocation || "the terminal"}. This is often due to documentation mismatch or customs inspection backlog.`;
        } else {
            answer += "The container is progressing through the supply chain. Currently it has completed " + context.progressPercentage + "% of its scheduled transit stages.";
        }

        return { success: true, answer };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

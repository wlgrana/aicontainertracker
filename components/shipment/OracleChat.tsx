"use client";

import * as React from "react";
import { Sparkles, Send, Bot, User, X, Loader2, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { chatWithOracle } from "@/app/actions/chatOracle";
import { toast } from "sonner";

interface OracleChatProps {
    containerId: string;
}

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    isTool?: boolean;
}

export function OracleChat({ containerId }: OracleChatProps) {
    const [isOpen, setIsOpen] = React.useState(false);
    const [input, setInput] = React.useState("");
    const [messages, setMessages] = React.useState<Message[]>([
        { role: 'assistant', content: "Hello. I am the Mission Oracle. I have full context on this container. How can I assist?" }
    ]);
    const [isLoading, setIsLoading] = React.useState(false);
    const scrollRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMsg = input.trim();
        setInput("");

        const newHistory = [...messages, { role: 'user', content: userMsg } as Message];
        setMessages(newHistory);
        setIsLoading(true);

        try {
            // Remove 'system' role or sanitize if needed, but our server action handles context injection
            const apiHistory = newHistory.filter(m => m.role !== 'system');

            const response = await chatWithOracle(containerId, apiHistory);

            // If tools were used, we display that first
            if (response.toolCalls) {
                response.toolCalls.forEach(tool => {
                    const args = JSON.parse(tool.function.arguments);
                    let display = "";
                    if (tool.function.name === 'add_note') display = `Added Note: "${args.note}"`;
                    if (tool.function.name === 'update_status') display = `Updated Status: ${args.status}`;

                    newHistory.push({ role: 'assistant', content: display, isTool: true });
                });
            }

            setMessages([...newHistory, { role: 'assistant', content: response.message }]);

        } catch (error) {
            toast.error("Oracle disconnected. Try again.");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100">
                    <Sparkles className="h-4 w-4" />
                    Chat with Oracle
                </Button>
            </SheetTrigger>
            <SheetContent className="w-[400px] sm:w-[540px] flex flex-col p-0 h-full">
                <SheetHeader className="px-6 py-4 border-b border-slate-100 bg-white">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                            <Bot className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <SheetTitle className="text-lg font-bold">Mission Oracle</SheetTitle>
                            <SheetDescription className="text-xs">Context-Aware Logistics Intelligence</SheetDescription>
                        </div>
                    </div>
                </SheetHeader>

                <div className="flex-1 overflow-hidden bg-slate-50 relative flex flex-col">
                    <ScrollArea className="flex-1 p-6">
                        <div className="space-y-4">
                            {messages.map((m, i) => (
                                <div key={i} className={cn(
                                    "flex gap-3 max-w-[90%]",
                                    m.role === 'user' ? "ml-auto flex-row-reverse" : ""
                                )}>
                                    {/* Avatar */}
                                    <div className={cn(
                                        "h-8 w-8 rounded-full flex items-center justify-center shrink-0 border",
                                        m.role === 'user' ? "bg-white border-slate-200" :
                                            m.isTool ? "bg-emerald-100 border-emerald-200" : "bg-indigo-100 border-indigo-200"
                                    )}>
                                        {m.role === 'user' ? <User className="h-4 w-4 text-slate-600" /> :
                                            m.isTool ? <Database className="h-4 w-4 text-emerald-600" /> :
                                                <Bot className="h-4 w-4 text-indigo-600" />}
                                    </div>

                                    {/* Bubble */}
                                    <div className={cn(
                                        "p-3 rounded-2xl text-sm leading-relaxed shadow-sm",
                                        m.role === 'user'
                                            ? "bg-indigo-600 text-white rounded-br-none"
                                            : m.isTool
                                                ? "bg-white border border-emerald-200 text-emerald-800 font-mono text-xs rounded-bl-none"
                                                : "bg-white border border-slate-200 text-slate-800 rounded-bl-none"
                                    )}>
                                        {m.content}
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex gap-3">
                                    <div className="h-8 w-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center animate-pulse">
                                        <Bot className="h-4 w-4 text-indigo-400" />
                                    </div>
                                    <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-2">
                                        <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                                        <span className="text-xs text-slate-400 font-medium">Oracle is thinking...</span>
                                    </div>
                                </div>
                            )}
                            <div ref={scrollRef} />
                        </div>
                    </ScrollArea>
                </div>

                <div className="p-4 bg-white border-t border-slate-100">
                    <form onSubmit={handleSubmit} className="flex gap-2">
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask about status, ETA, or add a note..."
                            className="bg-slate-50 border-slate-200 focus-visible:ring-indigo-500"
                            disabled={isLoading}
                        />
                        <Button type="submit" size="icon" className="bg-indigo-600 hover:bg-indigo-700" disabled={isLoading || !input.trim()}>
                            <Send className="h-4 w-4" />
                        </Button>
                    </form>
                </div>
            </SheetContent>
        </Sheet>
    );
}

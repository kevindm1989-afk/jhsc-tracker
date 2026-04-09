import { useState, useRef, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAnthropicConversations,
  useCreateAnthropicConversation,
  useDeleteAnthropicConversation,
  getListAnthropicConversationsQueryKey,
  AnthropicConversation,
  AnthropicMessage,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Send, Bot, User, Loader2, MessageSquare } from "lucide-react";

import { apiUrl, API_BASE } from "@/lib/api";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" });
}

function MessageBubble({ msg, isStreaming }: { msg: AnthropicMessage | { role: string; content: string; id?: number; createdAt?: string; streaming?: boolean }; isStreaming?: boolean }) {
  const isAssistant = msg.role === "assistant";
  return (
    <div className={cn("flex gap-3 mb-4", isAssistant ? "flex-row" : "flex-row-reverse")}>
      <div className={cn("flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm", isAssistant ? "bg-primary" : "bg-muted-foreground")}>
        {isAssistant ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
      </div>
      <div className={cn("max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words", isAssistant ? "bg-muted text-foreground rounded-tl-sm" : "bg-primary text-primary-foreground rounded-tr-sm")}>
        {msg.content}
        {isStreaming && <span className="inline-block w-1.5 h-4 ml-1 bg-current animate-pulse rounded-sm" />}
      </div>
    </div>
  );
}

export default function AIAssistantPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Array<AnthropicMessage | { role: string; content: string; streaming?: boolean }>>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: conversations = [], isLoading: convLoading } = useListAnthropicConversations();

  const createMutation = useCreateAnthropicConversation({
    mutation: {
      onSuccess: (conv) => {
        queryClient.invalidateQueries({ queryKey: getListAnthropicConversationsQueryKey() });
        setActiveConvId(conv.id);
        setMessages([]);
        setShowNewForm(false);
        setNewTitle("");
      },
      onError: () => toast({ title: "Failed to create conversation", variant: "destructive" }),
    },
  });

  const deleteMutation = useDeleteAnthropicConversation({
    mutation: {
      onSuccess: (_, { id }) => {
        queryClient.invalidateQueries({ queryKey: getListAnthropicConversationsQueryKey() });
        if (activeConvId === id) { setActiveConvId(null); setMessages([]); }
      },
      onError: () => toast({ title: "Failed to delete conversation", variant: "destructive" }),
    },
  });

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const loadConversation = useCallback(async (id: number) => {
    setActiveConvId(id);
    setIsLoadingMessages(true);
    try {
      const resp = await fetch(apiUrl(`/api/anthropic/conversations/${id}`));
      const data = await resp.json();
      setMessages(data.messages ?? []);
    } catch {
      toast({ title: "Failed to load conversation", variant: "destructive" });
    } finally {
      setIsLoadingMessages(false);
    }
  }, [toast]);

  const handleSend = async () => {
    if (!input.trim() || !activeConvId || isStreaming) return;
    const userMsg = { role: "user", content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);

    const assistantMsg = { role: "assistant", content: "", streaming: true };
    setMessages(prev => [...prev, assistantMsg]);

    try {
      const resp = await fetch(apiUrl(`/api/anthropic/conversations/${activeConvId}/messages`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userMsg.content }),
      });
      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.content) {
              setMessages(prev => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last && last.role === "assistant") copy[copy.length - 1] = { ...last, content: last.content + parsed.content };
                return copy;
              });
            }
            if (parsed.done || parsed.error) {
              setMessages(prev => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last && "streaming" in last) copy[copy.length - 1] = { ...last, streaming: false };
                return copy;
              });
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch {
      toast({ title: "Failed to send message", variant: "destructive" });
      setMessages(prev => prev.filter((_, i) => i < prev.length - 1));
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleCreateConversation = () => {
    if (!newTitle.trim()) return;
    createMutation.mutate({ data: { title: newTitle.trim() } });
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0 overflow-hidden rounded-lg border bg-background">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0 border-r flex flex-col bg-muted/30">
        <div className="p-3 border-b">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-foreground">Conversations</h2>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowNewForm(v => !v)} title="New conversation">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {showNewForm && (
            <div className="flex flex-col gap-1.5 mt-2">
              <input
                autoFocus
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleCreateConversation(); if (e.key === "Escape") setShowNewForm(false); }}
                placeholder="Conversation title…"
                className="text-xs px-2 py-1.5 rounded border bg-background outline-none focus:ring-1 focus:ring-primary w-full"
              />
              <Button size="sm" className="h-6 text-xs" onClick={handleCreateConversation} disabled={createMutation.isPending || !newTitle.trim()}>
                {createMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Create"}
              </Button>
            </div>
          )}
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {convLoading && <p className="text-xs text-muted-foreground px-2 py-1">Loading…</p>}
            {!convLoading && conversations.length === 0 && (
              <p className="text-xs text-muted-foreground px-2 py-3 text-center">No conversations yet.<br />Click + to start one.</p>
            )}
            {(conversations as AnthropicConversation[]).map(conv => (
              <div key={conv.id} className={cn("group flex items-center gap-1 rounded-md px-2 py-1.5 cursor-pointer text-sm transition-colors", activeConvId === conv.id ? "bg-primary text-primary-foreground" : "hover:bg-muted")} onClick={() => loadConversation(conv.id)}>
                <MessageSquare className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />
                <span className="flex-1 truncate text-xs">{conv.title}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className={cn("h-5 w-5 opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity", activeConvId === conv.id ? "hover:bg-primary-foreground/20 text-primary-foreground" : "hover:bg-muted-foreground/20")}
                  onClick={e => { e.stopPropagation(); deleteMutation.mutate({ id: conv.id }); }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="p-3 border-t">
          <p className="text-xs text-muted-foreground">Powered by Claude AI</p>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {!activeConvId ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-1">JHSC AI Assistant</h3>
              <p className="text-sm text-muted-foreground max-w-sm">Ask questions about health & safety, the Ontario OHSA, inspection procedures, or anything else related to your committee work.</p>
            </div>
            <Button onClick={() => setShowNewForm(true)} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />Start a conversation
            </Button>
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
              {isLoadingMessages && (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />Loading messages…
                </div>
              )}
              {!isLoadingMessages && messages.length === 0 && (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  Send a message to start the conversation.
                </div>
              )}
              {messages.map((msg, i) => (
                <MessageBubble key={i} msg={msg} isStreaming={"streaming" in msg && !!msg.streaming} />
              ))}
            </div>
            <div className="border-t p-3 flex gap-2 items-end bg-background">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything… (Enter to send, Shift+Enter for new line)"
                className="flex-1 min-h-[44px] max-h-32 resize-none text-sm"
                disabled={isStreaming}
                rows={1}
              />
              <Button size="icon" onClick={handleSend} disabled={!input.trim() || isStreaming} className="h-11 w-11 flex-shrink-0">
                {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

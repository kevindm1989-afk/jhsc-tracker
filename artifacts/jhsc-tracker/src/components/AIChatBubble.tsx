import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, X, Send, Loader2, Plus, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Msg = { role: "user" | "assistant"; content: string; streaming?: boolean };

function Bubble({ msg }: { msg: Msg }) {
  const isAI = msg.role === "assistant";
  return (
    <div className={cn("flex gap-2 mb-3", isAI ? "flex-row" : "flex-row-reverse")}>
      <div
        className={cn(
          "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white",
          isAI ? "bg-primary" : "bg-muted-foreground",
        )}
      >
        <Bot className="w-3 h-3" />
      </div>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap break-words",
          isAI
            ? "bg-muted text-foreground rounded-tl-sm"
            : "bg-primary text-primary-foreground rounded-tr-sm",
        )}
      >
        {msg.content || (msg.streaming ? "" : "")}
        {msg.streaming && (
          <span className="inline-block w-1 h-3 ml-0.5 bg-current animate-pulse rounded-sm" />
        )}
      </div>
    </div>
  );
}

export default function AIChatBubble() {
  const [open, setOpen] = useState(false);
  const [convId, setConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isInit, setIsInit] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [, navigate] = useLocation();

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (open && !convId && !isInit) {
      setIsInit(true);
      fetch(`${BASE}/api/anthropic/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Quick Chat" }),
      })
        .then((r) => r.json())
        .then((conv) => {
          setConvId(conv.id);
        })
        .catch(() => {});
    }
  }, [open, convId, isInit]);

  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [open]);

  const handleSend = async () => {
    if (!input.trim() || !convId || isStreaming) return;
    const userMsg: Msg = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);

    const assistantMsg: Msg = { role: "assistant", content: "", streaming: true };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const resp = await fetch(`${BASE}/api/anthropic/conversations/${convId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userMsg.content }),
      });
      if (!resp.body) throw new Error("No body");

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
              setMessages((prev) => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last?.role === "assistant")
                  copy[copy.length - 1] = { ...last, content: last.content + parsed.content };
                return copy;
              });
            }
            if (parsed.done || parsed.error) {
              setMessages((prev) => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last?.role === "assistant") copy[copy.length - 1] = { ...last, streaming: false };
                return copy;
              });
            }
          } catch {
            /* ignore */
          }
        }
      }
    } catch {
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    setConvId(null);
    setMessages([]);
    setIsInit(false);
  };

  return (
    <>
      {open && (
        <div className="fixed bottom-20 right-4 z-50 w-80 rounded-2xl border bg-background shadow-2xl flex flex-col overflow-hidden"
          style={{ height: "420px" }}>
          <div className="flex items-center justify-between px-3 py-2 border-b bg-primary text-primary-foreground flex-shrink-0">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4" />
              <span className="text-sm font-semibold">AI Assistant</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-primary-foreground hover:bg-primary-foreground/20"
                title="New chat"
                onClick={handleNewChat}
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-primary-foreground hover:bg-primary-foreground/20"
                title="Open full assistant"
                onClick={() => {
                  setOpen(false);
                  navigate("/ai-assistant");
                }}
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-primary-foreground hover:bg-primary-foreground/20"
                onClick={() => setOpen(false)}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                <Bot className="w-8 h-8 text-primary/40" />
                <p className="text-xs text-muted-foreground max-w-[200px]">
                  Ask anything about health & safety, OHSA, or your JHSC work.
                </p>
              </div>
            )}
            {messages.map((msg, i) => (
              <Bubble key={i} msg={msg} />
            ))}
          </div>

          <div className="border-t p-2 flex gap-1.5 items-end flex-shrink-0 bg-background">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask something… (Enter to send)"
              className="flex-1 min-h-[36px] max-h-24 resize-none text-xs"
              disabled={isStreaming || !convId}
              rows={1}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!input.trim() || isStreaming || !convId}
              className="h-9 w-9 flex-shrink-0"
            >
              {isStreaming ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </Button>
          </div>
        </div>
      )}

      <Button
        size="icon"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed bottom-4 right-4 z-50 h-12 w-12 rounded-full shadow-lg transition-transform",
          open && "rotate-[15deg]",
        )}
        title="AI Assistant"
      >
        <Bot className="w-5 h-5" />
      </Button>
    </>
  );
}

import { useState, useRef, useEffect } from "react";
import { useChat } from "@/hooks/useChat";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const JHSC_ROLES = ["co-chair", "admin", "worker-rep"];

function ChatPane({ channel }: { channel: "general" | "jhsc" }) {
  const { messages, send, connected, error } = useChat(channel);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!input.trim()) return;
    await send(input.trim());
    setInput("");
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2 border-b text-sm text-muted-foreground">
        <span className={`inline-block w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-400"}`} />
        {connected ? "Connected" : "Connecting..."}
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center mt-8">No messages yet. Start the conversation!</p>
        )}
        {messages.map((msg) => {
          const isMe = msg.userId === user?.id;
          return (
            <div key={msg.id} className={`mb-3 flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-xs lg:max-w-md ${isMe ? "items-end" : "items-start"} flex flex-col`}>
                {!isMe && (
                  <span className="text-xs text-muted-foreground mb-1">{msg.userName}</span>
                )}
                <div
                  className={`rounded-lg px-3 py-2 text-sm ${
                    isMe
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {msg.message}
                </div>
                {msg.createdAt && (
                  <span className="text-xs text-muted-foreground mt-1">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2 px-4 py-3 border-t">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Type a message..."
          className="flex-1"
        />
        <Button onClick={handleSend} disabled={!input.trim() || !connected}>
          Send
        </Button>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const { user } = useAuth();
  const canJhsc = JHSC_ROLES.includes(user?.role ?? "");
  const [activeChannel, setActiveChannel] = useState<"general" | "jhsc">("general");

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center gap-2 p-4 border-b">
        <h1 className="text-xl font-semibold">Team Chat</h1>
      </div>
      <div className="flex gap-2 px-4 pt-3">
        <Button
          variant={activeChannel === "general" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveChannel("general")}
        >
          General
        </Button>
        {canJhsc && (
          <Button
            variant={activeChannel === "jhsc" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveChannel("jhsc")}
          >
            JHSC
            <Badge variant="secondary" className="ml-2 text-xs">Members</Badge>
          </Button>
        )}
      </div>
      <div className="flex-1 mt-2 overflow-hidden">
        <ChatPane key={activeChannel} channel={activeChannel} />
      </div>
    </div>
  );
}

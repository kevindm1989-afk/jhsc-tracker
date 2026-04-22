import { useState, useRef, useEffect } from "react";
import { useChat } from "@/hooks/useChat";
import { useDMChat } from "@/hooks/useDMChat";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const JHSC_ROLES = ["co-chair", "admin", "worker-rep"];

interface Member {
  id: number;
  displayName: string;
  role: string;
}

type ActiveView =
  | { type: "channel"; name: "general" | "jhsc" }
  | { type: "dm"; member: Member };

function MessageList({
  messages,
  myId,
}: {
  messages: { id: number; userId: number; userName: string; message: string; createdAt: string | null }[];
  myId: number | undefined;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3">
      {messages.length === 0 && (
        <p className="text-sm text-muted-foreground text-center mt-8">
          No messages yet. Start the conversation!
        </p>
      )}
      {messages.map((msg) => {
        const isMe = msg.userId === myId;
        return (
          <div key={msg.id} className={`mb-3 flex ${isMe ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[75%] flex flex-col ${isMe ? "items-end" : "items-start"}`}>
              {!isMe && (
                <span className="text-xs text-muted-foreground mb-1">{msg.userName}</span>
              )}
              <div
                className={`rounded-2xl px-3 py-2 text-sm break-words ${
                  isMe ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                }`}
              >
                {msg.message}
              </div>
              {msg.createdAt && (
                <span className="text-xs text-muted-foreground mt-1">
                  {new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}

function ChannelPane({ channel }: { channel: "general" | "jhsc" }) {
  const { messages, send, connected, error } = useChat(channel);
  const { user } = useAuth();
  const [input, setInput] = useState("");

  async function handleSend() {
    if (!input.trim()) return;
    await send(input.trim());
    setInput("");
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
      <div className="flex items-center gap-2 px-4 py-2 border-b text-sm text-muted-foreground shrink-0">
        <span
          className={`inline-block w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-400"}`}
        />
        {connected ? "Connected" : "Connecting..."}
      </div>
      <MessageList messages={messages} myId={user?.id} />
      <div className="flex gap-2 px-4 py-3 border-t shrink-0">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
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

function DMPane({ member }: { member: Member }) {
  const { user } = useAuth();
  const { messages, send, connected, error } = useDMChat(user?.id ?? null, member.id);
  const [input, setInput] = useState("");
  const startedRef = useRef(false);
  const initialHistoryEmpty = useRef<boolean | null>(null);

  useEffect(() => {
    if (initialHistoryEmpty.current === null && messages !== undefined) {
      initialHistoryEmpty.current = messages.length === 0;
    }
  }, [messages]);

  async function handleSend() {
    if (!input.trim()) return;
    const msg = input.trim();
    setInput("");

    if (!startedRef.current && initialHistoryEmpty.current) {
      startedRef.current = true;
      fetch(`${BASE}/api/chat/dm/${member.id}/start`, {
        method: "POST",
        credentials: "include",
      }).catch(() => {});
    }

    await send(msg);
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
      <div className="flex items-center gap-2 px-4 py-2 border-b text-sm text-muted-foreground shrink-0">
        <span
          className={`inline-block w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-400"}`}
        />
        {connected ? "Connected" : "Connecting..."}
      </div>
      <MessageList messages={messages} myId={user?.id} />
      <div className="flex gap-2 px-4 py-3 border-t shrink-0">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={`Message ${member.displayName}...`}
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
  const [activeView, setActiveView] = useState<ActiveView>({ type: "channel", name: "general" });
  const [members, setMembers] = useState<Member[]>([]);
  const [showList, setShowList] = useState(true);

  useEffect(() => {
    fetch(`${BASE}/api/chat/members`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setMembers(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  function selectView(view: ActiveView) {
    setActiveView(view);
    setShowList(false);
  }

  function isActiveChannel(name: "general" | "jhsc") {
    return activeView.type === "channel" && activeView.name === name;
  }

  function isActiveDM(id: number) {
    return activeView.type === "dm" && activeView.member.id === id;
  }

  const chatTitle =
    activeView.type === "channel"
      ? `# ${activeView.name === "general" ? "General" : "JHSC"}`
      : activeView.member.displayName;

  return (
    <div className="flex h-[calc(100vh-4rem)] md:h-[calc(100vh-8rem)] overflow-hidden">

      {/* Sidebar — full screen on mobile when showList=true, fixed column on desktop */}
      <div
        className={`
          flex-col border-r bg-background
          w-full md:w-52 md:shrink-0
          ${showList ? "flex" : "hidden"} md:flex
        `}
      >
        <div className="px-3 pt-4 pb-2 shrink-0">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Channels
          </p>
          <button
            onClick={() => selectView({ type: "channel", name: "general" })}
            className={`w-full text-left px-2 py-2 rounded text-sm flex items-center gap-2 transition-colors ${
              isActiveChannel("general")
                ? "bg-primary/10 text-primary font-medium"
                : "hover:bg-muted text-foreground"
            }`}
          >
            <span className="text-muted-foreground">#</span> General
          </button>
          {canJhsc && (
            <button
              onClick={() => selectView({ type: "channel", name: "jhsc" })}
              className={`w-full text-left px-2 py-2 rounded text-sm flex items-center gap-2 transition-colors ${
                isActiveChannel("jhsc")
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-muted text-foreground"
              }`}
            >
              <span className="text-muted-foreground">#</span> JHSC
              <Badge variant="secondary" className="ml-auto text-xs">Members</Badge>
            </button>
          )}
        </div>

        <div className="px-3 pt-3 flex-1 overflow-y-auto">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Direct Messages
          </p>
          {members.length === 0 && (
            <p className="text-xs text-muted-foreground px-2">No members found</p>
          )}
          {members.map((m) => (
            <button
              key={m.id}
              onClick={() => selectView({ type: "dm", member: m })}
              className={`w-full text-left px-2 py-2 rounded text-sm flex items-center gap-2 transition-colors ${
                isActiveDM(m.id)
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-muted text-foreground"
              }`}
            >
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-muted text-muted-foreground text-xs shrink-0 font-medium">
                {m.displayName.charAt(0).toUpperCase()}
              </span>
              <span className="truncate">{m.displayName}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Chat panel — full screen on mobile when showList=false, fills remaining space on desktop */}
      <div
        className={`
          flex-col flex-1 overflow-hidden
          ${!showList ? "flex" : "hidden"} md:flex
        `}
      >
        {/* Header with back button on mobile */}
        <div className="flex items-center gap-2 px-3 py-3 border-b shrink-0">
          <button
            onClick={() => setShowList(true)}
            className="md:hidden flex items-center gap-1 text-sm text-primary font-medium mr-1 shrink-0"
          >
            <ChevronLeft className="h-4 w-4" />
            Channels
          </button>
          {activeView.type === "channel" ? (
            <h1 className="text-base font-semibold truncate">{chatTitle}</h1>
          ) : (
            <h1 className="text-base font-semibold flex items-center gap-2 truncate">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-muted text-sm font-medium shrink-0">
                {activeView.member.displayName.charAt(0).toUpperCase()}
              </span>
              <span className="truncate">{activeView.member.displayName}</span>
            </h1>
          )}
        </div>

        <div className="flex-1 overflow-hidden">
          {activeView.type === "channel" ? (
            <ChannelPane key={activeView.name} channel={activeView.name} />
          ) : (
            <DMPane key={activeView.member.id} member={activeView.member} />
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useRef, useEffect, useCallback } from "react";

interface Utterance {
  speaker: string;
  text: string;
  start: number;
  end: number;
}

interface TranscriptResult {
  status: string;
  text?: string;
  utterances?: Utterance[];
  audio_duration?: number;
  words?: unknown[];
  confidence?: number;
  error?: string;
}

type AppState = "idle" | "recording" | "paused" | "preview" | "uploading" | "processing" | "done" | "error";

const COLOURS: Record<number, { bg: string; text: string; label: string }> = {
  0: { bg: "#dbeafe", text: "#1d4ed8", label: "Speaker A" },
  1: { bg: "#fee2e2", text: "#b91c1c", label: "Speaker B" },
  2: { bg: "#dcfce7", text: "#166534", label: "Speaker C" },
  3: { bg: "#fef9c3", text: "#854d0e", label: "Speaker D" },
  4: { bg: "#ede9fe", text: "#5b21b6", label: "Speaker E" },
  5: { bg: "#ffedd5", text: "#9a3412", label: "Speaker F" },
};

function formatHMS(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sc = s % 60;
  return [h, m, sc].map(v => String(v).padStart(2, "0")).join(":");
}

function msToHMS(ms: number): string {
  return formatHMS(Math.floor(ms / 1000));
}

function buildPlainText(utterances?: Utterance[], fallback?: string, names?: Record<string,string>): string {
  const date = new Date().toLocaleDateString("en-CA", { dateStyle: "full" });
  const header = ["MEETING MINUTES - Unifor Local 1285", "Date: " + date, "-".repeat(50), ""].join("\n");
  if (utterances?.length) {
    const body = utterances.map(u => {
      const idx = u.speaker.charCodeAt(0) - 65;
      const label = names?.[u.speaker] || COLOURS[idx % 6]?.label || ("Speaker " + u.speaker);
      return "[" + msToHMS(u.start) + "] " + label + "\n" + u.text + "\n";
    }).join("\n");
    return header + body;
  }
  return header + (fallback ?? "");
}

export default function MeetingTranscription() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [statusMsg, setStatusMsg] = useState("");
  const [elapsed, setElapsed] = useState("");
  const [result, setResult] = useState<TranscriptResult | null>(null);
  const [copyLabel, setCopyLabel] = useState("Copy");
  const [speakerNames, setSpeakerNames] = useState<Record<string, string>>({});
  const [audioUrl, setAudioUrl] = useState<string>("");

  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submitStartRef = useRef(0);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
  }, []);

  useEffect(() => () => {
    stopTimer();
    if (pollRef.current) clearInterval(pollRef.current);
    if (elapsedRef.current) clearInterval(elapsedRef.current);
  }, [stopTimer]);

  const handleRecord = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const mr = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        setTimeout(() => {
          const blob = new Blob(chunksRef.current, { type: mime });
          setAudioUrl(URL.createObjectURL(blob));
          setAppState("preview");
        }, 300);
      };
      mr.start(1000);
      mrRef.current = mr;
      setSeconds(0);
      setAppState("recording");
      startTimer();
    } catch {
      alert("Microphone access denied. Please allow microphone access in your browser settings.");
    }
  };

  const handlePause = () => {
    const mr = mrRef.current;
    if (!mr) return;
    if (mr.state === "recording") { mr.pause(); stopTimer(); setAppState("paused"); }
    else if (mr.state === "paused") { mr.resume(); startTimer(); setAppState("recording"); }
  };

  const handleStop = () => { mrRef.current?.stop(); stopTimer(); };

  const handleDiscard = () => {
    chunksRef.current = [];
    setAudioUrl("");
    setSeconds(0);
    setAppState("idle");
  };

  const handleSubmit = async () => {
    const mime = mrRef.current?.mimeType ?? "audio/webm";
    const blob = new Blob(chunksRef.current, { type: mime });
    const fd = new FormData();
    fd.append("audio", blob, "meeting.webm");
    setAppState("uploading");
    setStatusMsg("Uploading audio to server...");
    submitStartRef.current = Date.now();
    elapsedRef.current = setInterval(() => {
      setElapsed("Elapsed: " + formatHMS(Math.floor((Date.now() - submitStartRef.current) / 1000)));
    }, 1000);
    try {
      const up = await fetch("/api/transcription/upload", { method: "POST", body: fd });
      const upData = await up.json();
      if (!upData.id) throw new Error(upData.error ?? "Upload failed.");
      setAppState("processing");
      setStatusMsg("Audio received — transcribing with speaker identification...");
      let attempts = 0;
      pollRef.current = setInterval(async () => {
        attempts++;
        try {
          const pr = await fetch("/api/transcription/status/" + upData.id);
          const pd: TranscriptResult = await pr.json();
          if (pd.status === "completed") {
            clearInterval(pollRef.current!);
            clearInterval(elapsedRef.current!);
            setElapsed("");
            setResult(pd);
            const speakers = [...new Set((pd.utterances ?? []).map(u => u.speaker))];
            const nm: Record<string,string> = {};
            speakers.forEach((s, i) => { nm[s] = COLOURS[i % 6]?.label ?? ("Speaker " + s); });
            setSpeakerNames(nm);
            setAppState("done");
          } else if (pd.status === "error") {
            clearInterval(pollRef.current!);
            clearInterval(elapsedRef.current!);
            setStatusMsg("Transcription error: " + pd.error);
            setAppState("error");
          } else {
            setStatusMsg("Transcribing... (" + (attempts * 8) + "s on AssemblyAI)");
          }
        } catch {
          clearInterval(pollRef.current!);
          clearInterval(elapsedRef.current!);
          setStatusMsg("Connection error while checking status.");
          setAppState("error");
        }
      }, 8000);
    } catch (err: any) {
      clearInterval(elapsedRef.current!);
      setStatusMsg("Error: " + err.message);
      setAppState("error");
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(buildPlainText(result?.utterances, result?.text, speakerNames));
    setCopyLabel("Copied");
    setTimeout(() => setCopyLabel("Copy"), 2000);
  };

  const handleDownload = () => {
    const text = buildPlainText(result?.utterances, result?.text, speakerNames);
    const date = new Date().toISOString().slice(0, 10);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    a.download = "meeting-minutes-" + date + ".txt";
    a.click();
  };

  const handleNew = () => {
    chunksRef.current = [];
    setAudioUrl("");
    setResult(null); setSpeakerNames({}); setSeconds(0);
    setStatusMsg(""); setElapsed(""); setAppState("idle");
    if (pollRef.current) clearInterval(pollRef.current);
  };

  const isRecording = appState === "recording";
  const isPaused = appState === "paused";
  const isProcessing = appState === "uploading" || appState === "processing";

  const card: React.CSSProperties = { background: "#fff", borderRadius: "12px", padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", marginBottom: "16px" };
  const h2s: React.CSSProperties = { fontSize: "16px", fontWeight: 600, color: "#1a2744", margin: "0 0 8px" };
  const btn = (bg: string, color: string, border?: string): React.CSSProperties => ({
    padding: "10px 18px", borderRadius: "8px", fontSize: "14px", fontWeight: 500,
    cursor: "pointer", background: bg, color, border: border ?? "none",
    display: "inline-flex", alignItems: "center", gap: "6px",
  });

  return (
    <div style={{ padding: "24px", maxWidth: "760px", margin: "0 auto", fontFamily: "IBM Plex Sans, sans-serif" }}>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 600, color: "#1a2744", margin: 0 }}>Meeting Transcription</h1>
        <p style={{ fontSize: "14px", color: "#666", marginTop: "4px" }}>Unifor Local 1285 — AssemblyAI Universal-2 with speaker identification</p>
      </div>

      {(appState === "idle" || isRecording || isPaused || appState === "preview") && (
        <div style={card}>
          <h2 style={h2s}>Record Meeting Audio</h2>
          <p style={{ fontSize: "13px", color: "#666", marginBottom: "20px", lineHeight: "1.6" }}>
            Tap Start Recording before the meeting begins. Stop when finished, preview, then submit.
          </p>
          <div style={{ fontSize: "48px", fontWeight: 700, textAlign: "center", letterSpacing: "3px",
            color: isRecording ? "#E33225" : "#1a2744", margin: "16px 0",
            fontVariantNumeric: "tabular-nums", opacity: isPaused ? 0.5 : 1 }}>
            {formatHMS(seconds)}
          </div>
          <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap", marginBottom: "20px" }}>
            {appState === "idle" && (
              <button onClick={handleRecord} style={btn("#1a2744", "#fff")}>
                <span style={{ width: "8px", height: "8px", background: "#E33225", borderRadius: "50%", display: "inline-block" }} />
                Start Recording
              </button>
            )}
            {(isRecording || isPaused) && (
              <><button onClick={handlePause} style={btn("#f0f2f5", "#1a2744")}>{isPaused ? "Resume" : "Pause"}</button>
              <button onClick={handleStop} style={btn("#E33225", "#fff")}>Stop</button></>
            )}
          </div>
          {appState === "preview" && (
            <div>
              <p style={{ fontSize: "13px", color: "#666", marginBottom: "8px" }}>Preview before submitting:</p>
              <audio ref={audioRef} src={audioUrl} controls style={{ width: "100%", marginBottom: "16px" }} />
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button onClick={handleSubmit} style={btn("#1a2744", "#fff")}>Submit for Transcription</button>
                <button onClick={handleDiscard} style={btn("transparent", "#888", "1px solid #ddd")}>Discard & Re-record</button>
              </div>
            </div>
          )}
        </div>
      )}

      {isProcessing && (
        <div style={card}>
          <h2 style={h2s}>Transcription in Progress</h2>
          <div style={{ height: "6px", background: "#eee", borderRadius: "3px", overflow: "hidden", margin: "16px 0 8px" }}>
            <div style={{ height: "100%", background: "#1a2744", borderRadius: "3px", width: "40%",
              animation: "indeterminate 1.5s infinite" }} />
          </div>
          <style>{`@keyframes indeterminate { 0%{transform:translateX(-100%)} 100%{transform:translateX(300%)} }`}</style>
          <p style={{ fontSize: "14px", fontWeight: 500, color: "#1a2744", marginBottom: "4px" }}>{statusMsg}</p>
          {elapsed && <p style={{ fontSize: "12px", color: "#888" }}>{elapsed}</p>}
          <p style={{ fontSize: "12px", color: "#aaa", marginTop: "12px" }}>
            A 4-hour meeting typically takes 30-45 minutes to process. You can leave this page open.
          </p>
        </div>
      )}

      {appState === "error" && (
        <div style={{ ...card, borderLeft: "4px solid #E33225" }}>
          <p style={{ fontSize: "14px", color: "#E33225", fontWeight: 500, marginBottom: "12px" }}>{statusMsg}</p>
          <button onClick={handleNew} style={btn("#1a2744", "#fff")}>Try Again</button>
        </div>
      )}

      {appState === "done" && result && (
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px", marginBottom: "16px" }}>
            <h2 style={h2s}>Transcript</h2>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button onClick={handleCopy} style={btn("#f0f2f5", "#1a2744")}>{copyLabel}</button>
              <button onClick={handleDownload} style={btn("#f0f2f5", "#1a2744")}>Download .txt</button>
              <button onClick={handleNew} style={btn("transparent", "#888", "1px solid #ddd")}>New Recording</button>
            </div>
          </div>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "12px", color: "#888",
            background: "#f7f8fa", borderRadius: "6px", padding: "8px 12px", marginBottom: "16px" }}>
            {result.audio_duration && <span>Duration: <strong>{formatHMS(Math.round(result.audio_duration))}</strong></span>}
            {result.utterances && <span>Speakers: <strong>{new Set(result.utterances.map(u => u.speaker)).size}</strong></span>}
            {result.words && <span>Words: <strong>{(result.words as unknown[]).length}</strong></span>}
            {result.confidence && <span>Confidence: <strong>{Math.round(result.confidence * 100)}%</strong></span>}
          </div>
          {result.utterances && result.utterances.length > 0 && (
            <div style={{ marginBottom: "16px", padding: "12px", background: "#f0f4ff", borderRadius: "8px" }}>
              <p style={{ fontSize: "12px", fontWeight: 600, color: "#1a2744", marginBottom: "8px" }}>
                Rename speakers (optional — updates the downloaded file):
              </p>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {[...new Set(result.utterances.map(u => u.speaker))].map((s, i) => (
                  <div key={s} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "4px",
                      background: COLOURS[i % 6].bg, color: COLOURS[i % 6].text }}>
                      Speaker {s}
                    </span>
                    <input type="text" placeholder="Enter name"
                      value={speakerNames[s] ?? ""}
                      onChange={e => setSpeakerNames(prev => ({ ...prev, [s]: e.target.value }))}
                      style={{ fontSize: "13px", padding: "4px 8px", borderRadius: "4px", border: "1px solid #ddd", width: "130px" }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ fontSize: "14px", lineHeight: "1.8" }}>
            {result.utterances?.length
              ? result.utterances.map((u, i) => {
                  const idx = u.speaker.charCodeAt(0) - 65;
                  const c = COLOURS[idx % 6];
                  const name = speakerNames[u.speaker] || c.label;
                  return (
                    <div key={i} style={{ marginBottom: "14px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "4px",
                        background: c.bg, color: c.text, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        {name}
                      </span>
                      <span style={{ fontSize: "11px", color: "#aaa", marginLeft: "8px" }}>{msToHMS(u.start)}</span>
                      <div style={{ marginTop: "4px", color: "#1a2744" }}>{u.text}</div>
                    </div>
                  );
                })
              : <p>{result.text ?? "No transcript returned."}</p>
            }
          </div>
        </div>
      )}
    </div>
  );
}

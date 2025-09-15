"use client";
import { useRef, useState } from "react";

type Mode = "chat" | "qa";

interface QAResponse {
  query: string;
  answer: string;
  context_used: { text: string; distance: number; keyword_score: number }[];
  latency_ms: number;
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("chat");
  const [q, setQ] = useState("");
  const [ans, setAns] = useState("");
  const [sources, setSources] = useState<QAResponse["context_used"]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const ask = async () => {
    setAns("");
    setSources([]);
    setError(null);
    setStreaming(true);

    try {
      if (mode === "chat") {
        const r = await fetch(`/api/chat?prompt=${encodeURIComponent(q)}`);
        const j = await r.json();
        setAns(j.reply ?? JSON.stringify(j, null, 2));
      } else {
        const r = await fetch(`/api/qa?query=${encodeURIComponent(q)}`);
        const j: QAResponse = await r.json();
        if (j.answer) setAns(j.answer);
        if (j.context_used) setSources(j.context_used);
      }
    } catch (err) {
      const e = err as Error;
      setError("❌ Error: " + e.message);
    } finally {
      setStreaming(false);
    }
  };

  const askStream = async () => {
    if (mode !== "chat") {
      setError("⚠️ Streaming is only supported for Chat mode right now.");
      return;
    }

    setAns("");
    setError(null);
    setStreaming(true);
    const r = await fetch(`/api/chat/stream?prompt=${encodeURIComponent(q)}`);
    const reader = r.body!.getReader();
    const dec = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      setAns(prev => prev + dec.decode(value, { stream: true }));
    }
    setStreaming(false);
  };

  return (
    <main style={{ maxWidth: 780, margin: "40px auto", fontFamily: "system-ui" }}>
      <h1>🤖 Hello AI</h1>

      {/* Mode Toggle */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <button
          onClick={() => setMode("chat")}
          style={{
            padding: "6px 12px",
            background: mode === "chat" ? "#2563eb" : "#333",
            color: "white",
            borderRadius: 6,
          }}
        >
          Chat
        </button>
        <button
          onClick={() => setMode("qa")}
          style={{
            padding: "6px 12px",
            background: mode === "qa" ? "#16a34a" : "#333",
            color: "white",
            borderRadius: 6,
          }}
        >
          Doc Q&A
        </button>
      </div>

      {/* Input */}
      <textarea
        ref={taRef}
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder={mode === "chat" ? "Ask anything…" : "Ask about your docs…"}
        rows={4}
        style={{ width: "100%", padding: 12 }}
      />

      {/* Buttons */}
      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
        <button onClick={ask} disabled={streaming}>
          {streaming ? "Thinking…" : mode === "chat" ? "Ask Chat" : "Ask Docs"}
        </button>
        <button onClick={askStream} disabled={streaming || mode !== "chat"}>
          {streaming ? "Streaming…" : "Stream Chat"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ marginTop: 16, color: "red" }}>
          {error}
        </div>
      )}

      {/* Answer */}
      {ans && (
        <section style={{ marginTop: 24, padding: 16, background: "#111", borderRadius: 8 }}>
          <h2 style={{ color: "#0f0", marginBottom: 8 }}>Answer</h2>
          <p style={{ color: "#fff", whiteSpace: "pre-wrap" }}>{ans}</p>
        </section>
      )}

      {/* Sources */}
      {sources.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2 style={{ marginBottom: 8 }}>📚 Sources</h2>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {sources.map((s, i) => (
              <li key={i} style={{ marginBottom: 12, padding: 12, background: "#222", borderRadius: 6 }}>
                <p style={{ color: "#ddd", margin: 0 }}>{s.text.slice(0, 200)}…</p>
                <small style={{ color: "#888" }}>
                  distance: {s.distance.toFixed(3)} | keyword: {s.keyword_score.toFixed(3)}
                </small>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

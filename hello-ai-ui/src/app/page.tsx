"use client";
import { useRef, useState } from "react";

type Mode = "chat" | "qa";

export default function Home() {
  const [mode, setMode] = useState<Mode>("chat");
  const [q, setQ] = useState("");
  const [ans, setAns] = useState("");
  const [streaming, setStreaming] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const ask = async () => {
    setAns("");
    setStreaming(true);

    try {
      if (mode === "chat") {
        const r = await fetch(`/api/chat?prompt=${encodeURIComponent(q)}`);
        const j = await r.json();
        setAns(j.reply ?? JSON.stringify(j, null, 2));
      } else {
        const r = await fetch(`/api/qa?query=${encodeURIComponent(q)}`);
        const j = await r.json();
        setAns(j.answer ?? JSON.stringify(j, null, 2));
      }
    } catch (err: any) {
      setAns("❌ Error: " + err.message);
    } finally {
      setStreaming(false);
    }
  };

  const askStream = async () => {
    if (mode !== "chat") {
      setAns("⚠️ Streaming is only supported for Chat mode right now.");
      return;
    }

    setAns("");
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
          {mode === "chat" ? "Ask Chat" : "Ask Docs"}
        </button>
        <button onClick={askStream} disabled={streaming || mode !== "chat"}>
          {streaming ? "Streaming…" : "Stream Chat"}
        </button>
      </div>

      {/* Output */}
      <pre
        style={{
          whiteSpace: "pre-wrap",
          background: "#111",
          color: "#0f0",
          padding: 12,
          marginTop: 16,
        }}
      >
        {ans || "—"}
      </pre>
    </main>
  );
}
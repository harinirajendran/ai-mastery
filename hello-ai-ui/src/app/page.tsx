// app/page.tsx
"use client";
import { useRef, useState } from "react";

export default function Home() {
  const [q, setQ] = useState("");
  const [ans, setAns] = useState("");
  const [streaming, setStreaming] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const ask = async () => {
    const r = await fetch(`/api/chat?prompt=${encodeURIComponent(q)}`);
    const j = await r.json();
    setAns(j.reply ?? JSON.stringify(j, null, 2));
  };

  const askStream = async () => {
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
      <h1>Hello AI</h1>
      <textarea
        ref={taRef}
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Ask something…"
        rows={4}
        style={{ width: "100%", padding: 12 }}
      />
      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
        <button onClick={ask}>Ask</button>
        <button onClick={askStream} disabled={streaming}>{streaming ? "Streaming..." : "Stream"}</button>
      </div>
      <pre style={{ whiteSpace: "pre-wrap", background: "#111", color: "#0f0", padding: 12, marginTop: 16 }}>
        {ans || "—"}
      </pre>
    </main>
  );
}
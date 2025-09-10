export const runtime = "edge";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const prompt = searchParams.get("prompt") || "";
  const backend = process.env.BACKEND_URL!;
  const upstream = await fetch(`${backend}/chat/stream?prompt=${encodeURIComponent(prompt)}`, {
    headers: { "Accept": "text/plain" },
  });
  // Pass-through the stream
  return new Response(upstream.body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
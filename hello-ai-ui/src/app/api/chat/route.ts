export const runtime = "edge"; // faster cold-start

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const prompt = searchParams.get("prompt") || "";
  const backend = process.env.BACKEND_URL!; // e.g., https://your-railway-url.up.railway.app
  const res = await fetch(`${backend}/api/chat?prompt=${encodeURIComponent(prompt)}`, {
    headers: { "Accept": "application/json" },
  });
  return new Response(await res.text(), { status: res.status, headers: { "Content-Type": "application/json" } });
}
export const runtime = "edge"; // faster cold-start

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query") || "";

  if (!query) {
    return new Response(
      JSON.stringify({ error: "Missing query param `query`" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const backend = process.env.BACKEND_URL!; // e.g. https://your-service.up.railway.app

  try {
    const res = await fetch(
      `${backend}/api/qa?query=${encodeURIComponent(query)}`,
      {
        headers: { Accept: "application/json" },
        cache: "no-store",
      }
    );

    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: "Failed to reach backend", detail: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

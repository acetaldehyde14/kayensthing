export default async () => new Response(JSON.stringify({ status: "ok" }), {
  headers: { "content-type": "application/json" },
});

export const config = { path: "/api/health" };

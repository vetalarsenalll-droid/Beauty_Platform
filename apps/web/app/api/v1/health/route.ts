export function GET() {
  return Response.json({
    status: "ok",
    service: "web",
    ts: new Date().toISOString(),
  });
}

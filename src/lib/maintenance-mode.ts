const MAINTENANCE_RETRY_AFTER_SECONDS = 60;

const MAINTENANCE_BYPASS_PREFIXES = [
  "/api/health",
  "/api/internal",
  "/api/webhooks",
] as const;

const MAINTENANCE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="robots" content="noindex,nofollow">
    <title>GreyhoundIQ maintenance</title>
    <style>
      :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; background: radial-gradient(circle at top, #25193d, #08050b 58%); color: #f6f1ff; }
      main { width: min(100%, 620px); padding: 36px; border: 1px solid rgba(190, 159, 255, .26); border-radius: 24px; background: rgba(18, 12, 28, .9); box-shadow: 0 28px 90px rgba(0, 0, 0, .42); }
      p { color: #c7bdd8; line-height: 1.65; }
      .eyebrow { color: #d3adff; font-size: 12px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
      h1 { margin: 12px 0 0; font-size: clamp(28px, 7vw, 48px); line-height: 1.05; }
      a { display: inline-flex; margin-top: 14px; min-height: 44px; align-items: center; padding: 0 18px; border: 1px solid #a986ed; border-radius: 10px; color: white; font-weight: 700; text-decoration: none; }
      small { display: block; margin-top: 22px; color: #8f849f; }
    </style>
  </head>
  <body>
    <main>
      <div class="eyebrow">Temporary maintenance</div>
      <h1>GreyhoundIQ will be back shortly.</h1>
      <p>We have paused the application while essential work is completed. Your account and data remain protected; please wait a minute before trying again.</p>
      <a href="/">Try GreyhoundIQ again</a>
      <small>If the interruption continues, contact support@greyhoundiq.com.au.</small>
    </main>
  </body>
</html>`;

export function isMaintenanceBypassPath(pathname: string) {
  return MAINTENANCE_BYPASS_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function maintenanceModeResponse(request: Request) {
  const acceptsHtml = request.headers.get("accept")?.includes("text/html");
  const isDocument =
    request.headers.get("sec-fetch-dest")?.toLowerCase() === "document";
  const renderHtml =
    (request.method === "GET" || request.method === "HEAD") &&
    (acceptsHtml || isDocument);
  const headers = {
    "Cache-Control": "no-store",
    "Retry-After": MAINTENANCE_RETRY_AFTER_SECONDS.toString(),
    "X-Robots-Tag": "noindex, nofollow",
    Vary: "Accept, Sec-Fetch-Dest",
  };

  if (renderHtml) {
    return new Response(request.method === "HEAD" ? null : MAINTENANCE_HTML, {
      status: 503,
      headers: { ...headers, "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return Response.json(
    {
      error: {
        code: "service.maintenance",
        message: "GreyhoundIQ is temporarily unavailable for maintenance",
      },
    },
    { status: 503, headers },
  );
}

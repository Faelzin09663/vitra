import type { Handler } from "./router.ts";
export type ReadFile = (url: URL) => Promise<Uint8Array>;
const types: Record<string, string> = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  ico: "image/x-icon",
  woff2: "font/woff2",
  txt: "text/plain; charset=utf-8",
  webmanifest: "application/manifest+json",
};
export function createStaticHandler(root: URL, read: ReadFile): Handler {
  return async (request) => {
    if (!["GET", "HEAD"].includes(request.method))
      return new Response(null, { status: 405 });
    let path: string;
    try {
      path = decodeURIComponent(new URL(request.url).pathname);
    } catch {
      return new Response(null, { status: 400 });
    }
    if (
      path.includes("\\") ||
      path.includes("\0") ||
      path.split("/").some((part) => part.startsWith("."))
    )
      return new Response(null, { status: 404 });
    const relative = path.replace(/^\/+/, "") || "index.html";
    // Encode every segment so ?, #, drive letters and percent signs remain filenames.
    let file = new URL(
      relative.split("/").map(encodeURIComponent).join("/"),
      root,
    );
    if (!file.href.startsWith(root.href))
      return new Response(null, { status: 404 });
    let bytes: Uint8Array;
    try {
      bytes = await read(file);
    } catch {
      if (relative.includes(".") || relative.startsWith("assets/"))
        return new Response(null, { status: 404 });
      file = new URL("index.html", root);
      try {
        bytes = await read(file);
      } catch {
        return new Response("Execute npm run build para gerar o app.", {
          status: 503,
        });
      }
    }
    const ext = file.pathname.split(".").at(-1)!;
    const headers = {
      "Content-Type": types[ext] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Cache-Control": ext === "html" ? "no-cache" : "public, max-age=3600",
    };
    return new Response(
      request.method === "HEAD" ? null : (bytes as BodyInit),
      { headers },
    );
  };
}

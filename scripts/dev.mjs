import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
import { loadEnv } from "vite";

const root = new URL("../", import.meta.url);
const cwd = fileURLToPath(root);
const config = loadEnv("development", cwd, ["ALLOWED_ORIGINS"]);
async function available(port) {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", (error) =>
      error.code === "EADDRINUSE"
        ? resolve(false)
        : reject(new Error("Não foi possível reservar a porta do app.")),
    );
    probe.listen(port, "0.0.0.0", () => probe.close(() => resolve(true)));
  });
}
let webPort = 5173;
while (!(await available(webPort))) {
  if (++webPort > 5193) throw new Error("Portas de desenvolvimento ocupadas.");
}
const allowedOrigins = [
  ...new Set([
    ...(config.ALLOWED_ORIGINS || "").split(",").filter(Boolean),
    `http://localhost:${webPort}`,
    `http://127.0.0.1:${webPort}`,
  ]),
].join(",");
const denoPath = fileURLToPath(
  new URL(
    `node_modules/deno/${process.platform === "win32" ? "deno.exe" : "deno"}`,
    root,
  ),
);
const api = spawn(
  denoPath,
  [
    "run",
    "--watch=server,supabase/functions,src/lib,src/data",
    "--env-file=.env",
    "--allow-env",
    "--allow-net",
    "--allow-read=dist",
    "server/main.ts",
  ],
  {
    cwd,
    env: { ...process.env, ALLOWED_ORIGINS: allowedOrigins },
    stdio: "inherit",
    windowsHide: true,
  },
);
const web = spawn(
  process.execPath,
  [
    fileURLToPath(new URL("node_modules/vite/bin/vite.js", root)),
    "--host",
    "0.0.0.0",
    "--port",
    String(webPort),
    "--strictPort",
  ],
  { cwd, stdio: "inherit", windowsHide: true },
);
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  api.kill();
  web.kill();
  if (process.connected) process.disconnect();
  process.exitCode = code;
}
for (const child of [api, web]) {
  child.on("error", () => {
    console.error(
      "Não foi possível iniciar o ambiente. Execute npm ci e confira o .env.",
    );
    stop(1);
  });
  child.on("exit", (code) => stop(code ?? 1));
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
// Allows local smoke checks to close both children on Windows without killing the parent first.
process.on("message", (message) => {
  if (message === "shutdown") stop();
});

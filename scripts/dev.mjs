import { spawn } from "node:child_process";
const api = spawn(process.execPath, ["server/index.mjs"], {
  stdio: "inherit",
  env: { ...process.env, API_PORT: process.env.API_PORT || "3001" },
});
const vite = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", ...process.argv.slice(2)],
  { stdio: "inherit" },
);
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  api.kill();
  vite.kill();
  process.exitCode = code;
}
api.on("exit", (code) => stop(code ?? 0));
vite.on("exit", (code) => stop(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop());

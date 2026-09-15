import { spawn } from "node:child_process";

export interface ShellResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export function sh(
  cmd: string,
  cwd: string,
  opts: { timeoutMs?: number } = {},
): Promise<ShellResult> {
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn("bash", ["-lc", cmd], {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    const timer = setTimeout(
      () => child.kill("SIGKILL"),
      opts.timeoutMs ?? 15 * 60_000,
    );

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
        durationMs: Date.now() - started,
      });
    });
  });
}

export const tail = (s: string, n = 40) =>
  s.trimEnd().split("\n").slice(-n).join("\n");

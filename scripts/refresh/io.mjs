import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const HTTPS_HOSTS = new Set(["data.seoul.go.kr", "datafile.seoul.go.kr"]);
const MAX_RUN_BYTES = 2_500_000_000;
const MAX_REQUESTS = 300;
export function permittedUrl(value) {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    !(url.protocol === "https:" && HTTPS_HOSTS.has(url.hostname) && !url.port)
  )
    throw new Error(
      "Network destination is not an approved public Seoul source",
    );
  return url;
}
/** Anonymous official data only. Never receives GitHub, browser or service credentials. */
export function createFetcher({ timeoutMs = 120000, attempts = 3 } = {}) {
  const stats = { requests: 0, bytes: 0, retries: 0 };
  async function fetchBytes(value, options = {}) {
    const initial = permittedUrl(value);
    const limit = options.maxBytes ?? 128 * 1024 * 1024;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 256 * 1024 * 1024)
      throw new Error("Invalid response size limit");
    const headers = new Headers(options.headers);
    if (headers.has("authorization") || headers.has("cookie"))
      throw new Error(
        "Credentials are not accepted by the public-data collector",
      );
    headers.set(
      "user-agent",
      "AMO-Official-Data-Refresh/1.0 (+https://github.com/Cybecho/airbnb-market-observer)",
    );
    headers.set("referer", "https://data.seoul.go.kr/");
    for (let attempt = 0; attempt < attempts; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        let url = initial,
          method = options.method ?? "GET",
          body = options.body;
        let response;
        for (let redirect = 0; redirect < 4; redirect++) {
          if (++stats.requests > MAX_REQUESTS)
            throw new Error("Run request budget exceeded");
          response = await fetch(url, {
            method,
            body,
            headers,
            redirect: "manual",
            signal: controller.signal,
          });
          if (![301, 302, 303, 307, 308].includes(response.status)) break;
          const location = response.headers.get("location");
          await response.body?.cancel();
          if (!location || redirect === 3)
            throw new Error("Unexpected source redirect");
          url = permittedUrl(new URL(location, url).href);
          if (response.status === 303) {
            method = "GET";
            body = undefined;
          }
        }
        if (!response.ok) {
          await response.body?.cancel();
          const failure = new Error(`Official source HTTP ${response.status}`);
          failure.retryable = response.status === 429 || response.status >= 500;
          throw failure;
        }
        const declared = Number(response.headers.get("content-length") ?? 0);
        if (declared > limit) {
          await response.body?.cancel();
          throw new Error("Official source response exceeds size limit");
        }
        const chunks = [];
        let length = 0;
        for await (const chunk of response.body) {
          length += chunk.length;
          stats.bytes += chunk.length;
          if (length > limit || stats.bytes > MAX_RUN_BYTES) {
            controller.abort();
            throw new Error("Public download size budget exceeded");
          }
          chunks.push(chunk);
        }
        return {
          bytes: Buffer.concat(chunks, length),
          headers: response.headers,
        };
      } catch (error) {
        const retry =
          error.name === "AbortError" ||
          error.name === "TypeError" ||
          error.retryable === true;
        if (!retry || attempt === attempts - 1)
          throw new Error(
            `Public source request failed (${initial.hostname}): ${error.name === "AbortError" ? "timeout" : error.name === "TypeError" ? "network error" : error.message}`,
          );
        stats.retries++;
        await delay(2000 * 2 ** attempt);
      } finally {
        clearTimeout(timer);
      }
    }
    throw new Error("Public source request exhausted retries");
  }
  return { fetchBytes, stats };
}

/** Strict native CP949 conversion; ICU's EUC-KR coverage is not assumed to equal Windows CP949. */
export async function decodeCp949(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length > 128 * 1024 * 1024)
    throw new Error("Invalid CP949 input buffer");
  return new Promise((resolve, reject) => {
    const child = spawn("iconv", ["-f", "CP949", "-t", "UTF-8"], {
      stdio: ["pipe", "pipe", "ignore"],
    });
    const chunks = [];
    let size = 0;
    let failure = null;
    const timer = setTimeout(() => {
      failure = new Error("CP949 conversion timed out");
      child.kill("SIGKILL");
    }, 30000);
    child.on("error", () => {
      clearTimeout(timer);
      reject(
        new Error(
          "Strict CP949 converter unavailable; Linux libc-bin is required",
        ),
      );
    });
    child.stdin.on("error", () => {
      failure = new Error("CP949 input was rejected");
    });
    child.stdout.on("data", (chunk) => {
      size += chunk.length;
      if (size > bytes.length * 4 + 1024) {
        failure = new Error("CP949 decoded size exceeds limit");
        child.kill("SIGKILL");
        return;
      }
      chunks.push(chunk);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (failure || code !== 0)
        return reject(
          failure ??
            new Error(
              "Invalid CP949 byte sequence; no characters were discarded",
            ),
        );
      try {
        resolve(
          new TextDecoder("utf-8", { fatal: true }).decode(
            Buffer.concat(chunks, size),
          ),
        );
      } catch {
        reject(new Error("CP949 converter returned invalid UTF-8"));
      }
    });
    child.stdin.end(bytes);
  });
}

// Operational misuse guard, not cryptographic host attestation.
export function assertGitHubHostedLinux(
  env = process.env,
  platform = process.platform,
) {
  if (
    env.GITHUB_ACTIONS !== "true" ||
    env.RUNNER_ENVIRONMENT !== "github-hosted" ||
    platform !== "linux"
  ) {
    throw new Error(
      "Official refresh requires a GitHub-hosted Linux runner. Do not run locally or on a self-hosted runner.",
    );
  }
}

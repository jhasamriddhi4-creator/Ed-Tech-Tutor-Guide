import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const serverDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function getFreePort() {
  const server = net.createServer();
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const port = server.address().port;
  await new Promise((resolveClose, reject) => {
    server.close((error) => error ? reject(error) : resolveClose());
  });
  return port;
}

const wait = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms));

async function startApiServer({ port, databasePath, authSecret }) {
  const child = spawn(process.execPath, ["src/index.js"], {
    cwd: serverDirectory,
    env: {
      ...process.env,
      PORT: String(port),
      AUTH_SECRET: authSecret,
      AI_GURU_DB_PATH: databasePath,
      NODE_ENV: "test",
      FRONTEND_ORIGINS: "https://app.example.test",
      GEMINI_API_KEY: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let logs = "";
  child.stdout.on("data", (chunk) => { logs += chunk.toString(); });
  child.stderr.on("data", (chunk) => { logs += chunk.toString(); });
  const baseUrl = `http://127.0.0.1:${port}`;

  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`AI Guru API exited before becoming healthy. Logs:\n${logs}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return { child, baseUrl, getLogs: () => logs };
    } catch {
      // The API may not have bound its port yet.
    }
    await wait(100);
  }

  child.kill();
  throw new Error(`AI Guru API did not become healthy in time. Logs:\n${logs}`);
}

async function stopApiServer(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((resolveExit) => {
    const timeout = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    }, 3000);
    timeout.unref();
    child.once("exit", () => {
      clearTimeout(timeout);
      resolveExit();
    });
    child.kill("SIGTERM");
  });
}

async function readJson(response) {
  const body = await response.json();
  return body;
}

test("API smoke: health, auth, protected access, CORS, saved-library persistence", {
  timeout: 30000,
}, async (t) => {
  const temporaryDirectory = await mkdtemp(resolve(tmpdir(), "ai-guru-smoke-"));
  const databasePath = resolve(temporaryDirectory, "smoke.sqlite");
  const authSecret = "test-only-secret-at-least-32-characters-long";
  const port = await getFreePort();
  let server = await startApiServer({ port, databasePath, authSecret });
  t.after(async () => {
    await stopApiServer(server.child);
    await rm(temporaryDirectory, { recursive: true, force: true });
  });

  const healthResponse = await fetch(`${server.baseUrl}/api/health`);
  assert.equal(healthResponse.status, 200);
  const health = await readJson(healthResponse);
  assert.equal(health.success, true);
  assert.equal(health.service, "AI Guru API");
  assert.equal(health.apiKeyConfigured, false);

  const allowedCors = await fetch(`${server.baseUrl}/api/health`, {
    method: "OPTIONS",
    headers: {
      Origin: "https://app.example.test",
      "Access-Control-Request-Method": "GET",
    },
  });
  assert.equal(allowedCors.headers.get("access-control-allow-origin"), "https://app.example.test");
  assert.equal(allowedCors.headers.get("access-control-allow-credentials"), "true");

  const deniedCors = await fetch(`${server.baseUrl}/api/health`, {
    method: "OPTIONS",
    headers: {
      Origin: "https://untrusted.example.test",
      "Access-Control-Request-Method": "GET",
    },
  });
  assert.equal(deniedCors.headers.get("access-control-allow-origin"), null);

  const unauthorizedAi = await fetch(`${server.baseUrl}/api/ai/tutor`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: "Explain binary search." }),
  });
  assert.equal(unauthorizedAi.status, 401);

  const invalidRegistration = await fetch(`${server.baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "not-an-email", password: "short" }),
  });
  assert.equal(invalidRegistration.status, 400);

  const email = `smoke-${Date.now()}@example.test`;
  const password = "test-password-for-smoke";
  const registration = await fetch(`${server.baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(registration.status, 201);
  const registrationBody = await readJson(registration);
  const user = registrationBody.result;
  assert.ok(user?.id);
  const cookieHeader = registration.headers.get("set-cookie");
  assert.ok(cookieHeader?.includes("HttpOnly"));
  const cookie = cookieHeader.split(";")[0];

  const duplicateRegistration = await fetch(`${server.baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(duplicateRegistration.status, 409);

  const wrongPasswordLogin = await fetch(`${server.baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "definitely-wrong-password" }),
  });
  assert.equal(wrongPasswordLogin.status, 401);

  const currentAccount = await fetch(`${server.baseUrl}/api/auth/me`, {
    headers: { Cookie: cookie },
  });
  assert.equal(currentAccount.status, 200);
  assert.equal((await readJson(currentAccount)).result.email, email);

  const savedItem = await fetch(`${server.baseUrl}/api/students/${user.id}/saves`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({
      title: "Integration smoke item",
      type: "rag",
      content: "Saved study material should persist across backend restarts.",
    }),
  });
  assert.equal(savedItem.status, 201);

  const otherUserData = await fetch(`${server.baseUrl}/api/students/other_user_123456`, {
    headers: { Cookie: cookie },
  });
  assert.equal(otherUserData.status, 403);

  const studentData = await fetch(`${server.baseUrl}/api/students/${user.id}`, {
    headers: { Cookie: cookie },
  });
  assert.equal(studentData.status, 200);
  const studentBody = await readJson(studentData);
  assert.equal(studentBody.result.savedItems.length, 1);
  assert.equal(studentBody.result.savedItems[0].content, "Saved study material should persist across backend restarts.");

  await stopApiServer(server.child);
  server = await startApiServer({ port, databasePath, authSecret });

  const accountAfterRestart = await fetch(`${server.baseUrl}/api/auth/me`, {
    headers: { Cookie: cookie },
  });
  assert.equal(accountAfterRestart.status, 200);

  const studentAfterRestart = await fetch(`${server.baseUrl}/api/students/${user.id}`, {
    headers: { Cookie: cookie },
  });
  assert.equal(studentAfterRestart.status, 200);
  const afterRestartBody = await readJson(studentAfterRestart);
  assert.equal(afterRestartBody.result.savedItems.length, 1);
  assert.equal(afterRestartBody.result.savedItems[0].title, "Integration smoke item");

  const logout = await fetch(`${server.baseUrl}/api/auth/logout`, { method: "POST" });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get("set-cookie") || "", /Max-Age=0/);
  const signedOut = await fetch(`${server.baseUrl}/api/auth/me`);
  assert.equal(signedOut.status, 401);
});

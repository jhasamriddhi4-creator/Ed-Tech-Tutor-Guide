import { Router } from "express";
import {
  createHmac,
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import {
  createStudentAccount,
  findStudentAccountByEmail,
  findStudentAccountById,
} from "../services/studentStore.js";

const router = Router();
const scrypt = promisify(scryptCallback);
const COOKIE_NAME = "ai_guru_session";
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

function authSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("Configure AUTH_SECRET with at least 32 random characters.");
  }
  return secret;
}

async function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const derived = await scrypt(password, salt, 64);
  return `${salt}:${Buffer.from(derived).toString("hex")}`;
}

async function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(":");
  if (!salt || !hash) return false;
  const actual = Buffer.from(await hashPassword(password, salt).then((v) => v.split(":")[1]), "hex");
  const expected = Buffer.from(hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function signSession(userId) {
  const payload = Buffer.from(JSON.stringify({
    sub: userId,
    exp: Date.now() + SESSION_MS,
  })).toString("base64url");
  const signature = createHmac("sha256", authSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifySession(token) {
  if (!token || typeof token !== "string") return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", authSecret()).update(payload).digest();
  let supplied;
  try {
    supplied = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.sub || !Number.isFinite(data.exp) || data.exp <= Date.now()) return null;
    return data.sub;
  } catch {
    return null;
  }
}

function getCookie(req, name) {
  const prefix = `${name}=`;
  const item = String(req.headers.cookie || "").split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : null;
}

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${Math.floor(SESSION_MS / 1000)}${secure}`);
}

export function requireAuth(req, res, next) {
  try {
    const userId = verifySession(getCookie(req, COOKIE_NAME));
    if (!userId) {
      return res.status(401).json({ success: false, message: "Please sign in to continue." });
    }
    req.user = { id: userId };
    return next();
  } catch (error) {
    console.error("Session verification failed:", error);
    return res.status(500).json({ success: false, message: "Unable to verify your session." });
  }
}

router.post("/register", async (req, res) => {
  try {
    authSecret();
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const legacyStudentId = typeof req.body?.legacyStudentId === "string" ? req.body.legacyStudentId : null;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return res.status(400).json({ success: false, message: "Enter a valid email address." });
    }
    if (password.length < 10 || password.length > 128) {
      return res.status(400).json({ success: false, message: "Password must be 10–128 characters long." });
    }

    const passwordHash = await hashPassword(password);
    const user = createStudentAccount(randomUUID(), email, passwordHash, legacyStudentId);
    setSessionCookie(res, signSession(user.id));
    return res.status(201).json({ success: true, result: { id: user.id, email: user.email } });
  } catch (error) {
    if (String(error?.code || "").includes("SQLITE_CONSTRAINT_UNIQUE")) {
      return res.status(409).json({ success: false, message: "An account with this email already exists. Please sign in." });
    }
    console.error("Account registration failed:", error);
    return res.status(500).json({ success: false, message: "Could not create the account. Check the server configuration." });
  }
});

router.post("/login", async (req, res) => {
  try {
    authSecret();
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const user = findStudentAccountByEmail(email);
    const valid = user && await verifyPassword(password, user.passwordHash);

    if (!valid) {
      return res.status(401).json({ success: false, message: "Email or password is incorrect." });
    }

    setSessionCookie(res, signSession(user.id));
    return res.json({ success: true, result: { id: user.id, email: user.email } });
  } catch (error) {
    console.error("Account login failed:", error);
    return res.status(500).json({ success: false, message: "Could not sign in. Check the server configuration." });
  }
});

router.get("/me", requireAuth, (req, res) => {
  const user = findStudentAccountById(req.user.id);
  if (!user) {
    return res.status(401).json({ success: false, message: "Your account was not found. Please sign in again." });
  }
  return res.json({ success: true, result: { id: user.id, email: user.email } });
});

router.post("/logout", (_req, res) => {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`);
  return res.json({ success: true, result: { loggedOut: true } });
});

export default router;

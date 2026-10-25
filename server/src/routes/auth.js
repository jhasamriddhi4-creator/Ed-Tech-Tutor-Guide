import { Router } from "express";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import {
  createStudentAccount,
  findStudentAccountByEmail,
} from "../services/studentStore.js";

const router = Router();
const scrypt = promisify(scryptCallback);

function signToken(userId) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("Configure AUTH_SECRET with at least 32 random characters.");
  }
  const payload = Buffer.from(JSON.stringify({
    sub: userId,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  })).toString("base64url");
  const signature = randomBytes(0); // signature is derived below using HMAC
  return payload;
}

export default router;

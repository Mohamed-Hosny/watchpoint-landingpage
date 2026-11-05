/* ==========================================================================
   Watch Point Admin — authentication
   Password is stored as a scrypt hash; sessions live in memory.
   ========================================================================== */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DATA_DIR } from "./store.mjs";

const AUTH_FILE = path.join(DATA_DIR, "auth.json");
const SESSION_COOKIE = "wp_admin";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const sessions = new Map();

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function isConfigured() {
  return fs.existsSync(AUTH_FILE);
}

export function setPassword(password) {
  ensureDataDir();
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  fs.writeFileSync(
    AUTH_FILE,
    JSON.stringify({ salt, hash, updatedAt: new Date().toISOString() }, null, 2),
    "utf8"
  );
}

export function verifyPassword(password) {
  if (!isConfigured()) return false;
  try {
    const stored = JSON.parse(fs.readFileSync(AUTH_FILE, "utf8"));
    const expected = Buffer.from(stored.hash, "hex");
    const actual = crypto.scryptSync(password, stored.salt, expected.length);
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function createSession() {
  const token = crypto.randomBytes(32).toString("hex");
  const csrf = crypto.randomBytes(16).toString("hex");
  sessions.set(token, { csrf, expires: Date.now() + SESSION_TTL_MS });
  return { token, csrf };
}

export function parseCookies(req) {
  const header = req.headers.cookie || "";
  const result = {};
  header.split(";").forEach((part) => {
    const index = part.indexOf("=");
    if (index === -1) return;
    result[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  });
  return result;
}

export function getSession(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expires < Date.now()) {
    sessions.delete(token);
    return null;
  }
  session.expires = Date.now() + SESSION_TTL_MS;
  return { token, ...session };
}

export function destroySession(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) sessions.delete(token);
}

export function sessionCookie(token) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(
    SESSION_TTL_MS / 1000
  )}`;
}

export function clearCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

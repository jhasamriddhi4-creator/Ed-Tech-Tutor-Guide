import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const serviceDir = dirname(fileURLToPath(import.meta.url));
const defaultDbPath = resolve(serviceDir, "../../data/ai-guru.sqlite");
const dbPath = resolve(process.env.AI_GURU_DB_PATH || defaultDbPath);

mkdirSync(dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS student_profiles (
    student_id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS saved_items (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (student_id) REFERENCES student_profiles(student_id)
      ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_saved_items_student_date
    ON saved_items(student_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS quiz_attempts (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    topic TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    score INTEGER NOT NULL,
    total INTEGER NOT NULL,
    accuracy INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (student_id) REFERENCES student_profiles(student_id)
      ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_quiz_attempts_student_date
    ON quiz_attempts(student_id, created_at DESC);
`);

const validStudentId = /^[A-Za-z0-9_-]{8,100}$/;

export function isValidStudentId(value) {
  return typeof value === "string" && validStudentId.test(value);
}

function requireStudentId(value) {
  if (!isValidStudentId(value)) {
    throw new Error("A valid student ID is required.");
  }

  return value;
}

function ensureStudent(studentId) {
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO student_profiles (student_id, created_at)
     VALUES (?, ?)
     ON CONFLICT(student_id) DO NOTHING`
  ).run(studentId, now);
}

export function getStudentData(studentId) {
  requireStudentId(studentId);
  ensureStudent(studentId);

  const savedItems = db.prepare(
    `SELECT id, title, type, content, created_at AS createdAt
     FROM saved_items
     WHERE student_id = ?
     ORDER BY created_at DESC`
  ).all(studentId);

  const quizAttempts = db.prepare(
    `SELECT id, topic, difficulty, score, total, accuracy,
            created_at AS createdAt
     FROM quiz_attempts
     WHERE student_id = ?
     ORDER BY created_at DESC`
  ).all(studentId);

  return { savedItems, quizAttempts };
}

export function saveLearningItem(studentId, item) {
  requireStudentId(studentId);
  ensureStudent(studentId);

  const saved = {
    id: crypto.randomUUID(),
    studentId,
    title: item.title,
    type: item.type,
    content: item.content,
    createdAt: new Date().toISOString(),
  };

  db.prepare(
    `INSERT INTO saved_items
      (id, student_id, title, type, content, created_at)
     VALUES (@id, @studentId, @title, @type, @content, @createdAt)`
  ).run(saved);

  const { studentId: _studentId, ...publicItem } = saved;
  return publicItem;
}

export function deleteLearningItem(studentId, itemId) {
  requireStudentId(studentId);
  ensureStudent(studentId);

  const result = db.prepare(
    "DELETE FROM saved_items WHERE id = ? AND student_id = ?"
  ).run(itemId, studentId);

  return result.changes > 0;
}

export function recordQuizAttempt(studentId, attempt) {
  requireStudentId(studentId);
  ensureStudent(studentId);

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const accuracy = Math.round((attempt.score / attempt.total) * 100);

  db.prepare(
    `INSERT INTO quiz_attempts
      (id, student_id, topic, difficulty, score, total, accuracy, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    studentId,
    attempt.topic,
    attempt.difficulty,
    attempt.score,
    attempt.total,
    accuracy,
    createdAt
  );

  return { id, ...attempt, accuracy, createdAt };
}

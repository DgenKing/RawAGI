// ============================================
// DATABASE - Research history via bun:sqlite
// ============================================

import { Database } from "bun:sqlite";

const db = new Database("research.db");

db.run(`CREATE TABLE IF NOT EXISTS research (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL,
  answer TEXT NOT NULL,
  credibility TEXT DEFAULT 'medium',
  sources TEXT DEFAULT '',
  timestamp TEXT DEFAULT (datetime('now'))
)`);

// Migration: add columns if upgrading from older schema
try { db.run("ALTER TABLE research ADD COLUMN credibility TEXT DEFAULT 'medium'"); } catch {}
try { db.run("ALTER TABLE research ADD COLUMN sources TEXT DEFAULT ''"); } catch {}

export function saveResearch(query: string, answer: string, credibility: string = "medium", sources: string = "") {
  db.run("INSERT INTO research (query, answer, credibility, sources) VALUES (?, ?, ?, ?)", [query, answer, credibility, sources]);
}

export function searchHistory(keyword: string): string {
  const rows = db.query(
    "SELECT query, answer, credibility, sources, timestamp FROM research WHERE query LIKE ?1 OR answer LIKE ?1 ORDER BY timestamp DESC LIMIT 5"
  ).all(`%${keyword}%`) as { query: string; answer: string; credibility: string; sources: string; timestamp: string }[];

  if (rows.length === 0) return "No matching research found.";

  return rows.map((r, i) =>
    `[${i + 1}] ${r.timestamp} [credibility: ${r.credibility}]\nQ: ${r.query}\nA: ${r.answer.slice(0, 300)}${r.answer.length > 300 ? "..." : ""}${r.sources ? `\nSources: ${r.sources}` : ""}`
  ).join("\n\n");
}

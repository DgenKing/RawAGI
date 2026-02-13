// ============================================
// DATABASE - Research history via bun:sqlite
// ============================================

import { Database } from "bun:sqlite";

const db = new Database("research.db");

db.run(`CREATE TABLE IF NOT EXISTS research (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL,
  answer TEXT NOT NULL,
  timestamp TEXT DEFAULT (datetime('now'))
)`);

export function saveResearch(query: string, answer: string) {
  db.run("INSERT INTO research (query, answer) VALUES (?, ?)", [query, answer]);
}

export function searchHistory(keyword: string): string {
  const rows = db.query(
    "SELECT query, answer, timestamp FROM research WHERE query LIKE ?1 OR answer LIKE ?1 ORDER BY timestamp DESC LIMIT 5"
  ).all(`%${keyword}%`) as { query: string; answer: string; timestamp: string }[];

  if (rows.length === 0) return "No matching research found.";

  return rows.map((r, i) =>
    `[${i + 1}] ${r.timestamp}\nQ: ${r.query}\nA: ${r.answer.slice(0, 300)}${r.answer.length > 300 ? "..." : ""}`
  ).join("\n\n");
}

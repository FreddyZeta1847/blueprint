/*
 * PostToolUse hook — File-watcher for Blueprint deterministic checks and housekeeping
 *
 * Fires on every tool write to vault files, running:
 * - Deterministic checks (vocabulary/conflict/value-inversion) on atoms.json writes
 * - Append-only mirror of _current-task.md lock events into _full-context.md
 * - Sync-check and orphan-check on various file writes
 * - Compilation of _index/decisions.json from individual atoms.json files
 * - Auto-generated report/audit file entries for atoms.json changes and blocked writes
 *
 * Built in Phase 8 (Review).
 *
 * References: vault-blueprint/features/DECISION-ATOMS/DECISION-ATOMS.md (exact dispatch table).
 */

// Placeholder — built in Phase 8 (Review)
console.error('file-watcher.js: Phase 8 (Review) not yet built');

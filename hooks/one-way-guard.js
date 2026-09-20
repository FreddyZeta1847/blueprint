/*
 * PreToolUse hook — One-way guard for agent-approved atoms in agent-assist mode
 *
 * Fires before tool use, blocking write attempts to atoms tagged:
 * reversibility: one-way AND status: agent-approved
 *
 * Guarantees user confirmation before any one-way decision is made autonomously.
 * Built in Phase 10 (User-Agent).
 *
 * References: vault-blueprint/features/USER-AGENT/USER-AGENT.md, features/DECISION-ATOMS/DECISION-ATOMS.md.
 */

// Placeholder — built in Phase 10 (User-Agent)
console.error('one-way-guard.js: Phase 10 (User-Agent) not yet built');

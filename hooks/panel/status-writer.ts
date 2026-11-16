/*
 * Status writer — in a child session (a linked worktree of a repository with a Blueprint
 * plan) writes <main>/blueprint/sessions/<worktree>.json, schema v1, at most every 2 s.
 * Registered once from the entry; it decides at session.start whether this session writes.
 * PLACEHOLDER written by the mother: the child «vista-sessioni» replaces this body (Task B1).
 */
export function registerStatusWriter(_on: any): void {}

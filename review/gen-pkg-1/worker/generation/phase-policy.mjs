// gen-pkg-1 round 2 — the AUTHORITATIVE phase→book registry
// (Rowan round-2 source review, comment 6511950562, R2-1).
//
// Round 1 (B1) made the phase a plan rides server authority, but
// derived a book's binding from HISTORY — the phase of the plans
// earlier callers had already admitted. Rowan's round-2 finding:
// for an unbound book, first use still originates with the
// caller, not with an independent server book policy; two books
// could each mint plans over one phase's budget envelope, and a
// book could be run once unbudgeted, then again under the phase.
// This module is the independent policy: SERVER STATE in the
// coordinator's own store, one row per budgeted phase naming the
// ONE book authorized to ride it, consulted by admission BEFORE
// any plan or ledger state moves.
//
// ESTABLISHMENT IS THE SWITCH — with one round-3 hardening
// (R3-1, Rowan round-3 review, comment 6512804398). While the
// registry is empty, a NON-enforcement construction applies the
// legacy round-1 history rules — the explicit legacy/service-
// fixture behavior Rowan sanctioned preserving (the existing D6
// suites stage two books under one phase inside registry-free
// fixture databases, and they keep doing so, untouched). An
// ENFORCEMENT-BOUND construction (the production entry under its
// deployment configuration — service.mjs phasePolicyMode) never
// applies the legacy rules: the registry rules below govern from
// the first served request, and while the registry is still
// empty every budgeted-phase claim fails closed (phase_unbound)
// until the operator records the binding. There is no exposure
// window between Worker deployment and binding recording. The
// moment ANY binding is recorded, the registry is the COMPLETE
// authority for every budgeted phase, on every submission path,
// in every construction:
//   * a bound book's phase is DERIVED from its registry row —
//     a missing phase is rejected (phase_required) and any
//     different phase is rejected (phase_mismatch);
//   * a book with no registry row cannot claim a budgeted phase
//     at all — a phase bound to another book is rejected
//     (phase_bound_to_other_book), and a budgeted phase with no
//     recorded book is rejected (phase_unbound, fail-closed);
//   * an invented (non-budgeted) phase string is rejected
//     (phase_not_budgeted), exactly as in round 1;
//   * no phase at all still runs unbudgeted (phase null).
// There is NO input field that selects the legacy rules: callers
// cannot opt out, because the mode is read from server state,
// never from the submission.
//
// THE WRITER. recordPhaseBinding (exposed on the service as
// bindPhaseBook) is the only writer. Recording a binding is a
// gated operator act, in the same class as the storage seed:
// since round 3 the pinned production entry wires exactly ONE
// surface to it — the operator-only POST /v2/d6-phase-binding
// route (migration-operator credential alone, the
// skipClientToken operator class; the internal route requires
// the entry's operator-admitted stamp; no client path exists) —
// and this build records NOTHING in production: no binding has
// been recorded anywhere outside test fixtures. The gen-pkg-1
// deploy gate records the production pair — phase
// "forever-pucked" ↔ book 5c589095-f812-48a2-8ab2-03ba2791f2b2 —
// through that route under Julie's deploy authorization, BEFORE
// the client build is published; because the deployed Worker is
// enforcement-bound, admission fails closed on budgeted claims
// from its first request until that recording lands, so the
// sequence has no bypass window. A phase must enter the budget
// registry (PHASE_BUDGET_MICRO_CENTS) and this binding registry
// together.
//
// The table follows the binding-projection pattern (round 0):
// its DDL lives HERE, not in GEN_SCHEMA — the correction suites
// pin the bootstrap's table set — and is ensured lazily. DDL
// only, idempotent, no reads at bootstrap, no `.one()` hazard.
import { PHASE_BUDGET_MICRO_CENTS } from "./gen-constants.mjs";

const PHASE_BINDING_SCHEMA = `
CREATE TABLE IF NOT EXISTS d6_phase_bindings (
  phase TEXT PRIMARY KEY, book_id TEXT NOT NULL, source TEXT,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
`;

// DDL-only idempotent bootstrap (the proven throw-safe pattern).
export function ensurePhaseBindingSchema(coord) {
  coord.sql.exec(PHASE_BINDING_SCHEMA);
}

// The binding row for one phase, or null.
export function phaseBindingFor(coord, phase) {
  ensurePhaseBindingSchema(coord);
  if (phase == null) return null;
  return coord._oneOrNull(
    `SELECT * FROM d6_phase_bindings WHERE phase = ?`, phase);
}

// The binding row naming one book (a book owns at most one
// budgeted phase in this registry's shape), or null.
export function phaseBindingForBook(coord, bookId) {
  ensurePhaseBindingSchema(coord);
  if (bookId == null) return null;
  return coord._oneOrNull(
    `SELECT * FROM d6_phase_bindings WHERE book_id = ?
      ORDER BY phase LIMIT 1`, bookId);
}

// True once ANY binding has been recorded: the registry is
// established and admission derives from it alone.
export function phaseRegistryEstablished(coord) {
  ensurePhaseBindingSchema(coord);
  return coord._one(
    `SELECT COUNT(*) AS n FROM d6_phase_bindings`).n > 0;
}

// recordPhaseBinding(coord, { phase, bookId, source }) — the
// ONLY writer of the registry. Insert-if-absent:
//   * the same (phase, book) pair re-recorded is an idempotent
//     no-op ({ changed: false, idempotent: true });
//   * a phase already bound to a DIFFERENT book throws
//     phase_binding_conflict and the recorded binding stands —
//     a rebind is a new gated decision, never a silent
//     overwrite;
//   * a phase outside the budget registry throws
//     phase_not_budgeted (an invented phase can never acquire a
//     binding); a malformed phase/bookId throws
//     phase_binding_shape.
export function recordPhaseBinding(coord, { phase, bookId, source = null } = {}) {
  ensurePhaseBindingSchema(coord);
  if (typeof phase !== "string" || phase.length === 0 ||
      typeof bookId !== "string" || bookId.length === 0)
    throw new Error("phase_binding_shape: phase and bookId must be non-empty strings");
  if (!Object.hasOwn(PHASE_BUDGET_MICRO_CENTS, phase))
    throw new Error(`phase_not_budgeted: ${phase}`);
  const existing = phaseBindingFor(coord, phase);
  if (existing) {
    if (existing.book_id === bookId)
      return { phase, bookId, changed: false, idempotent: true };
    throw new Error(
      `phase_binding_conflict: ${phase} is bound to a different book`);
  }
  const t = coord._now();
  coord.sql.exec(
    `INSERT INTO d6_phase_bindings (phase, book_id, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`, phase, bookId, source ?? null, t, t);
  return { phase, bookId, changed: true, idempotent: false };
}

// D4 runner — driver (D4 proposal §3B; Option D transport,
// design §3.4).
//
// Sequences one book's plan (chunks → positions carry → jobs
// carry) against an INJECTED transport. Under the Option D
// two-phase protocol each command travels as TWO single-header
// calls: the client channel submits (the command pends inert
// under a server-computed hash) and the operator channel
// approves that exact hash before anything executes:
//
//   transport = {
//     submitCommand(command) -> pendingView,  // client channel
//     approveCommand({ commandId, payloadSha256 }) -> stateView,
//                                             // operator channel
//     readView(bookId)     -> view,      // migrationBookView
//     getReceipt(commandId)-> receipt|null,
//   }
//
// The driver holds no credentials, no base URL, and no target:
// production use wires a transport over the two connectors at
// run time — a separate, Julie-gated step (the operator channel
// decision, D4 proposal §5). The test suite exercises this
// driver ONLY against the local harness transport.
//
// Discipline (§3B), enforced here rather than by convention:
//   - deterministic command ids (from the builder): re-driving a
//     book after a transient failure re-issues the SAME ids, and
//     the coordinator's stored receipts settle every step —
//     no double-apply, no duplicate audit, no extra GETs;
//   - a digestPending chunk is never sent (fail closed);
//   - an approval is issued ONLY against the hash the SUBMIT
//     returned (the server-computed payload hash, obtained
//     through the client channel — never through chat or logs);
//   - a state view that is not final (pending / processing /
//     needs_reconciliation) is NEVER treated as an outcome: the
//     stored receipt under the same id settles the step, and a
//     needs_reconciliation view halts the book as a STOP;
//   - a durable rejection halts the book immediately. There is
//     no retry loop and no repair logic in this driver, ever;
//   - the flip gate is a separate entry point, callable only
//     with the certificate from the F7 acceptance read-back.

// Drive ONE command through submit → approve and settle its
// final receipt. Transport failures (either leg) resolve from
// the stored receipt under the SAME deterministic id — never by
// resending blindly.
async function driveCommand(cmd, transport) {
  let receipt = null;
  try {
    const pending = await transport.submitCommand(cmd);
    if (!pending || pending.state !== "pending_operator" ||
        typeof pending.payloadSha256 !== "string")
      return { receipt: pending || null,
               haltReason: (pending && pending.reason) || "submit_not_pending" };
    const approved = await transport.approveCommand({
      commandId: cmd.command_id, payloadSha256: pending.payloadSha256 });
    if (approved && (approved.state === "applied" || approved.state === "refused" ||
                     approved.state === "expired"))
      receipt = approved;
  } catch (err) {
    receipt = null; // settled from the stored receipt below
    var transportError = err;
  }
  if (!receipt) {
    const stored = transport.getReceipt
      ? await transport.getReceipt(cmd.command_id) : null;
    if (!stored)
      return { receipt: null, haltReason: "transport_error_unresolved",
               error: transportError ? String(transportError && transportError.message || transportError) : undefined };
    if (stored.state === "needs_reconciliation")
      return { receipt: stored, haltReason: "needs_reconciliation" };
    if (stored.state && stored.state !== "applied" && stored.state !== "refused" &&
        stored.state !== "expired")
      return { receipt: stored, haltReason: "transport_error_unresolved" };
    receipt = stored;
  }
  return { receipt };
}

export async function runBookMigration({ plan, transport }) {
  const log = [];
  for (const cmd of plan.commands) {
    if (cmd.type === "MigrateImportChunk" &&
        (cmd.payload.rows || []).some((r) => !r.manifest || !r.manifest.sha256))
      return { ok: false, haltedAt: cmd.command_id, reason: "digest_pending", log };
    if (cmd.type === "MigrateImportChunk" && cmd.pendingAttestation)
      return { ok: false, haltedAt: cmd.command_id, reason: "attestation_pending", log };
    const { receipt, haltReason, error } = await driveCommand(cmd, transport);
    if (!receipt)
      return { ok: false, haltedAt: cmd.command_id, reason: haltReason, error, log };
    log.push({ commandId: cmd.command_id, type: cmd.type,
               outcome: receipt.outcome, reason: receipt.reason || null });
    if (haltReason)
      return { ok: false, haltedAt: cmd.command_id, reason: haltReason, receipt, log };
    if (receipt.outcome !== "applied")
      return { ok: false, haltedAt: cmd.command_id,
               reason: receipt.reason || "not_applied", receipt, log };
  }
  const view = await transport.readView(plan.bookId);
  return { ok: true, log, view };
}

// F8, separately: send the flip-gate command built by
// buildGateCommand (certificate from the F7 acceptance). The
// coordinator's gate is itself fail-closed (G4 completeness +
// the B1 carry invariant); this wrapper adds nothing but the
// two-phase transport calls and the read-back.
export async function runFlipGate({ gateCommand, transport }) {
  const { receipt, haltReason, error } = await driveCommand(gateCommand, transport);
  const view = await transport.readView(gateCommand.payload.bookId);
  return { receipt, haltReason: haltReason || null, error, view };
}

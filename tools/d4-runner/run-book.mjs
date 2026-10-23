// D4 runner — driver (D4 proposal §3B).
//
// Sequences one book's plan (chunks → positions carry → jobs
// carry) against an INJECTED transport:
//
//   transport = {
//     sendCommand(command) -> receipt,   // one command, durable
//     readView(bookId)     -> view,      // migrationBookView
//     getReceipt(commandId)-> receipt|null,
//   }
//
// The driver holds no credentials, no base URL, and no target:
// production use wires a transport over the operator connector
// at run time — a separate, Julie-gated step (the operator
// channel decision, D4 proposal §5). The test suite exercises
// this driver ONLY against the local harness transport.
//
// Discipline (§3B), enforced here rather than by convention:
//   - deterministic command ids (from the builder): re-driving a
//     book after a transient failure re-issues the SAME ids, and
//     the coordinator's stored receipts settle every step —
//     no double-apply, no duplicate audit, no extra GETs;
//   - a digestPending chunk is never sent (fail closed);
//   - a durable rejection halts the book immediately. There is
//     no retry loop and no repair logic in this driver, ever;
//   - the flip gate is a separate entry point, callable only
//     with the certificate from the F7 acceptance read-back.
export async function runBookMigration({ plan, transport }) {
  const log = [];
  for (const cmd of plan.commands) {
    if (cmd.type === "MigrateImportChunk" &&
        (cmd.payload.rows || []).some((r) => !r.manifest || !r.manifest.sha256))
      return { ok: false, haltedAt: cmd.command_id, reason: "digest_pending", log };
    if (cmd.type === "MigrateImportChunk" && cmd.pendingAttestation)
      return { ok: false, haltedAt: cmd.command_id, reason: "attestation_pending", log };
    let receipt;
    try {
      receipt = await transport.sendCommand(cmd);
    } catch (err) {
      // Ambiguous transport failure: the command may or may not
      // have landed. Settle it from the stored receipt under the
      // SAME deterministic id — never by resending blindly.
      const stored = transport.getReceipt
        ? await transport.getReceipt(cmd.command_id) : null;
      if (!stored)
        return { ok: false, haltedAt: cmd.command_id,
                 reason: "transport_error_unresolved",
                 error: String(err && err.message || err), log };
      receipt = stored;
    }
    log.push({ commandId: cmd.command_id, type: cmd.type,
               outcome: receipt.outcome, reason: receipt.reason || null });
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
// transport call and the read-back.
export async function runFlipGate({ gateCommand, transport }) {
  const receipt = await transport.sendCommand(gateCommand);
  const view = await transport.readView(gateCommand.payload.bookId);
  return { receipt, view };
}

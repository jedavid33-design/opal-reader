// Candidate-owned lifecycle clock (follow-up correction 3, R1
// containment). The frozen Shelf bridge takes its timers from an
// injected clock seam; the composition routes that seam through this
// wrapper so the candidate — not the bridge — owns the lifecycle of
// every bridge timer (checkpoint interval, pause-grace timer, armed
// flush timer):
//
// - Every timer the bridge schedules is registered here.
// - close() cancels ALL registered timers and makes the clock inert:
//   timers scheduled after close never fire. This is what stops
//   bridge background work on a controlled release or on ownership
//   loss (owner.onLost), so no NEW flush / session-end can start
//   after the candidate has let go.
// - close() cannot reach a bridge operation that is ALREADY in
//   flight (a flush past its last storage commit when ownership is
//   lost); that residual interleaving is characterized in the
//   follow-up report — it is not hidden here.
//
// The wrapper mirrors the bridge clock interface exactly
// ({ now, setTimeout, clearTimeout, setInterval, clearInterval })
// over any base clock with the same shape (real timers by default).
export function createLifecycleClock(baseClock) {
  const base = baseClock ?? {
    now: () => Date.now(),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id),
    setInterval: (fn, ms) => setInterval(fn, ms),
    clearInterval: (id) => clearInterval(id),
  };
  let closed = false;
  let inertSeq = 0;
  const live = new Map(); // wrapperId -> { kind, baseId }
  function schedule(kind, fn, ms) {
    if (closed) return `inert-${++inertSeq}`; // never fires; clear* is a no-op
    const id = `${kind}-${++inertSeq}`;
    const wrapped = () => {
      if (kind === "timeout") live.delete(id);
      if (closed) return;
      fn();
    };
    const baseId = kind === "timeout" ? base.setTimeout(wrapped, ms) : base.setInterval(wrapped, ms);
    live.set(id, { kind, baseId });
    return id;
  }
  function cancel(id) {
    const rec = live.get(id);
    if (!rec) return;
    live.delete(id);
    if (rec.kind === "timeout") base.clearTimeout(rec.baseId); else base.clearInterval(rec.baseId);
  }
  return {
    now: () => base.now(),
    setTimeout: (fn, ms) => schedule("timeout", fn, ms),
    clearTimeout: (id) => cancel(id),
    setInterval: (fn, ms) => schedule("interval", fn, ms),
    clearInterval: (id) => cancel(id),
    get closed() { return closed; },
    pendingCount: () => live.size,
    close() {
      if (closed) return;
      closed = true;
      for (const id of [...live.keys()]) cancel(id);
    },
  };
}

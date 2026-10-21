// P4 reference sync client (test harness only — the real client
// state layer is P5). A device keeps per-family cursors and an
// entity mirror; it reconciles ONLY from receipts and pulled
// changes, exactly as the protocol contracts require.
export class SyncClient {
  constructor(coord, deviceId) {
    this.coord = coord;
    this.deviceId = deviceId;
    this.seqs = { content: 0, bindings: 0, position: 0, settings: 0 };
    this.mirror = { content: new Map(), bindings: new Map(), settings: null };
    this.revisions = new Map();
    this.bookTips = new Map();   // bookId -> last position receiptSeq seen
    this.localSeqs = new Map();  // bookId -> last localSeq used
    this.cmdCounter = 0;
  }

  _cmdId(tag) { return `${this.deviceId}-${tag}-${++this.cmdCounter}`; }

  async push(changes, { dropAck = false, commandId } = {}) {
    const id = commandId || this._cmdId("push");
    const r = await this.coord.handleCommand({
      command_id: id, type: "SyncPush",
      payload: { deviceId: this.deviceId, changes } });
    if (dropAck) return { dropped: true, command_id: id };
    for (const o of r.outcomes || [])
      if (o.status === "applied") this.revisions.set(o.entityKey, o.revision);
    return r;
  }

  async pushBook(bookId, data, baseRevision) {
    return this.push([{ family: "content", entityKey: bookId, bookId,
      baseRevision: baseRevision ?? this.revisions.get(bookId) ?? 0,
      op: "upsert", payload: data }]);
  }

  async deleteBook(bookId) {
    return this.coord.handleCommand({
      command_id: this._cmdId("del"), type: "DeleteBook",
      payload: { bookId, baseRevision: this.revisions.get(bookId) ?? 0 } });
  }

  async pull(family) {
    let cursor;
    const all = [];
    for (;;) {
      const page = this.coord.pullChanges(
        { family, sinceSeq: this.seqs[family], cursor });
      if (page.resyncRequired) {
        const snap = this.coord.syncSnapshot({ family });
        this._applySnapshot(family, snap);
        this.seqs[family] = snap.watermark;
        return { resynced: true, changes: all };
      }
      if (page.error) return page;
      for (const c of page.changes) { this._applyChange(family, c); all.push(c); }
      this.seqs[family] = page.nextSeq;
      cursor = page.cursor;
      if (!page.hasMore) break;
    }
    return { changes: all };
  }

  async pullAll() {
    for (const f of ["content", "bindings", "settings", "position"]) await this.pull(f);
  }

  _applyChange(family, c) {
    if (family === "content" || family === "bindings") {
      if (c.op === "tombstone") this.mirror[family].delete(c.entityKey);
      else this.mirror[family].set(c.entityKey, c.payload);
      this.revisions.set(c.entityKey, c.revision);
    } else if (family === "settings") {
      this.mirror.settings = c.payload;
      this.revisions.set("settings", c.revision);
    } else if (family === "position") {
      const tip = this.bookTips.get(c.bookId) || 0;
      if (c.payload && c.payload.receiptSeq > tip)
        this.bookTips.set(c.bookId, c.payload.receiptSeq);
    }
  }

  _applySnapshot(family, snap) {
    if (family === "content" || family === "bindings") {
      this.mirror[family].clear();
      for (const e of snap.entities) {
        if (!e.tombstone) this.mirror[family].set(e.entityKey, e.data);
        this.revisions.set(e.entityKey, e.revision);
      }
    } else if (family === "settings") {
      const s = snap.entities.find(e => e.entityKey === "settings");
      this.mirror.settings = s ? s.data : null;
      if (s) this.revisions.set("settings", s.revision);
    }
  }

  // One position event from this device. baseSeq is the journal tip
  // this device has seen for the book (its causal base).
  async position(bookId, ev, { commandId } = {}) {
    const ls = (this.localSeqs.get(bookId) || 0) + 1;
    this.localSeqs.set(bookId, ls);
    const event = { eventId: `${this.deviceId}:${ls}`, deviceId: this.deviceId,
      localSeq: ls, baseSeq: this.bookTips.get(bookId) || 0, ...ev };
    const r = await this.coord.handleCommand({
      command_id: commandId || this._cmdId("pos"), type: "PushPositionEvents",
      payload: { deviceId: this.deviceId, bookId, events: [event] } });
    const o = (r.outcomes || [])[0];
    if (o && (o.status === "accepted" || o.status === "replay"))
      this.bookTips.set(bookId, o.receiptSeq);
    return { receipt: r, event };
  }
}

// Design 3.2 minimal screens as pure UI models (DOM rendering in a real
// publish would bind these verbatim; models keep labels truthful --
// "Uncertain" is never relabelled ready, unbound reads "not generated --
// generation is not part of this client").
export const SCREENS = ["access","library","book","player","findText","settings","diagnostics"];
export function accessScreenModel(){ return { screen:"access", serviceLine:"Opal Reader v2 -- production library", fieldLabel:"Production access token", fieldType:"password", connectLabel:"Connect", editableWorkerUrl:false }; }
export function libraryRowModel(book, chapterCount, counts, canonical){ return { title:book.title??null, author:book.author??null, chapterCount, bound:counts?.bound??0, unbound:counts?.unbound??0, resume: canonical?{occurrenceId:canonical.occurrenceId, offsetSec:canonical.offsetSec}:null, controls:[] }; }
export function chapterRowModel(model){ return { label:model.label, text:model.text, counts:model.counts }; }
export function playerModel({ state, token, offsetSec }){ return { state, coordinate: token?{occurrenceId:token.occurrenceId, offsetSec}:null,
  unboundText:"not generated -- generation is not part of this client",
  states:["loading","playing","waiting","stalled","paused","error"] }; }
export function settingsModelView(settings, quota){ return { readOnly:true, settings:settings?.data??null, revision:settings?.revision??0, quota:quota??null }; }

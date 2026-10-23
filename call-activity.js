/* EAGLE RS · Smart Call Activity helpers, no network access or provider scraping. */
(function(root, factory) {
  const exported = factory();
  if (typeof module === 'object' && module.exports) module.exports = exported;
  else root.EagleCallActivity = Object.freeze(exported);
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const outcomes = Object.freeze(['missed','incoming','answered','declined','outgoing','ended']);
  function suggest(text) {
    const normalized = String(text || '').replace(/\s+/g, ' ').trim().slice(0,1000);
    if (!normalized) return {outcome:null, kind:null, confidence:'none', message:'Paste a call notice first.'};
    const missed = /\bmissed\s+(?:(?:voice|video|audio|incoming)\s+)?call\b|\bcall\s+missed\b/i;
    const declined = /\b(?:declined|rejected)\s+(?:the\s+)?call\b/i;
    const incoming = /\b(?:incoming|ringing)\s+(?:(?:voice|video|audio)\s+)?call\b/i;
    const outgoing = /\b(?:outgoing|dialing|dialling)\s+(?:(?:voice|video|audio)\s+)?call\b/i;
    const answered = /\b(?:answered|accepted|connected)\s+(?:the\s+)?call\b/i;
    const ended = /\b(?:call\s+ended|ended\s+(?:the\s+)?call)\b/i;
    const outcome = missed.test(normalized) ? 'missed' : declined.test(normalized) ? 'declined' : incoming.test(normalized) ? 'incoming' : outgoing.test(normalized) ? 'outgoing' : answered.test(normalized) ? 'answered' : ended.test(normalized) ? 'ended' : null;
    const kind = /\bvideo\s+call\b/i.test(normalized) ? 'video' : /\b(?:voice|audio)\s+call\b/i.test(normalized) ? 'voice' : null;
    return {outcome,kind,confidence:outcome?'suggested':'unknown',message:outcome ? 'Suggested from text you pasted. Confirm the account, caller and outcome before saving; this is not an automatic provider call event.' : 'No recognizable call event. Please choose the call status manually.'};
  }
  function advance(call, next, at) {
    if (!call || !outcomes.includes(next)) throw new Error('Invalid call outcome');
    const time = Number.isFinite(at) && at > 0 ? at : Date.now();
    const updated = {...call, outcome:next, updatedAt:time};
    if (next === 'answered') updated.answeredAt = time;
    if (['missed','declined','ended'].includes(next)) updated.endedAt = time;
    return updated;
  }
  function summary(c) {
    const outcome = outcomes.includes(c?.outcome) ? c.outcome : 'missed';
    return ({missed:'Missed',incoming:'Ringing / incoming',answered:'Answered',declined:'Declined',outgoing:'Outgoing',ended:'Call ended'})[outcome];
  }
  function elapsed(c) {
    const end = Number(c?.endedAt), start = Number(c?.answeredAt);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start<=0 || end<start) return '';
    const s = Math.floor((end-start)/1000);
    return `${Math.floor(s/60)}m ${s%60}s`;
  }
  return {suggest,advance,summary,elapsed,outcomes};
});

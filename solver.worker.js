/* eslint-disable no-restricted-globals */

importScripts("./solver.js");

function ok(id, result) {
  postMessage({ id, ok: true, result });
}
function fail(id, e) {
  postMessage({ id, ok: false, error: e && e.message ? e.message : String(e) });
}

self.onmessage = (ev) => {
  const msg = ev && ev.data;
  if (!msg || !msg.id || !msg.method) return;

  try {
    const solver = self.PuzzleSolver;
    if (!solver) throw new Error("PuzzleSolver not found in worker (solver.js not loaded?)");
    const fn = solver[msg.method];
    if (typeof fn !== "function") throw new Error("Unknown method: " + msg.method);

    const args = Array.isArray(msg.args) ? msg.args : [];
    ok(msg.id, fn.apply(null, args));
  } catch (e) {
    fail(msg.id, e);
  }
};
// Time log (9 Oct 2026): created 11:39 PM by Claude Code (copied from Expresso) · last changed 11:39 PM
// Feature spec: one frame -> 142 numbers. Must match ml/features.py exactly.
export const T = 32;
export const POSE_IDS = [0, 11, 12, 13, 14, 15, 16];
export const F = POSE_IDS.length * 2 + 2 * 21 * 3 + 2; // 142
export type P = { x: number; y: number; z: number };

export function frameFeatures(pose: P[] | undefined, hands: P[][], W: number, H: number): Float32Array | null {
  if (!pose) return null;
  const lsx = pose[11].x * W, lsy = pose[11].y * H;
  const rsx = pose[12].x * W, rsy = pose[12].y * H;
  const cx = (lsx + rsx) / 2, cy = (lsy + rsy) / 2;
  const s = Math.hypot(lsx - rsx, lsy - rsy);
  if (s < 1e-3) return null;
  const out: number[] = [];
  for (const i of POSE_IDS) out.push((pose[i].x * W - cx) / s, (pose[i].y * H - cy) / s);
  const hs = hands.slice(0, 2).sort((a, b) => a[0].x - b[0].x);
  const slots: (P[] | null)[] = [null, null];
  if (hs.length === 2) { slots[0] = hs[0]; slots[1] = hs[1]; }
  else if (hs.length === 1) slots[hs[0][0].x * W < cx ? 0 : 1] = hs[0];
  const flags: number[] = [];
  for (const h of slots) {
    if (!h) { for (let k = 0; k < 63; k++) out.push(0); flags.push(0); }
    else { for (const p of h) out.push((p.x * W - cx) / s, (p.y * H - cy) / s, (p.z * W) / s); flags.push(1); }
  }
  return new Float32Array([...out, ...flags]);
}

export function resample(seq: Float32Array[], t = T): Float32Array {
  const n = seq.length, res = new Float32Array(t * F);
  for (let k = 0; k < t; k++) {
    const src = n === 1 ? 0 : (k * (n - 1)) / (t - 1);
    const lo = Math.floor(src), hi = Math.min(lo + 1, n - 1), w = src - lo;
    for (let f = 0; f < F; f++) res[k * F + f] = seq[lo][f] * (1 - w) + seq[hi][f] * w;
  }
  return res;
}

// Slot A wrist y is index 15, slot B wrist y is index 78; flags at 140, 141
export const isActive = (f: Float32Array) => (f[140] > 0 && f[15] < 1.5) || (f[141] > 0 && f[78] < 1.5);

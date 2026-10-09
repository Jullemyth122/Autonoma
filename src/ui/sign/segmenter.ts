// Time log (9 Oct 2026): created 11:39 PM by Claude Code (copied from Expresso) · last changed 11:39 PM
import { isActive } from './features.ts';

// A sign ends when hands drop for gapMs, or hold still for stillMs.
// The sentence ends when no hands are active for sentenceMs.
// gapMs 400 (guide: 250) tolerates brief tracking dropouts; stillMs 700 (guide: 400) keeps two-part
// signs like GOOD MORNING whole. Dropping your hands between signs is always the clearest separator.
export const O = { gapMs: 400, stillMs: 700, minSignMs: 400, sentenceMs: 1200, still: 0.02, maxFrames: 120 };
export type SegmenterOptions = Partial<typeof O>;

export function motion(a: Float32Array, b: Float32Array) {
  let s = 0, n = 0;
  for (let i = 14; i < 140; i++) if (a[i] !== 0 && b[i] !== 0) { s += Math.abs(a[i] - b[i]); n++; }
  return n ? s / n : 1;
}

export class Segmenter {
  private buf: Float32Array[] = [];
  private prev: Float32Array | null = null;
  private startedAt = 0; private stillSince = 0; private lastActive = 0;
  private hadWord = false; private waitMove = false;

  private o: typeof O;

  constructor(private onSign: (frames: Float32Array[]) => void, private onSentenceEnd: () => void, opts: SegmenterOptions = {}) {
    this.o = { ...O, ...opts };
  }

  private activeNow = false;

  get recording() { return this.buf.length > 0; }

  // When the sentence-end countdown started (hands down after at least one word), else null
  get waitingSince(): number | null {
    return this.hadWord && !this.activeNow && !this.buf.length ? this.lastActive : null;
  }

  setOptions(opts: SegmenterOptions) { this.o = { ...this.o, ...opts }; }

  // Forget the current sentence (after "Speak now" or "Clear words")
  reset() { this.buf = []; this.hadWord = false; this.prev = null; this.waitMove = false; }

  push(f: Float32Array | null, t: number) {
    this.activeNow = !!f && isActive(f);
    if (f && isActive(f)) {
      const m = this.prev ? motion(this.prev, f) : 1;
      this.prev = f; this.lastActive = t;
      if (this.waitMove) { if (m <= this.o.still) return; this.waitMove = false; }
      if (!this.buf.length) { this.startedAt = t; this.stillSince = t; }
      if (m > this.o.still) this.stillSince = t;
      this.buf.push(f);
      const held = t - this.startedAt > this.o.minSignMs && t - this.stillSince > this.o.stillMs;
      if (held || this.buf.length >= this.o.maxFrames) { this.flush(); this.waitMove = true; }
    } else {
      if (this.buf.length && t - this.lastActive > this.o.gapMs) this.flush();
      this.waitMove = false; this.prev = null;
      if (this.hadWord && t - this.lastActive > this.o.sentenceMs) { this.hadWord = false; this.onSentenceEnd(); }
    }
  }

  private flush() {
    if (this.buf.length >= 4) { this.onSign(this.buf); this.hadWord = true; }
    this.buf = [];
  }
}

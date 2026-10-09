// Time log (9 Oct 2026): created 11:40 PM by Claude Code · last changed 11:54 PM
// Sign recognition off the main thread: camera frames in → MediaPipe hand + pose landmarks → cut into signs → your trained model.
// The model is trained in Expresso (../Expresso) and exported to public/sign; Autonoma only recognises.
import { FilesetResolver, HandLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision';
import * as ort from 'onnxruntime-web';
import { F, POSE_IDS, T, frameFeatures, isActive, resample } from './features.ts';
import { Segmenter, type SegmenterOptions } from './segmenter.ts';

export type SignIn =
  | { type: 'load'; base: string; camera: boolean; options: SegmenterOptions }
  | { type: 'frame'; bitmap: ImageBitmap; t: number }
  | { type: 'options'; options: SegmenterOptions }
  | { type: 'classify'; id: number; x: number[] };
export type Guess = { label: string; prob: number; top3: { label: string; prob: number }[] };
export type SignOut =
  | { type: 'ready'; labels: string[]; delegate: string }
  | { type: 'error'; error: string }
  | { type: 'frame'; pose: number[]; hands: number[][]; active: boolean; capturing: boolean }
  | ({ type: 'sign'; frames: number } & Guess)
  | ({ type: 'classified'; id: number } & Guess);

const post = (message: SignOut) => postMessage(message);
let session: ort.InferenceSession | null = null;
let labels: string[] = [];
let hand: HandLandmarker | null = null, pose: PoseLandmarker | null = null;
let segmenter: Segmenter | null = null;
let lastT = -1;

async function classify(x: Float32Array): Promise<Guess> {
  const out = await session!.run({ x: new ort.Tensor('float32', x, [1, T, F]) });
  const z = out.logits.data as Float32Array;
  const max = Math.max(...z);
  const e = Array.from(z, value => Math.exp(value - max));
  const sum = e.reduce((a, b) => a + b, 0);
  const ranked = e.map((value, index) => ({ label: labels[index], prob: value / sum })).sort((a, b) => b.prob - a.prob);
  return { label: ranked[0].label, prob: ranked[0].prob, top3: ranked.slice(0, 3) };
}

async function load(base: string, camera: boolean, options: SegmenterOptions) {
  const response = await fetch(`${base}sign/labels.json`).catch(() => null);
  if (!response?.ok) throw new Error('No sign model yet. Train your signs in Expresso, press Export, then reload Autonoma.');
  labels = await response.json();
  // The same WebAssembly runtime the speech model uses (dist/ort), so nothing extra ships.
  ort.env.wasm.wasmPaths = `${base}ort/`;
  ort.env.wasm.numThreads = 1;
  session = await ort.InferenceSession.create(`${base}sign/fsl.onnx`, { executionProviders: ['wasm'] });
  if (!camera) return post({ type: 'ready', labels, delegate: 'none' });

  const vision = await FilesetResolver.forVisionTasks(`${base}mediapipe/wasm`, true);
  // GPU is faster, but some laptops fail to start it, so fall back to the CPU. MediaPipe clears
  // self.ModuleFactory after creating each task, and a module worker can't re-run the
  // (cached) loader module, so keep the factory and put it back before every task.
  const factory = (await import(/* @vite-ignore */ vision.wasmLoaderPath)).default;
  const scope = self as unknown as { ModuleFactory?: unknown };
  const withFallback = async <T,>(make: (delegate: 'GPU' | 'CPU') => Promise<T>): Promise<[T, string]> => {
    try { scope.ModuleFactory = factory; return [await make('GPU'), 'GPU']; }
    catch { scope.ModuleFactory = factory; return [await make('CPU'), 'CPU']; }
  };
  const [handTask, delegate] = await withFallback(use => HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: `${base}mediapipe/hand_landmarker.task`, delegate: use },
    runningMode: 'VIDEO', numHands: 2,
    // Same as Expresso: lower thresholds keep hold of fast, slightly blurred hands.
    minHandDetectionConfidence: 0.3, minHandPresenceConfidence: 0.3, minTrackingConfidence: 0.3,
  }));
  const [poseTask] = await withFallback(use => PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: `${base}mediapipe/pose_landmarker_lite.task`, delegate: use },
    runningMode: 'VIDEO', numPoses: 1,
  }));
  hand = handTask; pose = poseTask;
  segmenter = new Segmenter(frames => {
    void classify(resample(frames)).then(guess => post({ type: 'sign', frames: frames.length, ...guess }));
  }, () => {}, options);
  post({ type: 'ready', labels, delegate });
}

function frame(bitmap: ImageBitmap, t: number) {
  if (!hand || !pose || !segmenter || t <= lastT) { bitmap.close(); return post({ type: 'frame', pose: [], hands: [], active: false, capturing: false }); }
  lastT = t;
  const h = hand.detectForVideo(bitmap, t), p = pose.detectForVideo(bitmap, t);
  const features = frameFeatures(p.landmarks[0], h.landmarks, bitmap.width, bitmap.height);
  bitmap.close();
  segmenter.push(features, t);
  const body = p.landmarks[0];
  post({
    type: 'frame',
    pose: body ? POSE_IDS.flatMap(index => [body[index].x, body[index].y]) : [],
    hands: h.landmarks.map(points => points.flatMap(point => [point.x, point.y])),
    active: !!features && isActive(features), capturing: segmenter.recording,
  });
}

onmessage = async ({ data }: MessageEvent<SignIn>) => {
  try {
    if (data.type === 'load') await load(data.base, data.camera, data.options);
    else if (data.type === 'frame') frame(data.bitmap, data.t);
    else if (data.type === 'options') segmenter?.setOptions(data.options);
    else if (data.type === 'classify') post({ type: 'classified', id: data.id, ...(await classify(Float32Array.from(data.x))) });
  } catch (caught) {
    if (data.type === 'frame') data.bitmap.close?.();
    post({ type: 'error', error: caught instanceof Error ? caught.message : String(caught) });
  }
};

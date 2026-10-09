// Time log (9 Oct 2026): created 11:41 PM by Claude Code · last changed 1:24 AM, 10 Oct
// Sign mode in the side panel: owns the camera, sends frames to the sign worker one at a time (never a backlog),
// draws the tracked skeleton, and hands each confident sign to the panel. Turning it off frees the camera and the worker.
import { useEffect, useRef, useState } from 'react';
import type { Guess, SignIn, SignOut } from './sign.worker.ts';

export type SignState = 'off' | 'starting' | 'ready' | 'blocked' | 'error';
export interface SignGuess extends Guess { accepted: boolean; at: number }
export class CameraBlockedError extends Error {}

const FRAME_WIDTH = 640; // MediaPipe shrinks frames to ~256 px anyway; smaller bitmaps are cheaper to copy
const HAND_LINKS = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];
// Pose points arrive as POSE_IDS order: nose, shoulders, elbows, wrists.
const POSE_LINKS = [[1, 2], [1, 3], [3, 5], [2, 4], [4, 6]];

export const newSignWorker = () => new Worker(new URL('./sign.worker.ts', import.meta.url), { type: 'module' });

/** Camera permission is granted from the options page: the side panel can't show Chrome's prompt. */
export async function requestCamera(): Promise<boolean> {
  try { (await navigator.mediaDevices.getUserMedia({ video: true })).getTracks().forEach(track => track.stop()); return true; }
  catch { return false; }
}

export function useSign(enabled: boolean, options: { threshold: number; stillMs: number; paused: boolean }, onSign: (label: string, guess: SignGuess) => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<SignState>('off');
  const [error, setError] = useState('');
  const [labels, setLabels] = useState<string[]>([]);
  const [guess, setGuess] = useState<SignGuess | null>(null);
  const [live, setLive] = useState({ active: false, capturing: false, fps: 0, delegate: '' });
  const settings = useRef(options);
  settings.current = options;
  const callback = useRef(onSign);
  callback.current = onSign;
  const worker = useRef<Worker | null>(null);

  useEffect(() => {
    if (!enabled) { setState('off'); setGuess(null); return; }
    let stopped = false, ready = false, stream: MediaStream | null = null, busy = false, frames = 0, fpsAt = performance.now(), videoCallback = 0, shown = '';
    const sign = newSignWorker();
    worker.current = sign;
    setState('starting'); setError('');
    const send = (message: SignIn, transfer: Transferable[] = []) => sign.postMessage(message, transfer);

    sign.onmessage = ({ data }: MessageEvent<SignOut>) => {
      if (stopped) return;
      if (data.type === 'ready') { ready = true; setLabels(data.labels); setLive(value => ({ ...value, delegate: data.delegate })); setState('ready'); return void pump(); }
      if (data.type === 'error') {
        busy = false;
        if (!ready) { setError(data.error); setState('error'); } // after start-up, one bad frame is just skipped
        return;
      }
      if (data.type === 'frame') {
        busy = false; frames++;
        draw(data.pose, data.hands, data.active);
        const now = performance.now();
        const { active, capturing } = data;
        if (now - fpsAt > 1000) { const fps = Math.round((frames * 1000) / (now - fpsAt)); setLive(value => ({ ...value, fps })); frames = 0; fpsAt = now; }
        // Re-render only when the hands go up or down, or a sign starts or ends.
        if (`${active}${capturing}` !== shown) { shown = `${active}${capturing}`; setLive(value => ({ ...value, active, capturing })); }
        return;
      }
      if (data.type === 'sign') {
        const accepted = data.label !== '_none' && data.prob >= settings.current.threshold;
        const next = { label: data.label, prob: data.prob, top3: data.top3, accepted, at: Date.now() };
        setGuess(next);
        if (accepted) callback.current(data.label, next);
      }
    };

    function draw(pose: number[], hands: number[][], active: boolean) {
      const canvas = canvasRef.current, video = videoRef.current;
      if (!canvas || !video) return;
      if (canvas.width !== video.videoWidth) { canvas.width = video.videoWidth; canvas.height = video.videoHeight; }
      const context = canvas.getContext('2d')!, w = canvas.width, h = canvas.height;
      context.clearRect(0, 0, w, h);
      context.lineWidth = Math.max(2, w / 220);
      const line = (points: number[], links: number[][], color: string) => {
        context.strokeStyle = color; context.beginPath();
        for (const [a, b] of links) { context.moveTo(points[a * 2] * w, points[a * 2 + 1] * h); context.lineTo(points[b * 2] * w, points[b * 2 + 1] * h); }
        context.stroke();
      };
      if (pose.length) line(pose, POSE_LINKS, 'rgba(120, 200, 255, .9)');
      for (const points of hands) line(points, HAND_LINKS, active ? '#4ade80' : 'rgba(255, 255, 255, .7)');
    }

    // One frame in flight at a time: if the worker is still busy, this camera frame is simply skipped.
    let lastSent = 0, watchdog = 0;
    function grab(video: HTMLVideoElement) {
      if (busy || settings.current.paused || !video.videoWidth) return;
      busy = true; lastSent = performance.now();
      const height = Math.round((FRAME_WIDTH * video.videoHeight) / video.videoWidth);
      createImageBitmap(video, { resizeWidth: FRAME_WIDTH, resizeHeight: height, resizeQuality: 'low' })
        .then(bitmap => stopped ? bitmap.close() : send({ type: 'frame', bitmap, t: performance.now() }, [bitmap]))
        .catch(() => { busy = false; });
    }
    function pump() {
      const video = videoRef.current;
      if (stopped || !video) return;
      videoCallback = video.requestVideoFrameCallback(() => { grab(video); pump(); });
      // Frame callbacks can stop when the preview is hidden; then a timer keeps frames coming (~15 fps).
      watchdog ||= window.setInterval(() => { if (performance.now() - lastSent > 120) grab(video); }, 66);
    }

    void (async () => {
      try {
        try { stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 960 }, height: { ideal: 540 }, frameRate: { ideal: 30 } }, audio: false }); }
        catch (caught) { throw caught instanceof DOMException && caught.name === 'NotAllowedError' ? new CameraBlockedError('Camera blocked') : caught; }
        if (stopped) return stream.getTracks().forEach(track => track.stop());
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        send({ type: 'load', base: chrome.runtime.getURL(''), camera: true, options: { stillMs: settings.current.stillMs } });
      } catch (caught) {
        if (stopped) return;
        if (caught instanceof CameraBlockedError) { setState('blocked'); setError('Camera blocked'); }
        else { setState('error'); setError(caught instanceof Error ? caught.message : String(caught)); }
      }
    })();

    return () => {
      stopped = true;
      videoRef.current?.cancelVideoFrameCallback(videoCallback);
      clearInterval(watchdog);
      stream?.getTracks().forEach(track => track.stop());
      sign.terminate(); // frees MediaPipe, the model and their memory
      if (worker.current === sign) worker.current = null;
    };
  }, [enabled]);

  useEffect(() => { worker.current?.postMessage({ type: 'options', options: { stillMs: options.stillMs } } satisfies SignIn); }, [options.stillMs]);

  return { videoRef, canvasRef, state, error, labels, guess, live };
}

"use client";
// Face landmarks -> crop the prescribed eye -> image embedding. Everything here runs on the phone.
import { FaceLandmarker, FilesetResolver, ImageEmbedder } from "@mediapipe/tasks-vision";

export interface Vision { landmarker: FaceLandmarker; embedder: ImageEmbedder }

// Face-mesh indices. "R" = the child's right eye (image left on a front camera frame before mirroring).
const EYES = { R: [33, 133, 159, 145, 46, 55], L: [263, 362, 386, 374, 276, 285] } as const;

export async function loadVision(): Promise<Vision> {
  const files = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
  const landmarker = await FaceLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: "/mediapipe/face_landmarker.task", delegate: "CPU" },
    runningMode: "VIDEO", numFaces: 1,
  });
  const embedder = await ImageEmbedder.createFromOptions(files, {
    baseOptions: { modelAssetPath: "/mediapipe/mobilenet_v3_small.tflite", delegate: "CPU" },
    runningMode: "IMAGE", l2Normalize: true,
  });
  return { landmarker, embedder };
}

export interface Box { x: number; y: number; s: number }

/** The square around the prescribed eye, sized to cover a patch (wider than the eye itself). */
export function eyeBox(points: { x: number; y: number }[], eye: "L" | "R", w: number, h: number): Box | null {
  const idx = EYES[eye];
  const ps = idx.map((i) => points[i]).filter(Boolean);
  if (ps.length < idx.length) return null;
  const xs = ps.map((p) => p.x * w), ys = ps.map((p) => p.y * h);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const eyeW = Math.abs(points[idx[0]].x - points[idx[1]].x) * w;
  const s = Math.max(48, eyeW * 2.6);
  return { x: cx - s / 2, y: cy - s / 2.2, s };
}

const crop = typeof document !== "undefined" ? document.createElement("canvas") : null;

export interface Frame { face: boolean; box: Box | null; embedding: number[] | null }

export function look(v: Vision, video: HTMLVideoElement, eye: "L" | "R", ts: number): Frame {
  const res = v.landmarker.detectForVideo(video, ts);
  const pts = res.faceLandmarks?.[0];
  if (!pts) return { face: false, box: null, embedding: null };
  const box = eyeBox(pts, eye, video.videoWidth, video.videoHeight);
  if (!box || !crop) return { face: true, box: null, embedding: null };
  crop.width = 160; crop.height = 160;
  const ctx = crop.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(video, box.x, box.y, box.s, box.s, 0, 0, 160, 160);
  const e = v.embedder.embed(crop);
  const emb = e.embeddings?.[0]?.floatEmbedding;
  return { face: true, box, embedding: emb ? Array.from(emb) : null };
}

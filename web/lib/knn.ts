// Per-child nearest-neighbour classifier over eye-crop embeddings. Runs on the phone only.
export type Label = "patch" | "bare" | "covered";
export interface Example { label: Label; v: number[] }

export function cosine(a: number[], b: number[]): number {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? d / Math.sqrt(na * nb) : 0;
}

export interface Vote { label: Label; share: number; patchShare: number }

/** k nearest by cosine similarity; returns the winning label and the share of "patch" votes. */
export function vote(train: Example[], v: number[], k = 5): Vote | null {
  if (train.length === 0) return null;
  const near = train.map((e) => ({ e, s: cosine(e.v, v) })).sort((x, y) => y.s - x.s).slice(0, Math.min(k, train.length));
  const counts: Record<Label, number> = { patch: 0, bare: 0, covered: 0 };
  for (const n of near) counts[n.e.label]++;
  const label = (Object.keys(counts) as Label[]).sort((a, b) => counts[b] - counts[a])[0];
  return { label, share: counts[label] / near.length, patchShare: counts.patch / near.length };
}

/** "On" only when the patch wins with at least `min` agreement (AC-5). */
export function isOn(v: Vote | null, min = 0.6): boolean {
  return !!v && v.label === "patch" && v.patchShare >= min;
}

/** Every 4th example of each label is held out; the rest train. */
export function split(all: Example[]): { train: Example[]; test: Example[] } {
  const seen: Record<string, number> = {};
  const train: Example[] = [], test: Example[] = [];
  for (const e of all) { const n = (seen[e.label] = (seen[e.label] ?? 0) + 1); (n % 4 === 0 ? test : train).push(e); }
  return { train, test };
}

export interface Eval { n: number; tp: number; fp: number; fn: number; tn: number; precision: number; recall: number; coveredRefused: number; coveredN: number }

/** Held-out precision and recall of "patch on" (AC-6). A false "on" is the costly error. */
export function evaluate(all: Example[], k = 5, min = 0.6): Eval | null {
  const counts = all.reduce<Record<string, number>>((m, e) => ((m[e.label] = (m[e.label] ?? 0) + 1), m), {});
  if ((counts.patch ?? 0) < 5 || (counts.bare ?? 0) < 5) return null;
  const { train, test } = split(all);
  let tp = 0, fp = 0, fn = 0, tn = 0, coveredRefused = 0, coveredN = 0;
  for (const e of test) {
    const on = isOn(vote(train, e.v, k), min);
    const truth = e.label === "patch";
    if (on && truth) tp++; else if (on && !truth) fp++; else if (!on && truth) fn++; else tn++;
    if (e.label === "covered") { coveredN++; if (!on) coveredRefused++; }
  }
  return { n: test.length, tp, fp, fn, tn, precision: tp + fp ? tp / (tp + fp) : 1, recall: tp + fn ? tp / (tp + fn) : 0, coveredRefused, coveredN };
}

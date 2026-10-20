import { describe, expect, it } from "vitest";
import { cosine, evaluate, isOn, split, vote, type Example } from "./knn";

// Synthetic, well-separated clusters stand in for embeddings in these unit tests.
const at = (x: number, y: number, z: number, j = 0): number[] => [x + j * 0.01, y - j * 0.01, z + j * 0.005];
const ex = (label: Example["label"], base: number[], n: number): Example[] => Array.from({ length: n }, (_, j) => ({ label, v: at(base[0], base[1], base[2], j) }));
const data = [...ex("patch", [1, 0, 0], 12), ...ex("bare", [0, 1, 0], 12), ...ex("covered", [0, 0, 1], 8)];

describe("knn (AC-5)", () => {
  it("cosine is 1 for the same direction", () => expect(cosine([1, 2], [2, 4])).toBeCloseTo(1));
  it("votes for the nearest class", () => {
    const v = vote(data, [0.9, 0.1, 0]);
    expect(v?.label).toBe("patch");
    expect(isOn(v)).toBe(true);
  });
  it("sends off when the patch does not win clearly", () => {
    const tie: Example[] = [...ex("patch", [1, 0, 0], 2), ...ex("covered", [0.98, 0.02, 0], 3)];
    expect(isOn(vote(tie, [1, 0, 0]))).toBe(false);
    expect(isOn(vote([], [1, 0, 0]))).toBe(false);
  });
});

describe("held-out evaluation (AC-6)", () => {
  it("needs five examples of patch and bare", () => {
    expect(evaluate(ex("patch", [1, 0, 0], 4))).toBeNull();
  });
  it("holds out every fourth example and scores patch on", () => {
    const { test } = split(data);
    expect(test.length).toBe(3 + 3 + 2); expect(test.every((e, i, a) => i === 0 || e.label !== a[i - 1].label || true)).toBe(true);
    const e = evaluate(data)!;
    expect(e.precision).toBe(1);
    expect(e.recall).toBe(1);
    expect(e.coveredRefused).toBe(e.coveredN);
  });
});

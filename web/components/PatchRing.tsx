// Today's minutes drawn as an adhesive eye patch filling with tan. When the patch is off, a corner peels up.
export function PatchRing({ minutes, prescribed, off, size = 300 }: { minutes: number; prescribed: number; off: boolean; size?: number }) {
  const frac = Math.max(0, Math.min(1, minutes / Math.max(1, prescribed)));
  const h = 200, w = 280;
  const fillY = h - frac * h;
  const patch = "M140 8 C214 8 272 52 272 104 C272 158 214 192 140 192 C66 192 8 158 8 104 C8 52 66 8 140 8 Z";
  return (
    <svg viewBox={`-10 -30 ${w + 20} ${h + 40}`} overflow="visible" width={size} height={(size * h) / w} role="img"
      aria-label={`${Math.floor(minutes)} of ${prescribed} minutes patched today${off ? ", patch is off" : ""}`}>
      <defs>
        <clipPath id="patch-clip"><path d={patch} /></clipPath>
      </defs>
      <path d={patch} fill="var(--surface-2)" />
      <g clipPath="url(#patch-clip)">
        <rect x="0" y={fillY} width={w} height={h} fill="var(--data-patch)" style={{ transition: "y 600ms var(--ease-out)" }} />
        {/* the patch's soft pad, as printed on real adhesive patches */}
        <ellipse cx="140" cy="100" rx="86" ry="56" fill="none" stroke="rgba(29,23,20,.18)" strokeWidth="3" strokeDasharray="2 8" strokeLinecap="round" />
      </g>
      <path d={patch} fill="none" stroke="var(--line-input)" strokeWidth="3" />
      {/* the peeling corner */}
      <g style={{ transformOrigin: "214px 40px", transform: off ? "rotate(-28deg) translate(4px,-6px)" : "rotate(0deg)", transition: "transform 420ms cubic-bezier(.34,1.4,.64,1)" }}>
        <path d="M214 22 C240 30 258 46 266 66 L232 58 Z" fill={off ? "var(--off)" : "var(--data-patch)"} opacity={off ? 1 : 0} style={{ transition: "opacity 200ms" }} />
      </g>
    </svg>
  );
}

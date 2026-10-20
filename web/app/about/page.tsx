export const metadata = { title: "Patch Hours · how it works" };

export default function About() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "32px 16px 64px", lineHeight: 1.6 }}>
      <p className="display" style={{ color: "var(--accent)", fontSize: 24, margin: 0 }}>Patch Hours</p>
      <h1 style={{ fontSize: 44, margin: "8px 0 12px" }}>The show plays only while the eye patch is on</h1>
      <p style={{ fontSize: 19 }}>A Fire TV app and a phone check for children patching for amblyopia. The cartoon pauses when the patch comes off, and the minutes it was really worn are counted for the clinic.</p>
      <h2>Why</h2>
      <ul>
        <li>In 152 children whose patching was measured, mean compliance was 44% and on 42% of days no patch was worn (<a href="https://openaccess.city.ac.uk/id/eprint/2796">Wallace et al., 2013</a>).</li>
        <li>A 2026 review puts adherence at 40 to 60% by week 6 and about 30% by week 12 (<a href="https://www.oepf.org/wp-content/uploads/2026/07/OVP-14-2-Chow-Final-New-Newest.pdf">OEPF</a>).</li>
        <li>Families keep a diary from memory. The TV is already the child&apos;s reward.</li>
      </ul>
      <h2>How it works</h2>
      <ol>
        <li><b>Pair:</b> the TV shows a code; the parent scans it.</li>
        <li><b>Teach:</b> the phone learns this child&apos;s patch from a few seconds of “patch on”, “no patch” and “hand over the eye”, and shows held-out precision and recall.</li>
        <li><b>Watch:</b> the TV plays only while the phone sees the patch; it pauses when the patch comes off or the phone stops reporting.</li>
      </ol>
      <h2>Limits</h2>
      <ul>
        <li>An adherence aid for a prescribed patch. It does not treat amblyopia or change a prescription.</li>
        <li>Only on or off leaves the phone. No pictures are sent or stored.</li>
        <li>Tested on the Vega Virtual Device, not a physical Fire TV.</li>
      </ul>
      <p><a href="/">Try it live</a></p>
    </main>
  );
}

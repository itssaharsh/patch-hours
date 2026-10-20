import QRCode from "qrcode";
import { isCode } from "@/lib/rules";

// PNG QR for the TV app's pairing screen (Vega has no canvas/SVG QR library).
export async function GET(req: Request) {
  const u = new URL(req.url);
  const code = (u.searchParams.get("code") ?? "").toUpperCase();
  if (!isCode(code)) return new Response("bad code", { status: 400 });
  const png = await QRCode.toBuffer(`${u.origin}/check?code=${code}`, { margin: 1, width: 560, color: { dark: "#1D1714", light: "#F6EDE4" } });
  return new Response(new Uint8Array(png), { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" } });
}

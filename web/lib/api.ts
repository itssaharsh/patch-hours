import { isCode, localDay } from "./rules";

export const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } });

export const err = (status: number, message: string) => json({ error: message }, status);

/** The client's local day, from ?day= or the header, else UTC. */
export function dayFrom(req: Request): string {
  const d = new URL(req.url).searchParams.get("day");
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : localDay(Date.now());
}

export function codeOk(code: string) {
  return isCode(code.toUpperCase());
}

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};
export const preflight = () => new Response(null, { status: 204, headers: CORS });

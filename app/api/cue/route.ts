import { kv } from "@vercel/kv";
import type { Mode } from "@/types";

const VALID_MODES: Mode[] = ["presence", "voicemail"];

export async function GET() {
  try {
    const mode = (await kv.get<Mode>("currentMode")) ?? "presence";
    return Response.json({ mode });
  } catch {
    // KV not configured — return 503 so clients skip this poll cycle
    // rather than incorrectly snapping back to the default "presence" value
    return Response.json({ mode: "presence" }, { status: 503 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { mode?: unknown };
    const mode = body.mode;
    if (!VALID_MODES.includes(mode as Mode)) {
      return Response.json({ error: "Invalid mode" }, { status: 400 });
    }
    await kv.set("currentMode", mode);
    return Response.json({ ok: true });
  } catch {
    // KV not configured — acknowledge without persisting
    return Response.json({ ok: true });
  }
}

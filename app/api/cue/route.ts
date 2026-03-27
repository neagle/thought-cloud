import { Redis } from "@upstash/redis";
import type { Channel } from "@/types";
import { CHANNELS } from "@/types";

const redis = Redis.fromEnv();

const DEFAULT_TRANSITION_DURATION = 2.0; // seconds

function parseDuration(raw: unknown): number {
  const n = typeof raw === "number" ? raw : parseFloat(raw as string);
  if (!isFinite(n) || n < 0) return DEFAULT_TRANSITION_DURATION;
  return n;
}

export type CuePendingAction =
  | { id: string; type: "channel"; channel: Channel }
  | { id: string; type: "preset"; scope: Channel; data: Record<string, number>; duration: number }
  | { id: string; type: "controls"; scope: Channel; data: Record<string, number>; duration: number };

export async function GET() {
  try {
    const [channel, pendingAction] = await Promise.all([
      redis.get<Channel>("channel"),
      redis.get<CuePendingAction>("cue:pending"),
    ]);
    return Response.json({ channel: channel ?? "presence", pendingAction: pendingAction ?? null });
  } catch (err) {
    console.error("[/api/cue GET]", err);
    return Response.json({ channel: "presence", pendingAction: null }, { status: 503 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const id = Date.now().toString();

    // --- action: "channel" or legacy { channel: "..." } ---
    const actionType = (body.action as string | undefined) ?? (body.channel ? "channel" : undefined);

    if (actionType === "channel" || (!body.action && body.channel)) {
      const channel = (body.channel ?? body.channel) as unknown;
      if (!CHANNELS.includes(channel as Channel)) {
        return Response.json({ error: "Invalid channel" }, { status: 400 });
      }
      const action: CuePendingAction = { id, type: "channel", channel: channel as Channel };
      await Promise.all([
        redis.set("channel", channel),
        redis.set("cue:pending", action, { ex: 30 }),
      ]);
      return Response.json({ ok: true });
    }

    // --- action: "preset" — load a saved preset by name ---
    if (actionType === "preset") {
      const channel = body.channel as Channel | undefined;
      const name = body.name as string | undefined;
      if (!channel || !CHANNELS.includes(channel) || !name?.trim()) {
        return Response.json({ error: "Invalid preset payload" }, { status: 400 });
      }
      const presets =
        (await redis.get<Record<string, Record<string, number>>>(`presets:${channel}`)) ?? {};
      const data = presets[name.trim()];
      if (!data) {
        return Response.json({ error: `Preset "${name}" not found for channel "${channel}"` }, { status: 404 });
      }
      const action: CuePendingAction = { id, type: "preset", scope: channel, data, duration: parseDuration(body.duration) };
      await redis.set("cue:pending", action, { ex: 30 });
      return Response.json({ ok: true });
    }

    // --- action: "controls" — push arbitrary control values ---
    if (actionType === "controls") {
      const scope = body.scope as Channel | undefined;
      const data = body.data as Record<string, number> | undefined;
      if (!scope || !CHANNELS.includes(scope) || typeof data !== "object" || data === null) {
        return Response.json({ error: "Invalid controls payload" }, { status: 400 });
      }
      const action: CuePendingAction = { id, type: "controls", scope, data, duration: parseDuration(body.duration) };
      await redis.set("cue:pending", action, { ex: 30 });
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[/api/cue POST]", err);
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

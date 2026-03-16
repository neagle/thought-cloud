import { Redis } from "@upstash/redis";
import type { Channel } from "@/types";
import { CHANNELS } from "@/types";

const redis = Redis.fromEnv();

export async function GET() {
  try {
    const channel = (await redis.get<Channel>("channel")) ?? "presence";
    return Response.json({ channel });
  } catch {
    return Response.json({ channel: "presence" }, { status: 503 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { channel?: unknown };
    const channel = body.channel;
    if (!CHANNELS.includes(channel as Channel)) {
      return Response.json({ error: "Invalid channel" }, { status: 400 });
    }
    await redis.set("channel", channel);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: true });
  }
}

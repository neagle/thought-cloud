import { Redis } from "@upstash/redis";
import type { Channel } from "@/types";
import { CHANNELS } from "@/types";

const redis = Redis.fromEnv();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const channel = searchParams.get("channel") as Channel | null;
  if (!channel || !CHANNELS.includes(channel)) {
    return Response.json({ error: "Invalid channel" }, { status: 400 });
  }
  try {
    const presets =
      (await redis.get<Record<string, Record<string, number>>>(`presets:${channel}`)) ?? {};
    return Response.json({ presets });
  } catch {
    return Response.json({ presets: {} }, { status: 503 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      channel?: Channel;
      name?: string;
      data?: Record<string, number>;
    };
    if (
      !body.channel ||
      !CHANNELS.includes(body.channel) ||
      typeof body.name !== "string" ||
      !body.name.trim() ||
      typeof body.data !== "object"
    ) {
      return Response.json({ error: "Invalid payload" }, { status: 400 });
    }
    const key = `presets:${body.channel}`;
    const existing =
      (await redis.get<Record<string, Record<string, number>>>(key)) ?? {};
    existing[body.name.trim()] = body.data;
    await redis.set(key, existing);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = (await req.json()) as { channel?: Channel; name?: string };
    if (
      !body.channel ||
      !CHANNELS.includes(body.channel) ||
      typeof body.name !== "string"
    ) {
      return Response.json({ error: "Invalid payload" }, { status: 400 });
    }
    const key = `presets:${body.channel}`;
    const existing =
      (await redis.get<Record<string, Record<string, number>>>(key)) ?? {};
    delete existing[body.name];
    await redis.set(key, existing);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}

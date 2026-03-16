import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export async function GET() {
  try {
    const [presence, voicemail] = await Promise.all([
      redis.get<Record<string, number>>("controls:presence"),
      redis.get<Record<string, number>>("controls:voicemail"),
    ]);
    return Response.json({ presence: presence ?? null, voicemail: voicemail ?? null });
  } catch {
    return Response.json({ presence: null, voicemail: null }, { status: 503 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      scope?: "presence" | "voicemail";
      data?: Record<string, number>;
    };
    if (
      (body.scope !== "presence" && body.scope !== "voicemail") ||
      typeof body.data !== "object"
    ) {
      return Response.json({ error: "Invalid payload" }, { status: 400 });
    }
    await redis.set(`controls:${body.scope}`, body.data);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: true });
  }
}

import { storageGet, storageSet } from "@/lib/storage";

export async function GET() {
  try {
    const [presence, voicemail, audio] = await Promise.all([
      storageGet<Record<string, number>>("controls:presence"),
      storageGet<Record<string, number>>("controls:voicemail"),
      storageGet<Record<string, number>>("controls:audio"),
    ]);
    return Response.json({
      presence: presence ?? null,
      voicemail: voicemail ?? null,
      audio: audio ?? null,
    });
  } catch {
    return Response.json(
      { presence: null, voicemail: null, audio: null },
      { status: 503 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      scope?: "presence" | "voicemail" | "audio";
      data?: Record<string, number>;
    };
    if (
      (body.scope !== "presence" &&
        body.scope !== "voicemail" &&
        body.scope !== "audio") ||
      typeof body.data !== "object"
    ) {
      return Response.json({ error: "Invalid payload" }, { status: 400 });
    }
    await storageSet(`controls:${body.scope}`, body.data);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: true });
  }
}

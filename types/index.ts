export type Channel = "presence" | "voicemail";
export const CHANNELS: readonly Channel[] = ["presence", "voicemail"] as const;

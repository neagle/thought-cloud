import type { Channel } from "@/types";

export type SyncPayload =
  | { type: "channel"; channel: Channel }
  | { type: "controls"; scope: "presence" | "voicemail"; data: Record<string, number> }
  | { type: "request-state" }
  | {
      type: "state-response";
      channel: Channel;
      controls: {
        presence: Record<string, number>;
        voicemail: Record<string, number>;
      };
    };

type SyncHandler = (payload: SyncPayload) => void;

const CHANNEL_NAME = "thought-cloud-sync";

export class TabSync {
  private channel: BroadcastChannel;
  private handlers: SyncHandler[] = [];

  constructor() {
    this.channel = new BroadcastChannel(CHANNEL_NAME);
    this.channel.onmessage = (e: MessageEvent<SyncPayload>) => {
      for (const handler of this.handlers) handler(e.data);
    };
  }

  broadcast(payload: SyncPayload) {
    this.channel.postMessage(payload);
  }

  onMessage(handler: SyncHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  destroy() {
    this.channel.close();
  }
}

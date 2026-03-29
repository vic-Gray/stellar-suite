import * as Ably from "ably";

/**
 * liveShareService.ts
 *
 * Handles the real-time communication for the Live Share feature.
 * Uses Ably to broadcast and receive messages.
 */

export interface LiveShareMessage {
  type: "CONTENT_CHANGE" | "CURSOR_MOVE" | "ACTIVE_FILE_CHANGE" | "PROJECT_SYNC";
  payload: any;
}

class LiveShareService {
  private client: Ably.Realtime | null = null;
  private channel: Ably.RealtimeChannel | null = null;
  private sessionId: string | null = null;

  /**
   * Initialize Ably and join a session channel.
   */
  public async init(sessionId: string): Promise<void> {
    if (this.client && this.sessionId === sessionId) return;

    this.sessionId = sessionId;

    // In a real app, this should be fetched from the backend to avoid exposing keys.
    // We use a dummy key here for the implementation demo.
    const ablyKey = process.env.NEXT_PUBLIC_ABLY_API_KEY || "ABLY_API_KEY";

    this.client = new Ably.Realtime({ key: ablyKey });
    this.channel = this.client.channels.get(`live-share:${sessionId}`);

    await this.channel.attach();
  }

  /**
   * Subscribe to messages from the channel.
   */
  public subscribe(callback: (message: LiveShareMessage) => void): void {
    if (!this.channel) return;

    this.channel.subscribe((msg) => {
      callback(msg.data as LiveShareMessage);
    });
  }

  /**
   * Publish a message to the channel.
   */
  public async publish(message: LiveShareMessage): Promise<void> {
    if (!this.channel) return;

    await this.channel.publish("update", message);
  }

  /**
   * Track presence to show connected peers.
   */
  public async trackPresence(onUpdate: (count: number) => void): Promise<void> {
    if (!this.channel) return;

    this.channel.presence.subscribe("enter", () => this.updatePresence(onUpdate));
    this.channel.presence.subscribe("leave", () => this.updatePresence(onUpdate));

    await this.channel.presence.enter();
    this.updatePresence(onUpdate);
  }

  private async updatePresence(onUpdate: (count: number) => void): Promise<void> {
    if (!this.channel) return;

    const members = await this.channel.presence.get();
    onUpdate(members.length);
  }

  /**
   * Disconnect and cleanup.
   */
  public disconnect(): void {
    if (this.channel) {
      this.channel.presence.leave();
      this.channel.unsubscribe();
      this.channel.detach();
    }
    if (this.client) {
      this.client.close();
    }
    this.client = null;
    this.channel = null;
    this.sessionId = null;
  }
}

export const liveShareService = new LiveShareService();

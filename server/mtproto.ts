import fs from "fs";
import path from "path";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { CustomFile } from "telegram/client/uploads";

export interface MTProtoConfig {
  apiId: number;
  apiHash: string;
  botToken: string;
}

export class MTProtoService {
  private client: TelegramClient | null = null;
  private apiId: number;
  private apiHash: string;
  private botToken: string;
  private isConnecting: boolean = false;
  private isConnected: boolean = false;

  constructor(config: MTProtoConfig) {
    this.apiId = config.apiId;
    this.apiHash = config.apiHash.trim();
    this.botToken = config.botToken.trim();
  }

  async connect(): Promise<boolean> {
    if (this.isConnected && this.client) return true;
    if (this.isConnecting) return false;

    try {
      this.isConnecting = true;
      const stringSession = new StringSession("");
      this.client = new TelegramClient(stringSession, this.apiId, this.apiHash, {
        connectionRetries: 5,
        useWSS: false,
      });

      await this.client.start({
        botAuthToken: this.botToken,
      });

      this.isConnected = true;
      console.log("⚡ GramJS MTProto client connected successfully! 2GB direct uploads enabled.");
      return true;
    } catch (err) {
      console.warn("⚠️ GramJS MTProto connection failed, falling back to HTTP Bot API:", err);
      this.isConnected = false;
      this.client = null;
      return false;
    } finally {
      this.isConnecting = false;
    }
  }

  isReady(): boolean {
    return this.isConnected && !!this.client;
  }

  /**
   * Upload file directly via MTProto binary chunk protocol (up to 2,000 MB / 2 GB)
   */
  async sendFile(
    chatId: number | string,
    filePath: string,
    filename: string,
    caption?: string,
    onProgress?: (progressPercent: number) => void
  ): Promise<boolean> {
    if (!this.isReady()) {
      const ok = await this.connect();
      if (!ok || !this.client) {
        throw new Error("MTProto client not connected");
      }
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }

    const stat = fs.statSync(filePath);
    const customFile = new CustomFile(filename, stat.size, filePath);

    const isVideo = /\.(mp4|mkv|mov|avi|webm|flv)$/i.test(filename);

    console.log(`🚀 Starting MTProto 2GB upload for: ${filename} (${stat.size} bytes)`);

    // GramJS sendFile handles big files with upload.saveBigFilePart automatically
    await this.client!.sendFile(chatId, {
      file: customFile,
      caption: caption || filename,
      forceDocument: !isVideo,
      progressCallback: (progress: number) => {
        const pct = Math.round(progress * 100);
        if (onProgress) onProgress(pct);
      },
    });

    console.log(`✅ MTProto 2GB upload completed: ${filename}`);
    return true;
  }
}

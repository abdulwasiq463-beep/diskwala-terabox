import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import {
  isTeraboxUrl,
  extractUrlFromText,
  resolveTeraboxLink,
  cleanFilename,
  formatBytes,
  detectExtensionFromBuffer,
  unpackZipArchive,
  downloadM3u8Stream,
  VIDEO_EXTENSIONS,
} from "./server/terabox.ts";
import {
  MAX_TELEGRAM_FILE_SIZE,
  splitVideo,
  splitBinaryFile,
} from "./server/splitter.ts";
import { TelegramService, TelegramBotInfo } from "./server/telegram.ts";
import { MTProtoService } from "./server/mtproto.ts";
import type { DownloadJob, ProcessedFile, BotStatus } from "./src/types.ts";

const PORT = 3000;
const app = express();
app.use(express.json());

// Track public base URL for direct download links
let appPublicUrl =
  process.env.APP_URL ||
  "https://ais-dev-jya4lggt2drjhja3yk5vs7-856843567695.asia-east1.run.app";

app.use((req, res, next) => {
  if (req.headers.host) {
    const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "http";
    const detected = `${proto}://${req.headers.host}`;
    if (!appPublicUrl || appPublicUrl.includes("localhost")) {
      appPublicUrl = detected;
    }
  }
  next();
});

// Set up data directories
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const DOWNLOADS_DIR = path.join(DATA_DIR, "downloads");
const UNPACKED_DIR = path.join(DATA_DIR, "unpacked");
fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
fs.mkdirSync(UNPACKED_DIR, { recursive: true });

// Bot configuration state
let botToken = process.env.TELEGRAM_BOT_TOKEN || "";
let apiId = process.env.TELEGRAM_API_ID || "";
let apiHash = process.env.TELEGRAM_API_HASH || "";
let telegramService: TelegramService | null = botToken ? new TelegramService(botToken) : null;
let mtprotoService: MTProtoService | null = null;

function initMTProto() {
  if (apiId && apiHash && botToken) {
    const numericApiId = parseInt(apiId, 10);
    if (!isNaN(numericApiId)) {
      mtprotoService = new MTProtoService({
        apiId: numericApiId,
        apiHash,
        botToken,
      });
      mtprotoService.connect().catch((err) => {
        console.warn("MTProto initialization warning:", err);
      });
    }
  } else {
    mtprotoService = null;
  }
}
initMTProto();
let botInfo: TelegramBotInfo | null = null;
let isPolling = false;
let pollingOffset = 0;
let pollingTimeoutId: NodeJS.Timeout | null = null;

// Jobs persistence file
const JOBS_FILE = path.join(DATA_DIR, "jobs.json");

function loadJobs(): DownloadJob[] {
  try {
    if (fs.existsSync(JOBS_FILE)) {
      const data = fs.readFileSync(JOBS_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn("Failed to load jobs from disk:", err);
  }
  return [];
}

function saveJobs() {
  try {
    fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs.slice(0, 50), null, 2), "utf-8");
  } catch (err) {
    console.warn("Failed to save jobs to disk:", err);
  }
}

// In-memory + persisted jobs store
const jobs: DownloadJob[] = loadJobs();

async function updateBotInfo() {
  if (!botToken) {
    botInfo = null;
    telegramService = null;
    return;
  }
  try {
    telegramService = new TelegramService(botToken);
    botInfo = await telegramService.getMe();
    console.log(`🤖 Telegram Bot authenticated: @${botInfo.username}`);
  } catch (err: any) {
    console.warn(`⚠️ Telegram authentication notice: ${err.message}`);
    botInfo = null;
  }
}

// Background Telegram polling loop
async function pollTelegramUpdates() {
  if (!isPolling || !telegramService) return;

  try {
    const updates = await telegramService.getUpdates(pollingOffset, 5);
    for (const update of updates) {
      pollingOffset = update.update_id + 1;
      const msg = update.message;
      if (!msg || !msg.text) continue;

      const chatId = msg.chat.id;
      const text = msg.text.trim();

      if (text === "/start") {
        await telegramService.sendMessage(
          chatId,
          `👋 *TeraBox Downloader Bot Active*\n\n` +
            `Send me any TeraBox link to download and unpack files!\n\n` +
            `🌐 *Supported mirrors:*\n` +
            `• terabox.com, terabox.app, teraboxlink.com\n` +
            `• 1024tera.com, 1024terabox.com, terafileshare.com\n` +
            `• nephobox, mirrobox, 4funbox, dubox, and all shortlinks!\n\n` +
            `_ZIP archives are automatically unpacked and videos are formatted for streaming._`
        );
        continue;
      }

      if (text === "/help") {
        await telegramService.sendMessage(
          chatId,
          `📖 *Help & Instructions*\n\n` +
            `1. Paste any TeraBox share link.\n` +
            `2. The bot resolves the link, downloads the files, and checks magic bytes.\n` +
            `3. ZIP files are uncompressed and individual files sent directly.\n` +
            `4. Upload limit: 50 MB in standard cloud mode.`
        );
        continue;
      }

      if (text === "/status") {
        const activeCount = jobs.filter(
          (j) => j.status !== "completed" && j.status !== "failed"
        ).length;
        await telegramService.sendMessage(
          chatId,
          `⚡ *Bot Status:* Online\n` +
            `📥 *Active Jobs:* ${activeCount}\n` +
            `📁 *Total Processed:* ${jobs.length}`
        );
        continue;
      }

      if (isTeraboxUrl(text)) {
        const url = extractUrlFromText(text) || text;
        executeDownloadJob(url, chatId).catch((err) => {
          console.error("Job execution error from telegram message:", err);
        });
      } else {
        await telegramService.sendMessage(
          chatId,
          `⚠️ Please send a valid TeraBox share link.`
        );
      }
    }
  } catch (err) {
    console.warn("Polling error:", err);
  }

  if (isPolling) {
    pollingTimeoutId = setTimeout(pollTelegramUpdates, 1500);
  }
}

function startPolling() {
  if (isPolling) return;
  isPolling = true;
  pollTelegramUpdates();
  console.log("▶️ Telegram Polling started");
}

function stopPolling() {
  isPolling = false;
  if (pollingTimeoutId) {
    clearTimeout(pollingTimeoutId);
    pollingTimeoutId = null;
  }
  console.log("⏹️ Telegram Polling stopped");
}

// Core execution engine
async function executeDownloadJob(
  url: string,
  chatId?: number | string
): Promise<DownloadJob> {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const jobDir = path.join(DOWNLOADS_DIR, jobId);
  fs.mkdirSync(jobDir, { recursive: true });

  const job: DownloadJob = {
    id: jobId,
    url,
    status: "resolving",
    progress: 10,
    statusText: "Analyzing TeraBox share link...",
    files: [],
    chatId: chatId ? String(chatId) : undefined,
    createdAt: Date.now(),
    logs: [`[${new Date().toLocaleTimeString()}] Job initialized for ${url}`],
  };

  jobs.unshift(job);
  if (jobs.length > 50) jobs.pop();
  saveJobs();

  let tgStatusMsgId: number | null = null;
  if (chatId && telegramService) {
    try {
      const sent = await telegramService.sendMessage(
        chatId,
        `⏳ *Processing TeraBox Link...*\nConnecting to server...`
      );
      tgStatusMsgId = sent.message_id;
    } catch {
      // ignore
    }
  }

  const updateStatus = async (
    status: DownloadJob["status"],
    progress: number,
    text: string
  ) => {
    job.status = status;
    job.progress = progress;
    job.statusText = text;
    job.logs.push(`[${new Date().toLocaleTimeString()}] ${text}`);

    if (chatId && telegramService && tgStatusMsgId) {
      await telegramService.editMessageText(
        chatId,
        tgStatusMsgId,
        `⏳ *TeraBox Processor*\n${text}`
      );
    }
  };

  try {
    await updateStatus("resolving", 25, "Resolving share link metadata & mirror domain...");
    const metadata = await resolveTeraboxLink(url);

    await updateStatus("downloading", 45, `Downloading file content (${metadata.title})...`);

    // Download or prepare file
    let candidateName = cleanFilename(metadata.title || "terabox_download");
    const downloadedFilePath = path.join(jobDir, candidateName);

    let actualFileBuffer: Buffer | null = null;
    let directDownloaded = false;

    // Check if direct dlink is present and accessible
    const firstDirectUrl = metadata.files.find((f) => f.downloadUrl)?.downloadUrl;
    if (firstDirectUrl) {
      try {
        const streamRes = await fetch(firstDirectUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0",
            Referer: metadata.refererUrl || "https://www.terabox.app/",
            ...(metadata.cookies ? { Cookie: metadata.cookies } : {}),
          },
        });
        if (streamRes.ok) {
          const arrayBuffer = await streamRes.arrayBuffer();
          actualFileBuffer = Buffer.from(arrayBuffer);
          fs.writeFileSync(downloadedFilePath, actualFileBuffer);
          directDownloaded = true;
        }
      } catch (dlErr) {
        console.warn("Direct stream fetch failed:", dlErr);
      }
    }

    // Check if streamUrl (M3U8 HLS stream) is available for video files
    const firstStreamFile = metadata.files.find((f) => f.streamUrl);
    const firstStreamUrl = firstStreamFile?.streamUrl;
    if (!directDownloaded && firstStreamUrl) {
      try {
        await updateStatus("downloading", 50, `Fetching media stream for ${candidateName}...`);
        
        // Ensure .mp4 extension
        if (!candidateName.toLowerCase().endsWith(".mp4")) {
          candidateName = `${candidateName.replace(/\.[^.]+$/, "")}.mp4`;
        }
        const videoTargetPath = path.join(jobDir, candidateName);

        await downloadM3u8Stream(
          firstStreamUrl,
          videoTargetPath,
          metadata.refererUrl || "https://www.terabox.app/",
          metadata.cookies,
          async (percent, curr, tot) => {
            job.progress = Math.min(85, 45 + Math.round((percent / 100) * 35));
            job.statusText = `Downloading video stream: segment ${curr}/${tot} (${percent}%)`;
          },
          {
            duration: firstStreamFile?.duration,
            shareId: metadata.shareId,
            uk: metadata.uk,
            sign: metadata.sign || firstStreamFile?.sign,
            timestamp: metadata.timestamp || firstStreamFile?.timestamp,
            fsId: firstStreamFile?.fsId,
            randsk: metadata.randsk,
          }
        );

        if (fs.existsSync(videoTargetPath) && fs.statSync(videoTargetPath).size > 0) {
          actualFileBuffer = fs.readFileSync(videoTargetPath);
          directDownloaded = true;
        }
      } catch (streamErr: any) {
        console.warn("M3U8 stream download failed, checking fallback:", streamErr);
      }
    }

    if (!directDownloaded) {
      throw new Error(
        "Could not establish direct media stream or download URL for this file from TeraBox. The link might be expired, private, or protected by captcha."
      );
    }

    // Magic bytes extension detection
    const detectedExt = actualFileBuffer
      ? detectExtensionFromBuffer(actualFileBuffer)
      : null;
    if (detectedExt && !candidateName.endsWith(detectedExt)) {
      const newName = `${candidateName}${detectedExt}`;
      const newPath = path.join(jobDir, newName);
      fs.renameSync(path.join(jobDir, candidateName), newPath);
      candidateName = newName;
    }

    const currentFilePath = path.join(jobDir, candidateName);
    const stats = fs.statSync(currentFilePath);
    const isZip =
      candidateName.toLowerCase().endsWith(".zip") ||
      (detectedExt && detectedExt === ".zip");
    const isVideo = VIDEO_EXTENSIONS.has(path.extname(candidateName).toLowerCase());

    const processedFiles: ProcessedFile[] = [];

    // ZIP Auto-unpacking
    if (isZip) {
      await updateStatus("unpacking", 70, "📦 ZIP archive detected! Unpacking files...");
      const unpackDir = path.join(UNPACKED_DIR, jobId);
      fs.mkdirSync(unpackDir, { recursive: true });

      const unpackedList = await unpackZipArchive(currentFilePath, unpackDir);
      if (unpackedList.length > 0) {
        for (const uf of unpackedList) {
          const uExt = path.extname(uf.filename).toLowerCase();
          processedFiles.push({
            filename: uf.filename,
            sizeBytes: uf.size,
            sizeFormatted: formatBytes(uf.size),
            path: uf.path,
            isVideo: VIDEO_EXTENSIONS.has(uExt),
            isZip: false,
          });
        }
      }
    }

    if (processedFiles.length === 0) {
      processedFiles.push({
        filename: candidateName,
        sizeBytes: stats.size,
        sizeFormatted: formatBytes(stats.size),
        path: currentFilePath,
        isVideo,
        isZip: !!isZip,
      });
    }

    // Assign direct download URLs
    for (let i = 0; i < processedFiles.length; i++) {
      const pf = processedFiles[i];
      pf.downloadUrl = appPublicUrl
        ? `${appPublicUrl}/api/downloads/${job.id}/${i}`
        : `/api/downloads/${job.id}/${i}`;
    }

    job.files = processedFiles;

    // Telegram delivery if requested
    if (chatId && telegramService) {
      await updateStatus(
        "uploading",
        85,
        `📤 Delivering ${processedFiles.length} file(s) to Telegram...`
      );

      for (let i = 0; i < processedFiles.length; i++) {
        const pf = processedFiles[i];
        if (!pf.path || !fs.existsSync(pf.path)) continue;

        const isExceedingTelegramLimit = pf.sizeBytes > MAX_TELEGRAM_FILE_SIZE;

        try {
          if (isExceedingTelegramLimit) {
            // Check if MTProto 2GB client is available
            let uploadedViaMTProto = false;
            if (mtprotoService) {
              try {
                await telegramService.sendMessage(
                  chatId,
                  `🚀 *${pf.filename}* (${pf.sizeFormatted}) is being uploaded in full via Telegram MTProto (up to 2 GB)...`
                );
                
                // 1. Upload as Video stream (streamable preview in Telegram)
                const videoCaption = `🎬 *[Stream Video]* \`${pf.filename}\` (${pf.sizeFormatted})`;
                await mtprotoService.sendFile(
                  chatId,
                  pf.path,
                  pf.filename,
                  videoCaption,
                  (pct) => {
                    if (pct % 25 === 0) {
                      job.statusText = `Uploading Video to Telegram: ${pct}%`;
                    }
                  },
                  false // forceDocument = false -> Streamable video
                );

                // 2. Upload as Raw Document (100% untouched original file, zero Telegram compression)
                const docCaption = `📁 *[Raw Original Document]* \`${pf.filename}\` (${pf.sizeFormatted})`;
                await mtprotoService.sendFile(
                  chatId,
                  pf.path,
                  pf.filename,
                  docCaption,
                  undefined,
                  true // forceDocument = true -> Raw file
                );

                uploadedViaMTProto = true;
              } catch (mtErr: any) {
                console.warn("MTProto 2GB upload attempt failed, falling back to HTTP split:", mtErr.message);
                uploadedViaMTProto = false;
              }
            }

            if (!uploadedViaMTProto) {
              await telegramService.sendMessage(
                chatId,
                `ℹ️ *${pf.filename}* (${pf.sizeFormatted}) exceeds 50 MB.\n✂️ Automatically delivering playable video parts + uncompressed document parts...`
              );

              if (pf.isVideo) {
                const parts = await splitVideo(pf.path, jobDir, MAX_TELEGRAM_FILE_SIZE);
                pf.splitPartsCount = parts.length;
                for (let pIdx = 0; pIdx < parts.length; pIdx++) {
                  const part = parts[pIdx];
                  // Send streamable video part
                  const videoPartCaption = `🎬 *[Stream Part ${pIdx + 1}/${parts.length}]* \`${part.filename}\` (${formatBytes(part.size)})`;
                  await telegramService.sendVideo(chatId, part.path, part.filename, videoPartCaption);
                  // Also send uncompressed document part
                  const docPartCaption = `📁 *[Document Part ${pIdx + 1}/${parts.length}]* \`${part.filename}\` (${formatBytes(part.size)})`;
                  await telegramService.sendDocument(chatId, part.path, part.filename, docPartCaption);
                }
              } else {
                const parts = await splitBinaryFile(pf.path, jobDir, MAX_TELEGRAM_FILE_SIZE);
                pf.splitPartsCount = parts.length;
                for (let pIdx = 0; pIdx < parts.length; pIdx++) {
                  const part = parts[pIdx];
                  const partCaption = `📦 *[Part ${pIdx + 1}/${parts.length}]* \`${part.filename}\` (${formatBytes(part.size)})`;
                  await telegramService.sendDocument(chatId, part.path, part.filename, partCaption);
                }
              }
            }
          } else {
            // File is <= 50 MB: send BOTH streamable video AND raw uncompressed document
            if (pf.isVideo) {
              const videoCaption = `🎬 *[Stream Video]* \`${pf.filename}\` (${pf.sizeFormatted})`;
              await telegramService.sendVideo(chatId, pf.path, pf.filename, videoCaption);

              const docCaption = `📁 *[Raw Original Document]* \`${pf.filename}\` (${pf.sizeFormatted})`;
              await telegramService.sendDocument(chatId, pf.path, pf.filename, docCaption);
            } else {
              const caption = `📄 *[${i + 1}/${processedFiles.length}]* \`${pf.filename}\` (${pf.sizeFormatted})`;
              await telegramService.sendDocument(chatId, pf.path, pf.filename, caption);
            }
          }
        } catch (uploadErr: any) {
          console.error(`Failed to send file ${pf.filename} to telegram:`, uploadErr);

          // Dynamic fallback if Telegram returns 413 Request Entity Too Large
          if (
            uploadErr.message?.includes("Request Entity Too Large") ||
            uploadErr.message?.includes("50MB limit") ||
            uploadErr.message?.includes("too big")
          ) {
            try {
              await telegramService.sendMessage(
                chatId,
                `✂️ File exceeds Telegram Bot limit. Splitting into smaller parts...`
              );
              const parts = pf.isVideo
                ? await splitVideo(pf.path, jobDir, 45 * 1024 * 1024)
                : await splitBinaryFile(pf.path, jobDir, 45 * 1024 * 1024);
              pf.splitPartsCount = parts.length;
              for (let pIdx = 0; pIdx < parts.length; pIdx++) {
                const part = parts[pIdx];
                const partCaption = `📁 *[Part ${pIdx + 1}/${parts.length}]* \`${part.filename}\` (${formatBytes(part.size)})`;
                if (part.isVideo) {
                  await telegramService.sendVideo(chatId, part.path, part.filename, partCaption);
                } else {
                  await telegramService.sendDocument(chatId, part.path, part.filename, partCaption);
                }
              }
            } catch (splitErr: any) {
              await telegramService.sendMessage(
                chatId,
                `⚠️ Could not upload \`${pf.filename}\`: ${uploadErr.message}`
              );
            }
          } else {
            await telegramService.sendMessage(
              chatId,
              `⚠️ Could not upload \`${pf.filename}\`: ${uploadErr.message}`
            );
          }
        }
      }

      if (tgStatusMsgId) {
        try {
          await telegramService.deleteMessage(chatId, tgStatusMsgId);
        } catch {
          // ignore
        }
      }

      let directDownloadLinks = "";
      if (appPublicUrl) {
        const linksList = processedFiles
          .map((f, idx) => `• [${f.filename}](${appPublicUrl}/api/downloads/${job.id}/${idx}) (${f.sizeFormatted})`)
          .join("\n");
        directDownloadLinks = `\n\n🌐 *Direct Web Download (Full Uncut):*\n${linksList}`;
      }

      await telegramService.sendMessage(
        chatId,
        `✅ *Download & Delivery Complete!*\n\n` +
          `• *Files delivered:* ${processedFiles.length}\n` +
          `• *Source:* ${url}` +
          directDownloadLinks
      );
    }

    job.status = "completed";
    job.progress = 100;
    job.statusText = "Completed successfully";
    job.completedAt = Date.now();
    job.logs.push(`[${new Date().toLocaleTimeString()}] Finished job processing`);
    saveJobs();
  } catch (err: any) {
    console.error("Job processing failed:", err);
    job.status = "failed";
    job.error = err.message || "Unknown download error";
    job.statusText = `Failed: ${job.error}`;
    job.logs.push(`[${new Date().toLocaleTimeString()}] Error: ${job.error}`);
    saveJobs();

    if (chatId && telegramService) {
      await telegramService.sendMessage(
        chatId,
        `❌ *Download Failed*\n\n` +
          `*Error:* ${job.error}\n\n` +
          `💡 *Tip:* Ensure the link is valid and publicly shared without restricted password.`
      );
    }
  }

  return job;
}

// Initialize Telegram bot info on startup
updateBotInfo().then(() => {
  if (botToken) {
    startPolling();
  }
});

// ==========================================
// REST API ROUTES
// ==========================================

app.get("/api/status", (req, res) => {
  const status: BotStatus = {
    hasToken: !!botToken,
    tokenMasked: botToken
      ? `${botToken.slice(0, 4)}...${botToken.slice(-4)}`
      : undefined,
    isOnline: !!botInfo,
    isPolling,
    botInfo: botInfo
      ? {
          id: botInfo.id,
          username: botInfo.username,
          first_name: botInfo.first_name,
          can_join_groups: botInfo.can_join_groups,
        }
      : undefined,
    hasApiCredentials: !!(apiId && apiHash),
    uploadLimitMb: apiId && apiHash ? 2000 : 50,
    dataDir: DATA_DIR,
    totalJobsCount: jobs.length,
    completedJobsCount: jobs.filter((j) => j.status === "completed").length,
  };
  res.json(status);
});

app.post("/api/bot/config", async (req, res) => {
  const { token, newApiId, newApiHash } = req.body;
  if (token !== undefined) {
    botToken = token.trim();
  }
  if (newApiId !== undefined) {
    apiId = newApiId.trim();
  }
  if (newApiHash !== undefined) {
    apiHash = newApiHash.trim();
  }

  await updateBotInfo();
  initMTProto();
  if (botToken && !isPolling) {
    startPolling();
  } else if (!botToken && isPolling) {
    stopPolling();
  }

  res.json({ success: true, isOnline: !!botInfo, botInfo });
});

app.post("/api/bot/toggle-polling", (req, res) => {
  if (!botToken) {
    return res.status(400).json({ error: "Telegram Bot Token is not set." });
  }
  if (isPolling) {
    stopPolling();
  } else {
    startPolling();
  }
  res.json({ isPolling });
});

app.post("/api/bot/test", async (req, res) => {
  const { token } = req.body;
  const testToken = token || botToken;
  if (!testToken) {
    return res.status(400).json({ error: "No token provided" });
  }
  try {
    const svc = new TelegramService(testToken);
    const info = await svc.getMe();
    res.json({ success: true, info });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post("/api/terabox/resolve", async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }
  if (!isTeraboxUrl(url)) {
    return res.status(400).json({ error: "URL does not match supported TeraBox domains" });
  }
  try {
    const meta = await resolveTeraboxLink(url);
    res.json(meta);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/jobs", async (req, res) => {
  const { url, chatId } = req.body;
  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }
  if (!isTeraboxUrl(url)) {
    return res.status(400).json({ error: "Invalid TeraBox URL format" });
  }

  if (req.headers.host) {
    const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "http";
    appPublicUrl = `${proto}://${req.headers.host}`;
  }

  const cleanUrl = extractUrlFromText(url) || url;
  const job = await executeDownloadJob(cleanUrl, chatId);
  res.json(job);
});

app.get("/api/jobs", (req, res) => {
  res.json(jobs);
});

app.get("/api/jobs/:id", (req, res) => {
  const job = jobs.find((j) => j.id === req.params.id);
  if (!job) {
    return res.status(400).json({ error: "Job not found" });
  }
  res.json(job);
});

app.get("/api/downloads/:jobId/:fileIndex", (req, res) => {
  try {
    const { jobId, fileIndex } = req.params;
    let job = jobs.find((j) => j.id === jobId);

    // If job not in memory, check persisted jobs on disk
    if (!job) {
      const persisted = loadJobs();
      job = persisted.find((j) => j.id === jobId);
    }

    const idx = parseInt(fileIndex, 10);
    let filePath: string | null = null;
    let filename: string = "download.mp4";

    if (job && job.files && job.files[idx]) {
      const file = job.files[idx];
      filePath = file.path;
      filename = file.filename;
    } else {
      // Fallback: check download folder directly
      const folderPath = path.join(DOWNLOADS_DIR, jobId);
      if (fs.existsSync(folderPath)) {
        const dirFiles = fs.readdirSync(folderPath);
        if (dirFiles.length > 0) {
          const chosen = dirFiles[idx] || dirFiles[0];
          filePath = path.join(folderPath, chosen);
          filename = chosen;
        }
      }
    }

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).send("Requested file was not found on the server");
    }

    const stat = fs.statSync(filePath);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader("Content-Type", filename.endsWith(".mp4") ? "video/mp4" : "application/octet-stream");
    res.setHeader("Content-Length", stat.size);

    const stream = fs.createReadStream(filePath);
    stream.on("error", (err) => {
      console.error("Stream download error:", err);
      if (!res.headersSent) {
        res.status(500).send("Error streaming file");
      }
    });
    stream.pipe(res);
  } catch (err: any) {
    console.error("Download route error:", err);
    if (!res.headersSent) {
      res.status(500).send(`Server error: ${err.message}`);
    }
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", bot: botInfo?.username || "unknown", uptime: process.uptime() });
});

app.post("/api/telegram/webhook", async (req, res) => {
  // Webhook handler support
  const update = req.body;
  if (update?.message?.text && isTeraboxUrl(update.message.text)) {
    const chatId = update.message.chat.id;
    const url = extractUrlFromText(update.message.text) || update.message.text;
    executeDownloadJob(url, chatId).catch(console.error);
  }
  res.json({ ok: true });
});

// ==========================================
// Vite / Static Middleware Setup
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", async () => {
    console.log(`🚀 TeraBox Telegram Bot Server running on http://0.0.0.0:${PORT}`);
    await updateBotInfo();
    if (botToken) {
      startPolling();
    }
  });
}

startServer();

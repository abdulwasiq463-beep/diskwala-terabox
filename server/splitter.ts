import { exec } from "child_process";
import fs from "fs";
import path from "path";
import util from "util";

const execPromise = util.promisify(exec);

export const MAX_TELEGRAM_FILE_SIZE = 48 * 1024 * 1024; // 48MB safe boundary for Telegram Bot API

export interface SplitFilePart {
  path: string;
  filename: string;
  size: number;
  isVideo: boolean;
}

/**
 * Gets video duration in seconds using ffprobe
 */
export async function getVideoDuration(videoPath: string): Promise<number> {
  try {
    const { stdout } = await execPromise(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`
    );
    const dur = parseFloat(stdout.trim());
    return isNaN(dur) ? 0 : dur;
  } catch (err) {
    console.warn("ffprobe duration check failed:", err);
    return 0;
  }
}

/**
 * Splits a video file into multiple valid, standalone MP4 parts using ffmpeg stream copy (-c copy).
 * No re-encoding is performed, so it takes ~1 second and preserves 100% original quality.
 */
export async function splitVideo(
  videoPath: string,
  outputDir: string,
  maxSizeBytes = MAX_TELEGRAM_FILE_SIZE
): Promise<SplitFilePart[]> {
  const stats = fs.statSync(videoPath);
  if (stats.size <= maxSizeBytes) {
    return [
      {
        path: videoPath,
        filename: path.basename(videoPath),
        size: stats.size,
        isVideo: true,
      },
    ];
  }

  const duration = await getVideoDuration(videoPath);
  const ext = path.extname(videoPath) || ".mp4";
  const baseName = path.basename(videoPath, ext);
  const partsDir = path.join(outputDir, `parts_${Date.now()}`);
  fs.mkdirSync(partsDir, { recursive: true });

  // Calculate needed parts based on file size
  const estimatedParts = Math.ceil(stats.size / (maxSizeBytes * 0.9));
  
  if (duration > 0 && estimatedParts > 1) {
    // Determine segment time in seconds (slightly smaller than proportional to ensure each part is < maxSizeBytes)
    let segmentTime = Math.max(2, Math.floor(duration / estimatedParts));

    // Try segmenting
    const tempPattern = path.join(partsDir, `seg_%03d${ext}`);
    const cmd = `ffmpeg -y -i "${videoPath}" -c copy -map 0 -segment_time ${segmentTime} -f segment -reset_timestamps 1 "${tempPattern}"`;
    
    try {
      await execPromise(cmd);
      const generatedFiles = fs
        .readdirSync(partsDir)
        .filter((f) => f.startsWith("seg_") && f.endsWith(ext))
        .sort();

      if (generatedFiles.length > 1) {
        // Verify all parts are within maxSizeBytes
        const areAllUnderLimit = generatedFiles.every((f) => {
          const fStat = fs.statSync(path.join(partsDir, f));
          return fStat.size <= maxSizeBytes;
        });

        if (areAllUnderLimit) {
          const totalCount = generatedFiles.length;
          const finalParts: SplitFilePart[] = [];

          for (let i = 0; i < totalCount; i++) {
            const oldFile = generatedFiles[i];
            const oldFilePath = path.join(partsDir, oldFile);
            const partNum = i + 1;
            const newFilename = `${baseName}.Part_${partNum}_of_${totalCount}${ext}`;
            const newFilePath = path.join(partsDir, newFilename);
            fs.renameSync(oldFilePath, newFilePath);
            const partSize = fs.statSync(newFilePath).size;

            finalParts.push({
              path: newFilePath,
              filename: newFilename,
              size: partSize,
              isVideo: true,
            });
          }

          return finalParts;
        }
      }
    } catch (err) {
      console.warn("ffmpeg segmentation attempt failed, falling back to byte chunking:", err);
    }
  }

  // Fallback: Binary chunking if ffmpeg segmenting fails or duration is 0
  return splitBinaryFile(videoPath, outputDir, maxSizeBytes);
}

/**
 * Splits any non-video file (or fallback binary) into parts under maxSizeBytes
 */
export async function splitBinaryFile(
  filePath: string,
  outputDir: string,
  maxSizeBytes = MAX_TELEGRAM_FILE_SIZE
): Promise<SplitFilePart[]> {
  const stats = fs.statSync(filePath);
  if (stats.size <= maxSizeBytes) {
    return [
      {
        path: filePath,
        filename: path.basename(filePath),
        size: stats.size,
        isVideo: false,
      },
    ];
  }

  const baseFilename = path.basename(filePath);
  const partsDir = path.join(outputDir, `parts_${Date.now()}`);
  fs.mkdirSync(partsDir, { recursive: true });

  const parts: SplitFilePart[] = [];
  const chunkSize = Math.max(1024, maxSizeBytes > 64 * 1024 ? maxSizeBytes - 64 * 1024 : maxSizeBytes);

  const fileFd = fs.openSync(filePath, "r");
  const buffer = Buffer.alloc(chunkSize);

  try {
    let bytesRead = 0;
    let partIndex = 1;
    let position = 0;

    while (position < stats.size) {
      bytesRead = fs.readSync(fileFd, buffer, 0, chunkSize, position);
      if (bytesRead <= 0) break;

      const partFilename = `${baseFilename}.part${String(partIndex).padStart(3, "0")}`;
      const partPath = path.join(partsDir, partFilename);
      fs.writeFileSync(partPath, buffer.subarray(0, bytesRead));

      parts.push({
        path: partPath,
        filename: partFilename,
        size: bytesRead,
        isVideo: false,
      });

      position += bytesRead;
      partIndex++;
    }
  } finally {
    fs.closeSync(fileFd);
  }

  return parts;
}

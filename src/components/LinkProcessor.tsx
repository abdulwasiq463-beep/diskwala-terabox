import React, { useState } from "react";
import {
  Link2,
  ArrowRight,
  Download,
  Search,
  Send,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Film,
  Archive,
} from "lucide-react";
import type { ResolvedMetadata } from "../../server/terabox.ts";

interface LinkProcessorProps {
  onStartJob: (url: string, chatId?: string) => Promise<void>;
  isProcessing: boolean;
  botOnline: boolean;
}

export const LinkProcessor: React.FC<LinkProcessorProps> = ({
  onStartJob,
  isProcessing,
  botOnline,
}) => {
  const [url, setUrl] = useState("");
  const [chatId, setChatId] = useState("");
  const [sendToTelegram, setSendToTelegram] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [previewMeta, setPreviewMeta] = useState<ResolvedMetadata | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const isTeraUrl =
    url.trim().length > 5 &&
    /(?:terabox|terashare|terafileshare|1024tera|1024-tera|tera-box|nephobox|mirrobox|mirrorbox|momerybox|tibibox|gibibox|pebibox|4funbox|dubox|bestclouddrive|\/s\/1|\?surl=)/i.test(
      url
    );

  const handleResolve = async () => {
    if (!url.trim()) return;
    setResolving(true);
    setResolveError(null);
    setPreviewMeta(null);
    try {
      const res = await fetch("/api/terabox/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to inspect TeraBox link");
      }
      setPreviewMeta(data);
    } catch (err: any) {
      setResolveError(err.message || "Failed to inspect link");
    } finally {
      setResolving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || isProcessing) return;
    await onStartJob(
      url.trim(),
      sendToTelegram && chatId.trim() ? chatId.trim() : undefined
    );
    setUrl("");
    setPreviewMeta(null);
  };

  const sampleLinks = [
    "https://teraboxlink.com/s/1DAl-MoEEm0pWq-a99E0q6A",
    "https://terasharefile.com/s/1Alpi7d3K8hmStQ9IvnIlTA",
  ];

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-100 flex items-center space-x-2">
            <Link2 className="w-5 h-5 text-blue-400" />
            <span>Process TeraBox Link</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Download files, unpack ZIP archives, and forward to Telegram or browser
          </p>
        </div>

        {url.trim() && (
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center space-x-1 ${
              isTeraUrl
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
            }`}
          >
            {isTeraUrl ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>TeraBox Match</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Format check</span>
              </>
            )}
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste TeraBox share link (e.g. https://terabox.app/s/1... or 1024tera.com/...)"
            className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>

        {/* Telegram Chat Delivery toggle */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="flex items-center space-x-3 bg-slate-950/40 border border-slate-800/80 rounded-xl p-3">
            <input
              type="checkbox"
              id="sendToTelegram"
              checked={sendToTelegram}
              onChange={(e) => setSendToTelegram(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-blue-500 focus:ring-blue-500"
            />
            <label
              htmlFor="sendToTelegram"
              className="text-xs text-slate-300 select-none cursor-pointer flex-1"
            >
              <span className="font-medium block text-slate-200">
                Forward to Telegram Chat
              </span>
              <span className="text-slate-400">
                {botOnline ? "Bot connected & ready" : "Cloud bot or web download"}
              </span>
            </label>
          </div>

          {sendToTelegram && (
            <div className="flex items-center bg-slate-950/40 border border-slate-800/80 rounded-xl px-3 py-2">
              <Send className="w-4 h-4 text-blue-400 mr-2 shrink-0" />
              <input
                type="text"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="Telegram Chat ID (optional)"
                className="w-full bg-transparent text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="submit"
            disabled={!url.trim() || isProcessing}
            className="flex-1 min-w-[160px] bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-medium text-xs sm:text-sm py-2.5 px-4 rounded-xl shadow-lg shadow-blue-600/20 transition flex items-center justify-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>{isProcessing ? "Processing..." : "Start Download & Process"}</span>
          </button>

          <button
            type="button"
            onClick={handleResolve}
            disabled={!url.trim() || resolving}
            className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs sm:text-sm font-medium py-2.5 px-4 rounded-xl border border-slate-700 transition flex items-center space-x-1.5"
          >
            <Search className={`w-4 h-4 ${resolving ? "animate-spin" : ""}`} />
            <span>{resolving ? "Inspecting..." : "Inspect Link"}</span>
          </button>
        </div>
      </form>

      {/* Quick sample chips */}
      <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center flex-wrap gap-2">
        <span className="text-xs text-slate-500 mr-1">Try sample:</span>
        {sampleLinks.map((sample, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setUrl(sample)}
            className="text-xs font-mono bg-slate-800/70 hover:bg-slate-800 text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded-md border border-slate-700/60 transition"
          >
            {sample.replace("https://", "")}
          </button>
        ))}
      </div>

      {/* Preview metadata section if inspected */}
      {previewMeta && (
        <div className="mt-4 p-4 bg-slate-950/80 border border-blue-500/20 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
              Link Inspection Result
            </span>
            <span className="text-xs text-slate-400">
              {previewMeta.files.length} item(s) found
            </span>
          </div>

          <h3 className="text-sm font-medium text-slate-200 mb-2 truncate">
            📁 {previewMeta.title}
          </h3>

          <div className="space-y-1.5">
            {previewMeta.files.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs bg-slate-900/60 p-2 rounded-lg border border-slate-800/80"
              >
                <div className="flex items-center space-x-2 truncate">
                  {file.isVideo ? (
                    <Film className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  ) : file.isZip ? (
                    <Archive className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  ) : (
                    <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  )}
                  <span className="text-slate-300 truncate">{file.filename}</span>
                </div>
                <span className="text-slate-400 font-mono ml-2 shrink-0">
                  {file.sizeFormatted}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {resolveError && (
        <div className="mt-4 p-3 bg-red-950/40 border border-red-900/60 rounded-xl text-xs text-red-300 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{resolveError}</span>
        </div>
      )}
    </div>
  );
};

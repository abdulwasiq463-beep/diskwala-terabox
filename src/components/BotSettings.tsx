import React, { useState } from "react";
import {
  X,
  Key,
  Shield,
  Radio,
  CheckCircle,
  AlertCircle,
  HardDrive,
  Info,
} from "lucide-react";
import type { BotStatus } from "../types.ts";

interface BotSettingsProps {
  status: BotStatus | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveConfig: (token: string, apiId: string, apiHash: string) => Promise<void>;
  onTogglePolling: () => Promise<void>;
}

export const BotSettings: React.FC<BotSettingsProps> = ({
  status,
  isOpen,
  onClose,
  onSaveConfig,
  onTogglePolling,
}) => {
  const [token, setToken] = useState("");
  const [apiId, setApiId] = useState("");
  const [apiHash, setApiHash] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleTestToken = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/bot/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() || undefined }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({
          success: true,
          message: `Connected successfully as @${data.info.username} (${data.info.first_name})`,
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || "Failed to authenticate bot token with Telegram",
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "Network test failed",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSaveConfig(token, apiId, apiHash);
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">
                Telegram Bot Configuration
              </h3>
              <p className="text-xs text-slate-400">
                Credentials and delivery server preferences
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4 text-xs">
          {/* Status summary box */}
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Current Bot Status:</span>
              <span
                className={`font-medium px-2 py-0.5 rounded-full ${
                  status?.isOnline
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-amber-500/10 text-amber-400"
                }`}
              >
                {status?.isOnline
                  ? `@${status.botInfo?.username} (Online)`
                  : status?.hasToken
                  ? "Configured"
                  : "Needs Token"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Upload Limit:</span>
              <span className="text-slate-200 font-mono">
                {status?.uploadLimitMb || 50} MB
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Polling Listener:</span>
              <button
                type="button"
                onClick={onTogglePolling}
                disabled={!status?.hasToken && !token}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition ${
                  status?.isPolling
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                    : "bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700"
                }`}
              >
                <Radio className={`w-3.5 h-3.5 ${status?.isPolling ? "animate-pulse" : ""}`} />
                <span>{status?.isPolling ? "Active (Listening)" : "Start Polling"}</span>
              </button>
            </div>
          </div>

          {/* TELEGRAM_BOT_TOKEN */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-medium flex items-center justify-between">
              <span>TELEGRAM_BOT_TOKEN</span>
              {status?.tokenMasked && (
                <span className="text-slate-500 font-mono text-[11px]">
                  Loaded: {status.tokenMasked}
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Enter 123456789:ABCdef..."
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Obtained from @BotFather on Telegram. You can also configure via .env.
            </p>
          </div>

          {/* Optional Local Bot API fields */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <label className="text-slate-300 font-medium">TELEGRAM_API_ID (optional)</label>
              <input
                type="text"
                value={apiId}
                onChange={(e) => setApiId(e.target.value)}
                placeholder="e.g. 1234567"
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-300 font-medium">TELEGRAM_API_HASH (optional)</label>
              <input
                type="password"
                value={apiHash}
                onChange={(e) => setApiHash(e.target.value)}
                placeholder="e.g. abcdef123..."
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Test connection alert */}
          {testResult && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center space-x-2 ${
                testResult.success
                  ? "bg-emerald-950/40 border-emerald-800/80 text-emerald-300"
                  : "bg-red-950/40 border-red-800/80 text-red-300"
              }`}
            >
              {testResult.success ? (
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleTestToken}
              disabled={testing}
              className="bg-slate-800 hover:bg-slate-750 text-slate-200 font-medium px-3.5 py-2 rounded-xl border border-slate-700 transition flex items-center space-x-1.5"
            >
              <Key className="w-3.5 h-3.5" />
              <span>{testing ? "Testing..." : "Test Token"}</span>
            </button>

            <div className="flex space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 rounded-xl text-slate-400 hover:text-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-2 rounded-xl transition"
              >
                {saving ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from "react";
import { Radio, Bot, CheckCircle2, ShieldCheck, Terminal, Copy, Check } from "lucide-react";
import type { BotStatus } from "./types.ts";

export default function App() {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err) {
      console.error("Status fetch error:", err);
    }
  };

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(fetchStatus, 3000);
    return () => clearInterval(timer);
  }, []);

  const botHandle = status?.botInfo?.username ? `@${status.botInfo.username}` : "Telegram Bot";

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 selection:bg-blue-600 selection:text-white font-mono">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-slate-100 tracking-wide">
                TeraBox Telegram Service
              </h1>
              <p className="text-[11px] text-slate-400">Headless Backend Daemon</p>
            </div>
          </div>
          <div className="flex items-center space-x-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full text-xs">
            <Radio className="w-3 h-3 animate-pulse" />
            <span>ONLINE</span>
          </div>
        </div>

        {/* Telegram Bot Details */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3.5 space-y-2 text-xs">
          <div className="flex justify-between items-center text-slate-400">
            <span>Bot Username:</span>
            <span className="text-blue-400 font-semibold">{botHandle}</span>
          </div>
          <div className="flex justify-between items-center text-slate-400">
            <span>Engine Mode:</span>
            <span className="text-slate-200">Telegram Polling Daemon</span>
          </div>
          <div className="flex justify-between items-center text-slate-400">
            <span>MTProto 2 GB Upload:</span>
            <span className={status?.hasApiCredentials ? "text-emerald-400 font-semibold" : "text-amber-400"}>
              {status?.hasApiCredentials ? "Enabled (GramJS MTProto)" : "Ready (Needs API ID/Hash)"}
            </span>
          </div>
          <div className="flex justify-between items-center text-slate-400">
            <span>50 MB Splitter Fallback:</span>
            <span className="text-emerald-400">Active (Lossless -c copy)</span>
          </div>
          <div className="flex justify-between items-center text-slate-400">
            <span>Zip Unpacker:</span>
            <span className="text-emerald-400">Active</span>
          </div>
          <div className="flex justify-between items-center text-slate-400">
            <span>Jobs Handled:</span>
            <span className="text-slate-200 font-bold">{status?.completedJobsCount ?? 0}</span>
          </div>
        </div>

        {/* How to use */}
        <div className="space-y-2">
          <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
            How to use:
          </p>
          <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3 text-xs text-slate-300 space-y-1.5">
            <p>1. Open Telegram and search for:</p>
            <div className="flex items-center justify-between bg-slate-900 px-2.5 py-1.5 rounded border border-slate-800 font-mono text-blue-400">
              <span>{botHandle}</span>
              <button
                onClick={() => handleCopy(botHandle)}
                className="text-slate-400 hover:text-slate-200 transition-colors"
                title="Copy username"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="pt-1">2. Paste any TeraBox link to download directly in Telegram.</p>
          </div>
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-800/60">
          <div className="flex items-center space-x-1">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
            <span>Health: 200 OK</span>
          </div>
          <div className="flex items-center space-x-1">
            <Terminal className="w-3.5 h-3.5 text-slate-400" />
            <span>Port 3000</span>
          </div>
        </div>
      </div>
    </div>
  );
}

import React from "react";
import { Bot, Radio, ShieldCheck, ShieldAlert, RefreshCw } from "lucide-react";
import type { BotStatus } from "../types.ts";

interface HeaderProps {
  status: BotStatus | null;
  loading: boolean;
  onRefresh: () => void;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  loading,
  onRefresh,
  onOpenSettings,
}) => {
  return (
    <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-semibold text-slate-100 text-base sm:text-lg tracking-tight">
                TeraBox Telegram Bot
              </h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                v2.0 Web Engine
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Cloud link resolver, zip auto-unpacker, and Telegram delivery runner
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {status && (
            <div className="hidden md:flex items-center space-x-2 bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-1.5 text-xs">
              <div
                className={`w-2 h-2 rounded-full ${
                  status.isOnline
                    ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)] animate-pulse"
                    : status.hasToken
                    ? "bg-amber-400"
                    : "bg-slate-500"
                }`}
              />
              <span className="text-slate-300 font-medium">
                {status.isOnline
                  ? `@${status.botInfo?.username}`
                  : status.hasToken
                  ? "Token Configured"
                  : "Bot Standby"}
              </span>

              {status.isPolling && (
                <span className="flex items-center space-x-1 text-emerald-400 font-semibold ml-2 border-l border-slate-700 pl-2">
                  <Radio className="w-3 h-3 animate-pulse" />
                  <span>Polling</span>
                </span>
              )}
            </div>
          )}

          <button
            onClick={onRefresh}
            disabled={loading}
            title="Refresh status"
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-750 text-slate-400 hover:text-slate-200 border border-slate-700/60 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={onOpenSettings}
            className="flex items-center space-x-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-2 rounded-lg transition"
          >
            {status?.isOnline ? (
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-amber-400" />
            )}
            <span>Bot Settings</span>
          </button>
        </div>
      </div>
    </header>
  );
};

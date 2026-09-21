import React, { useState, useEffect } from "react";
import { Header } from "./components/Header.tsx";
import { LinkProcessor } from "./components/LinkProcessor.tsx";
import { JobsList } from "./components/JobsList.tsx";
import { BotSettings } from "./components/BotSettings.tsx";
import { SupportedMirrors } from "./components/SupportedMirrors.tsx";
import type { BotStatus, DownloadJob } from "./types.ts";
import {
  DownloadCloud,
  CheckCircle2,
  HardDrive,
  Radio,
  Zap,
} from "lucide-react";

export default function App() {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err) {
      console.error("Failed to fetch status:", err);
    }
  };

  const fetchJobs = async () => {
    try {
      const res = await fetch("/api/jobs");
      if (res.ok) {
        const data = await res.json();
        setJobs(data);
      }
    } catch (err) {
      console.error("Failed to fetch jobs:", err);
    }
  };

  const refreshAll = async () => {
    setLoading(true);
    await Promise.all([fetchStatus(), fetchJobs()]);
    setLoading(false);
  };

  useEffect(() => {
    refreshAll();
    const interval = setInterval(() => {
      fetchStatus();
      fetchJobs();
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const handleStartJob = async (url: string, chatId?: string) => {
    setIsProcessing(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, chatId }),
      });
      const newJob = await res.json();
      if (res.ok) {
        setJobs((prev) => [newJob, ...prev.filter((j) => j.id !== newJob.id)]);
      }
    } catch (err) {
      console.error("Failed to submit job:", err);
    } finally {
      setIsProcessing(false);
      fetchJobs();
    }
  };

  const handleSaveConfig = async (
    token: string,
    newApiId: string,
    newApiHash: string
  ) => {
    try {
      await fetch("/api/bot/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newApiId, newApiHash }),
      });
      await fetchStatus();
    } catch (err) {
      console.error("Failed to save config:", err);
    }
  };

  const handleTogglePolling = async () => {
    try {
      const res = await fetch("/api/bot/toggle-polling", {
        method: "POST",
      });
      if (res.ok) {
        await fetchStatus();
      }
    } catch (err) {
      console.error("Failed to toggle polling:", err);
    }
  };

  const activeJobsCount = jobs.filter(
    (j) => j.status !== "completed" && j.status !== "failed"
  ).length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans">
      <Header
        status={status}
        loading={loading}
        onRefresh={refreshAll}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Top metrics bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center space-x-3">
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 shrink-0">
              <DownloadCloud className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Active Tasks</p>
              <p className="text-lg font-bold text-slate-100">{activeJobsCount}</p>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center space-x-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Completed</p>
              <p className="text-lg font-bold text-slate-100">
                {status?.completedJobsCount ?? 0}
              </p>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center space-x-3">
            <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-400 shrink-0">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Upload Limit</p>
              <p className="text-lg font-bold text-slate-100 font-mono">
                {status?.uploadLimitMb || 50} MB
              </p>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center space-x-3">
            <div
              className={`p-2.5 rounded-lg shrink-0 ${
                status?.isPolling
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              <Radio
                className={`w-5 h-5 ${status?.isPolling ? "animate-pulse" : ""}`}
              />
            </div>
            <div>
              <p className="text-xs text-slate-400">Telegram Poller</p>
              <p className="text-sm font-semibold text-slate-100">
                {status?.isPolling ? "Listening" : "Standby"}
              </p>
            </div>
          </div>
        </div>

        {/* Main interactive grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 space-y-6">
            <LinkProcessor
              onStartJob={handleStartJob}
              isProcessing={isProcessing}
              botOnline={!!status?.isOnline}
            />
            <SupportedMirrors />
          </div>

          <div className="lg:col-span-6 space-y-6">
            <JobsList jobs={jobs} loading={loading} />
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-900 bg-slate-950/60 py-4 text-center text-xs text-slate-500">
        <p>
          TeraBox Telegram Bot &bull; Node.js High-Performance Runner &bull; Cloud
          compatible
        </p>
      </footer>

      <BotSettings
        status={status}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaveConfig={handleSaveConfig}
        onTogglePolling={handleTogglePolling}
      />
    </div>
  );
}

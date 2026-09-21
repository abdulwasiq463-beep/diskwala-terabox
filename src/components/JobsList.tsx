import React, { useState } from "react";
import {
  DownloadCloud,
  CheckCircle,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronUp,
  Download,
  Film,
  Archive,
  FileText,
  Terminal,
} from "lucide-react";
import type { DownloadJob } from "../types.ts";

interface JobsListProps {
  jobs: DownloadJob[];
  loading: boolean;
}

export const JobsList: React.FC<JobsListProps> = ({ jobs, loading }) => {
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedJobId(expandedJobId === id ? null : id);
  };

  const getStatusBadge = (status: DownloadJob["status"]) => {
    switch (status) {
      case "completed":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completed
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Failed
          </span>
        );
      case "unpacking":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
            <Archive className="w-3 h-3 mr-1" />
            Unpacking ZIP
          </span>
        );
      case "uploading":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 animate-pulse">
            <DownloadCloud className="w-3 h-3 mr-1" />
            Sending to Telegram
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse">
            <Clock className="w-3 h-3 mr-1" />
            {status}
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-100 flex items-center space-x-2">
            <DownloadCloud className="w-5 h-5 text-blue-400" />
            <span>Download & Processing Queue</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time status of downloads, extracted archive files, and Telegram delivery
          </p>
        </div>
        <span className="text-xs text-slate-500 font-mono">
          {jobs.length} total tasks
        </span>
      </div>

      {jobs.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
          <DownloadCloud className="w-10 h-10 text-slate-600 mx-auto mb-2 opacity-60" />
          <p className="text-sm text-slate-400">No active or past download jobs yet</p>
          <p className="text-xs text-slate-600 mt-1">
            Paste a TeraBox link above or send a message to the bot on Telegram
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const isExpanded = expandedJobId === job.id;
            return (
              <div
                key={job.id}
                className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 transition hover:border-slate-700/80"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center space-x-2 truncate">
                    <span className="text-xs font-mono text-slate-500 shrink-0">
                      {new Date(job.createdAt).toLocaleTimeString()}
                    </span>
                    <span className="text-xs font-medium text-slate-200 truncate" title={job.url}>
                      {job.url}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 shrink-0">
                    {getStatusBadge(job.status)}
                    <button
                      onClick={() => toggleExpand(job.id)}
                      className="text-slate-400 hover:text-slate-200 p-1 rounded transition"
                      title="Toggle details"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                {job.status !== "completed" && job.status !== "failed" && (
                  <div className="space-y-1 my-2">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>{job.statusText}</span>
                      <span className="font-mono">{job.progress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-300"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Files section */}
                {job.files && job.files.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-800/60 space-y-2">
                    <div className="text-xs font-medium text-slate-400 flex items-center justify-between">
                      <span>Extracted Content ({job.files.length} items):</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {job.files.map((file, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs"
                        >
                          <div className="flex items-center space-x-2 truncate mr-2">
                            {file.isVideo ? (
                              <Film className="w-4 h-4 text-purple-400 shrink-0" />
                            ) : file.isZip ? (
                              <Archive className="w-4 h-4 text-amber-400 shrink-0" />
                            ) : (
                              <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                            )}
                            <div className="truncate">
                              <p className="text-slate-200 font-medium truncate" title={file.filename}>
                                {file.filename}
                              </p>
                              <div className="flex items-center space-x-1.5 mt-0.5">
                                <span className="text-slate-500 text-[10px] font-mono">
                                  {file.sizeFormatted}
                                </span>
                                {file.splitPartsCount && file.splitPartsCount > 1 ? (
                                  <span className="text-[9px] bg-blue-500/15 text-blue-400 border border-blue-500/30 px-1 rounded font-medium">
                                    {file.splitPartsCount} parts on TG
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>

                          {file.path && (
                            <a
                              href={`/api/downloads/${job.id}/${idx}`}
                              download={file.filename}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-md border border-slate-700/60 transition shrink-0"
                              title="Download to browser"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Collapsible logs */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-800/80">
                    <div className="flex items-center space-x-1.5 text-xs text-slate-400 mb-1.5">
                      <Terminal className="w-3.5 h-3.5 text-slate-500" />
                      <span className="font-semibold uppercase tracking-wider text-[10px]">
                        Execution Logs
                      </span>
                    </div>
                    <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 font-mono text-[11px] text-slate-300 max-h-40 overflow-y-auto space-y-1">
                      {job.logs.map((log, i) => (
                        <div key={i} className="leading-relaxed">
                          {log}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

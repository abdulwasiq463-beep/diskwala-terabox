import React from "react";
import { Globe, FileCheck, Layers, Check } from "lucide-react";

export const SupportedMirrors: React.FC = () => {
  const mirrors = [
    "terabox.app",
    "terabox.com",
    "teraboxlink.com",
    "1024tera.com",
    "1024terabox.com",
    "terasharefile.com",
    "terasharelink.com",
    "terafileshare.com",
    "nephobox.com",
    "mirrobox.com",
    "4funbox.com",
    "dubox.com",
    "momerybox.com",
    "bestclouddrive.com",
  ];

  const features = [
    {
      title: "Automatic ZIP Unpacking",
      desc: "Archives (.zip, .rar, .7z) are extracted to deliver individual clean files directly.",
    },
    {
      title: "Video Streaming Support",
      desc: "Video files (.mp4, .mov, .mkv, .webm) are tagged with streaming flags for instant in-app playback.",
    },
    {
      title: "Magic-Bytes Header Detection",
      desc: "Inspects true binary file headers so extensions are accurately resolved even if obfuscated.",
    },
    {
      title: "Live Telegram Delivery",
      desc: "Uploads files directly to private Telegram chats or channels with real-time status captions.",
    },
  ];

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl backdrop-blur-sm space-y-6">
      <div>
        <h3 className="text-base font-semibold text-slate-100 flex items-center space-x-2">
          <Globe className="w-5 h-5 text-blue-400" />
          <span>Supported TeraBox Mirrors & Domains</span>
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          The bot automatically detects and standardizes URLs across all official and third-party mirrors
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {mirrors.map((mirror, idx) => (
            <span
              key={idx}
              className="text-xs font-mono bg-slate-950/60 text-slate-300 border border-slate-800 px-2.5 py-1 rounded-md"
            >
              {mirror}
            </span>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-800/80 pt-5">
        <h3 className="text-base font-semibold text-slate-100 flex items-center space-x-2 mb-3">
          <Layers className="w-5 h-5 text-purple-400" />
          <span>Engine Capabilities</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {features.map((feat, idx) => (
            <div
              key={idx}
              className="p-3 bg-slate-950/50 border border-slate-800/70 rounded-xl space-y-1"
            >
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                  <Check className="w-2.5 h-2.5" />
                </div>
                <h4 className="text-xs font-semibold text-slate-200">{feat.title}</h4>
              </div>
              <p className="text-[11px] text-slate-400 pl-6">{feat.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

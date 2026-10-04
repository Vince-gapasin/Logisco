"use client";

import { X, Download } from "lucide-react";

// ==========================================
// IMAGE LIGHTBOX MODAL
// ==========================================
export function ImageModal({ src, onClose }: { src: string; onClose: () => void }) {
  if (!src) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      
      {/* Top Right Controls*/}
      <div className="absolute top-6 right-6 flex items-center gap-3">
        <a
          href={src}
          download="maintenance_attachment.jpg"
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-lg cursor-pointer"
        >
          <Download className="w-4 h-4" /> Download
        </a>

        <button
          onClick={onClose}
          className="min-w-tap min-h-tap md:pointer-fine:min-w-0 md:pointer-fine:min-h-0 inline-flex items-center justify-center p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors cursor-pointer"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <img
        src={src}
        alt="Zoomed View"
        className="max-w-full max-h-[85dvh] object-contain rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

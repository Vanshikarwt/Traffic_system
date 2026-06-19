"use client";

import React, { useState, useRef, DragEvent } from "react";
import { X, Upload, Film, Loader2, Check, AlertTriangle } from "lucide-react";

interface VideoUploadModalProps {
  onClose: () => void;
  onSuccess: (intersectionId: number, logData: any) => void;
  token: string | null;
}

const INTERSECTIONS = [
  { id: 1, name: "Intersection A (Broadway & 42nd)" },
  { id: 2, name: "Intersection B (5th Ave & 34th)" },
  { id: 3, name: "Intersection C (FDR Drive & E 34th)" },
  { id: 4, name: "Intersection D (Madison Ave & 57th)" },
  { id: 5, name: "Intersection E (Lexington & 86th)" },
];

// Default lane polygon for analysis if none is custom-drawn
const DEFAULT_LANE_POLYGON = [
  [100.0, 100.0],
  [500.0, 100.0],
  [600.0, 400.0],
  [50.0, 400.0],
];

export default function VideoUploadModal({ onClose, onSuccess, token }: VideoUploadModalProps) {
  const [selectedIntersectionId, setSelectedIntersectionId] = useState<number>(1);
  const [file, setFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      validateAndSetFile(droppedFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    setError(null);
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension !== "mp4" && extension !== "avi") {
      setError("Supported file formats are only .mp4 and .avi");
      setFile(null);
      return;
    }
    // Limit file size to 100MB for safety
    if (file.size > 100 * 1024 * 1024) {
      setError("File size exceeds 100MB limit.");
      setFile(null);
      return;
    }
    setFile(file);
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please drop or select a traffic video file first.");
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("lane_polygon", JSON.stringify(DEFAULT_LANE_POLYGON));

    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/intersections/${selectedIntersectionId}/process`,
        {
          method: "POST",
          headers,
          body: formData,
        }
      );

      if (response.status === 401) {
        throw new Error("Unauthorized: Please log in using the header options.");
      }
      if (response.status === 403) {
        throw new Error("Forbidden: Insufficient privileges (Requires Operator or Admin role).");
      }

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || `Server responded with status: ${response.status}`);
      }

      const result = await response.json();
      onSuccess(selectedIntersectionId, result);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to process video. Please check connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-[#0b1220]/95 border border-slate-800 rounded-2xl w-full max-w-lg p-6 relative overflow-hidden flex flex-col gap-6 shadow-[0_0_50px_rgba(0,0,0,0.8)]">
        {/* Glow Top Right decoration */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex justify-between items-center border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
              <Film className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-md font-bold tracking-tight text-white font-mono uppercase">
                Ingest Traffic Video Feed
              </h2>
              <p className="text-xs text-slate-400 font-mono">PHASE 2 REAL-TIME DENSITY ENGINE</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white rounded-lg transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Loading Spinner Screen */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 font-mono">
            <div className="relative flex items-center justify-center">
              <Loader2 className="w-16 h-16 text-emerald-400 animate-spin" />
              <div className="absolute w-8 h-8 bg-emerald-500/10 rounded-full blur-md" />
            </div>
            <div className="text-center flex flex-col gap-1.5 mt-2">
              <span className="text-sm font-bold text-white tracking-widest animate-pulse">
                AI ENGINE ANALYZING FRAMES...
              </span>
              <span className="text-[10px] text-slate-500">
                DETECTING VEHICLES {"//"} CALCULATING LANE DENSITY INDEX
              </span>
            </div>
          </div>
        ) : (
          <>
            {/* Form Fields */}
            <div className="flex flex-col gap-4 font-mono text-xs">
              {/* Intersection Selection */}
              <div className="flex flex-col gap-2">
                <label className="text-slate-400 uppercase tracking-wider font-semibold">
                  Select Targeting Intersection node
                </label>
                <select
                  value={selectedIntersectionId}
                  onChange={(e) => setSelectedIntersectionId(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-4 py-3 outline-none focus:border-emerald-500/50 hover:border-slate-700/80 transition-all cursor-pointer font-sans"
                >
                  {INTERSECTIONS.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Drag and Drop Zone */}
              <div className="flex flex-col gap-2">
                <label className="text-slate-400 uppercase tracking-wider font-semibold">
                  Upload Video Feed file
                </label>
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={handleBrowseClick}
                  className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer ${
                    isDragActive
                      ? "border-emerald-500 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.1)]"
                      : file
                      ? "border-emerald-500/40 bg-slate-950/40"
                      : "border-slate-800 bg-slate-950/30 hover:border-slate-700/80 hover:bg-slate-950/60"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".mp4,.avi"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  {file ? (
                    <div className="flex flex-col items-center text-center gap-2">
                      <div className="p-3 bg-emerald-500/10 rounded-full border border-emerald-500/30">
                        <Check className="w-6 h-6 text-emerald-400" />
                      </div>
                      <span className="font-semibold text-slate-200 text-xs truncate max-w-sm">
                        {file.name}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB {"//"} CLICK TO CHANGE
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-center gap-2">
                      <div className="p-3 bg-slate-900 rounded-full border border-slate-800">
                        <Upload className="w-6 h-6 text-slate-400" />
                      </div>
                      <span className="font-semibold text-slate-300">
                        Drag and drop your traffic video feed here
                      </span>
                      <span className="text-[10px] text-slate-500 uppercase">
                        Accepts .mp4 or .avi formats {"//"} Max size 100MB
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Error Message Display */}
            {error && (
              <div className="bg-rose-950/20 border border-rose-900/30 text-rose-400 rounded-lg p-3.5 flex items-start gap-2.5 font-mono text-[11px] leading-relaxed">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex justify-end gap-3 mt-2 font-mono text-xs">
              <button
                onClick={onClose}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-lg transition-all"
              >
                CANCEL
              </button>
              <button
                onClick={handleUpload}
                disabled={!file}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-slate-900 disabled:to-slate-900 text-white disabled:text-slate-600 font-bold border border-emerald-500/20 disabled:border-slate-800 rounded-lg shadow-[0_0_15px_rgba(16,185,129,0.1)] hover:shadow-[0_0_20px_rgba(16,185,129,0.2)] disabled:shadow-none transition-all"
              >
                ANALYZE VIDEO FEED
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

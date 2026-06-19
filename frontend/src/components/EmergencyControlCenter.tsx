"use client";

import React, { useState } from "react";
import { AlertTriangle, ShieldCheck, Flame, Send, Loader2 } from "lucide-react";

interface PreemptionStatus {
  intersection_id: number;
  vehicle_type: string;
  lane: string;
  timestamp: string;
}

interface EmergencyControlCenterProps {
  activePreemption: PreemptionStatus | null;
  greenCorridorPath: number[] | null;
  onOverrideTriggered: () => void;
  token: string | null;
}

const INTERSECTIONS = [
  { id: 1, name: "Intersection A (Broadway)" },
  { id: 2, name: "Intersection B (5th Ave)" },
  { id: 3, name: "Intersection C (FDR Drive)" },
  { id: 4, name: "Intersection D (Madison Ave)" },
  { id: 5, name: "Intersection E (Lexington)" },
  { id: 6, name: "Intersection F (7th Ave)" }
];

export default function EmergencyControlCenter({
  activePreemption,
  greenCorridorPath,
  onOverrideTriggered,
  token
}: EmergencyControlCenterProps) {
  const [startNode, setStartNode] = useState<number>(1);
  const [endNode, setEndNode] = useState<number>(5);
  const [loading, setLoading] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleManualOverride = async () => {
    if (startNode === endNode) {
      setErrorMsg("Origin and Destination nodes must be different.");
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/network/green-corridor?start=${startNode}&end=${endNode}`,
        {
          headers,
        }
      );
      if (res.status === 401) {
        throw new Error("Unauthorized: Please log in using the header options.");
      }
      if (res.status === 403) {
        throw new Error("Forbidden: Insufficient privileges (Requires Operator or Admin role).");
      }
      if (!res.ok) {
        throw new Error(`Corridor error status: ${res.status}`);
      }
      const data = await res.json();
      setSuccessMsg(`Green Corridor Path: ${data.path.map((id: number) => `INT-${String.fromCharCode(64 + id)}`).join(" -> ")} activated!`);
      
      // Trigger callback in parent to fetch immediately and update the simulation UI
      onOverrideTriggered();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to schedule green corridor pre-clearance.");
    } finally {
      setLoading(false);
    }
  };

  const activeNodeName = activePreemption 
    ? INTERSECTIONS.find(i => i.id === activePreemption.intersection_id)?.name || `INT-${String.fromCharCode(64 + activePreemption.intersection_id)}`
    : "";

  return (
    <div className="bg-[#0b1220]/75 border border-slate-800 rounded-xl p-5 flex flex-col gap-4 shadow-xl backdrop-blur-md relative overflow-hidden group">
      {/* Red Pulse border when active */}
      {activePreemption && (
        <div className="absolute inset-0 border border-rose-500/30 rounded-xl pointer-events-none animate-pulse" />
      )}
      
      <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl pointer-events-none" />

      <h2 className="text-sm font-semibold tracking-wider font-mono text-slate-300 flex items-center gap-2 border-b border-slate-800 pb-3 uppercase">
        <Flame className={`w-4 h-4 ${activePreemption ? "text-rose-500 animate-bounce" : "text-amber-500"}`} />
        Emergency preemption system
      </h2>

      {/* Notification HUD Panel when active */}
      {activePreemption ? (
        <div className="bg-rose-950/10 border border-rose-900/30 rounded-lg p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-rose-500 font-bold bg-rose-500/5 border border-rose-500/20 px-3 py-1.5 rounded animate-pulse">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 animate-bounce" />
            <span className="text-xs font-mono tracking-widest">⚠️ EMERGENCY PREEMPTION ACTIVE</span>
          </div>

          <div className="grid grid-cols-2 gap-3.5 text-[10px] font-mono text-slate-400 border-t border-rose-950/40 pt-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-slate-500 text-[8px] uppercase">Vehicle Type</span>
              <span className="font-bold text-white text-xs">{activePreemption.vehicle_type}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-slate-500 text-[8px] uppercase">Active Node</span>
              <span className="font-bold text-slate-200 truncate">{activeNodeName}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-slate-500 text-[8px] uppercase">Target Green Lane</span>
              <span className="font-bold text-emerald-400">{activePreemption.lane}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-slate-500 text-[8px] uppercase">Corridor Speed</span>
              <span className="font-bold text-rose-400">45 mph (Override)</span>
            </div>
          </div>

          {greenCorridorPath && (
            <div className="text-[10px] font-mono text-slate-400 bg-slate-950/40 border border-slate-900 p-2.5 rounded-md mt-1">
              <div className="text-slate-500 text-[8px] uppercase font-semibold mb-1">Target Corridor Path</div>
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                {greenCorridorPath.map((id, index) => (
                  <React.Fragment key={id}>
                    <span>INT-{String.fromCharCode(64 + id)}</span>
                    {index < greenCorridorPath.length - 1 && <span className="text-slate-600 font-sans">→</span>}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-slate-950/40 border border-slate-900/60 rounded-lg p-4 flex flex-col gap-2 items-center text-center py-6 text-slate-500">
          <ShieldCheck className="w-8 h-8 text-emerald-600/50 mb-1" />
          <span className="text-xs font-mono font-bold uppercase text-emerald-500/70">System Failsafe Secured</span>
          <span className="text-[10px] font-mono leading-relaxed max-w-[220px] mt-0.5">No active emergency vehicle preemption detected. Scanning grid loops...</span>
        </div>
      )}

      {/* Manual Override Form */}
      <div className="flex flex-col gap-3 mt-1.5">
        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
          Manual Corridor Preemption Override
        </span>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-[8px] font-mono text-slate-500 uppercase">Start intersection</span>
            <select
              value={startNode}
              onChange={(e) => setStartNode(Number(e.target.value))}
              className="bg-slate-950 border border-slate-800 text-slate-300 rounded px-2.5 py-1.5 outline-none focus:border-rose-500/40 text-[11px] font-mono"
            >
              {INTERSECTIONS.map((node) => (
                <option key={node.id} value={node.id}>
                  {`INT-${String.fromCharCode(64 + node.id)}`}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[8px] font-mono text-slate-500 uppercase">Dest intersection</span>
            <select
              value={endNode}
              onChange={(e) => setEndNode(Number(e.target.value))}
              className="bg-slate-950 border border-slate-800 text-slate-300 rounded px-2.5 py-1.5 outline-none focus:border-rose-500/40 text-[11px] font-mono"
            >
              {INTERSECTIONS.map((node) => (
                <option key={node.id} value={node.id}>
                  {`INT-${String.fromCharCode(64 + node.id)}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleManualOverride}
          disabled={loading}
          className="w-full py-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 disabled:from-slate-900 disabled:to-slate-900 text-white disabled:text-slate-600 font-bold border border-rose-500/20 disabled:border-slate-800 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 text-xs font-mono"
        >
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>ACTIVATING PATH...</span>
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              <span>FORCE-CLEAR CORRIDOR</span>
            </>
          )}
        </button>

        {successMsg && (
          <div className="text-[10px] text-emerald-400 font-mono bg-emerald-950/20 border border-emerald-900/30 p-2 rounded text-center">
            {successMsg}
          </div>
        )}

        {errorMsg && (
          <div className="text-[10px] text-rose-400 font-mono bg-rose-950/20 border border-rose-900/30 p-2 rounded text-center">
            {errorMsg}
          </div>
        )}
      </div>
    </div>
  );
}

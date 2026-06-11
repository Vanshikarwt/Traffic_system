"use client";

import React, { useState, useEffect, useRef } from "react";
import { Radio, RefreshCw, AlertTriangle, ShieldCheck } from "lucide-react";

interface LaneData {
  lane_name: string;
  density: number;
  vehicle_count: number;
  waiting_time: number;
  historical_traffic: number;
  priority_score: number;
}

interface SignalStateResponse {
  intersection_id: number;
  intersection_name: string;
  current_green_lane: string;
  green_time_seconds: number;
  lanes: LaneData[];
}

// Map database lane names to short UI labels and directions
const LANE_MAP: Record<string, { label: string; gridKey: string }> = {
  "Northbound (L1)": { label: "NORTH BOUND (L1)", gridKey: "north" },
  "Southbound (L2)": { label: "SOUTH BOUND (L2)", gridKey: "south" },
  "Eastbound (L3)": { label: "EAST BOUND (L3)", gridKey: "east" },
  "Westbound (L4)": { label: "WEST BOUND (L4)", gridKey: "west" },
};

export default function SignalControlCenter() {
  const [activeLane, setActiveLane] = useState<string>("Northbound (L1)");
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [lanes, setLanes] = useState<Record<string, LaneData>>({
    "Northbound (L1)": { lane_name: "Northbound (L1)", density: 35.0, vehicle_count: 8, waiting_time: 45.0, historical_traffic: 12.0, priority_score: 30.0 },
    "Southbound (L2)": { lane_name: "Southbound (L2)", density: 25.0, vehicle_count: 5, waiting_time: 20.0, historical_traffic: 10.0, priority_score: 20.0 },
    "Eastbound (L3)": { lane_name: "Eastbound (L3)", density: 45.0, vehicle_count: 12, waiting_time: 60.0, historical_traffic: 15.0, priority_score: 40.0 },
    "Westbound (L4)": { lane_name: "Westbound (L4)", density: 15.0, vehicle_count: 3, waiting_time: 10.0, historical_traffic: 8.0, priority_score: 12.0 },
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [intersectionName, setIntersectionName] = useState<string>("Intersection A (Broadway & 42nd)");
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchSignalState = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("http://localhost:8000/api/v1/intersections/1/signal-state");
      if (!res.ok) {
        throw new Error(`Failed to query signal intelligence: ${res.status}`);
      }
      const data = await res.json();
      setIntersectionName(data.intersection_name);
      setActiveLane(data.current_green_lane);
      setTimeLeft(data.green_time_seconds);
      
      const mappedLanes: Record<string, LaneData> = {};
      data.lanes.forEach((lane: LaneData) => {
        mappedLanes[lane.lane_name] = lane;
      });
      setLanes(mappedLanes);
    } catch (err: any) {
      setError(err.message || "Endpoint unreachable");
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch on mount
  useEffect(() => {
    fetchSignalState();
  }, []);

  // Interval timer for countdown
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Trigger reload at 0
          fetchSignalState();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const getLightState = (laneName: string) => {
    const isActive = activeLane === laneName;
    if (!isActive) {
      return { red: true, yellow: false, green: false };
    }
    // If active and time left is less than 4 seconds, show yellow (transition phase)
    if (timeLeft <= 3 && timeLeft > 0) {
      return { red: false, yellow: true, green: false };
    }
    return { red: false, yellow: false, green: true };
  };

  return (
    <div className="bg-[#0b1220]/75 border border-slate-800 rounded-xl p-5 flex flex-col gap-4 shadow-xl backdrop-blur-md relative overflow-hidden group">
      {/* Decorative pulse glow */}
      <div className="absolute top-0 left-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all duration-500" />
      
      {/* Header */}
      <div className="flex justify-between items-center border-b border-slate-800/80 pb-3">
        <div>
          <h2 className="text-sm font-semibold tracking-wider font-mono text-slate-300 flex items-center gap-2 uppercase">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" /> Adaptive Signal HUD
          </h2>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
            {intersectionName.toUpperCase()} // ACTIVE CYCLE
          </p>
        </div>
        <button
          onClick={fetchSignalState}
          disabled={loading}
          className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 border border-slate-700 hover:border-slate-600 disabled:border-slate-800 text-slate-300 disabled:text-slate-600 rounded transition-all flex items-center gap-1 text-[10px] font-mono"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          RE-EVALUATE
        </button>
      </div>

      {/* Junction Layout Section */}
      <div className="flex-1 flex flex-col items-center justify-center py-2 relative min-h-[290px]">
        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 bg-slate-950/90 rounded-lg flex flex-col items-center justify-center p-4 text-center z-20 font-mono text-[11px]">
            <AlertTriangle className="w-8 h-8 text-rose-500 mb-2 animate-bounce" />
            <span className="text-rose-400 font-bold uppercase">Signal Communications Interrupted</span>
            <p className="text-slate-500 mt-1">{error}</p>
            <button
              onClick={fetchSignalState}
              className="mt-3 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-emerald-400 rounded-md transition-all font-semibold"
            >
              RECONNECT SYSTEM
            </button>
          </div>
        )}

        {/* Junction Road Visual Grid Layout (3x3 grid) */}
        <div className="grid grid-cols-3 gap-x-2 gap-y-4 w-full max-w-[320px] items-center justify-items-center relative">
          
          {/* Row 1: empty, NORTH, empty */}
          <div />
          <LaneLightWidget
            direction="NORTH"
            data={lanes["Northbound (L1)"]}
            lightState={getLightState("Northbound (L1)")}
          />
          <div />

          {/* Row 2: WEST, TIMER, EAST */}
          <LaneLightWidget
            direction="WEST"
            data={lanes["Westbound (L4)"]}
            lightState={getLightState("Westbound (L4)")}
          />
          
          {/* Central Timer Widget */}
          <div className="relative flex items-center justify-center w-24 h-24 rounded-full border border-slate-800 bg-slate-950/60 shadow-[0_0_20px_rgba(0,0,0,0.6)]">
            {/* SVG circle track */}
            <svg className="absolute inset-0 w-full h-full transform -rotate-90">
              <circle
                cx="48"
                cy="48"
                r="40"
                className="stroke-slate-900/60 fill-none"
                strokeWidth="4"
              />
              <circle
                cx="48"
                cy="48"
                r="40"
                className={`fill-none transition-all duration-1000 ${
                  timeLeft <= 3 ? "stroke-amber-500/80 shadow-amber-500/10" : "stroke-emerald-500/80 shadow-emerald-500/10"
                }`}
                strokeWidth="4"
                strokeDasharray="251.2"
                strokeDashoffset={251.2 - (251.2 * Math.min(timeLeft, 60)) / 60}
              />
            </svg>
            <div className="flex flex-col items-center justify-center font-mono">
              <span className={`text-2xl font-bold leading-none tracking-tight ${timeLeft <= 3 ? "text-amber-400 animate-pulse" : "text-white"}`}>
                {timeLeft}s
              </span>
              <span className="text-[7px] text-slate-500 mt-1 uppercase font-semibold">Active Secs</span>
            </div>
          </div>

          <LaneLightWidget
            direction="EAST"
            data={lanes["Eastbound (L3)"]}
            lightState={getLightState("Eastbound (L3)")}
          />

          {/* Row 3: empty, SOUTH, empty */}
          <div />
          <LaneLightWidget
            direction="SOUTH"
            data={lanes["Southbound (L2)"]}
            lightState={getLightState("Southbound (L2)")}
          />
          <div />

        </div>
      </div>

      {/* Footer statistics bar */}
      <div className="flex justify-between items-center text-[9px] font-mono text-slate-500 border-t border-slate-900 pt-3">
        <div className="flex items-center gap-1 text-emerald-500/70">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>CYBERNETIC_FAILSAFE: ACTIVE</span>
        </div>
        <span>CYCLE_INTERVAL: DYNAMIC</span>
      </div>
    </div>
  );
}

interface WidgetProps {
  direction: "NORTH" | "SOUTH" | "EAST" | "WEST";
  data: LaneData;
  lightState: { red: boolean; yellow: boolean; green: boolean };
}

function LaneLightWidget({ direction, data, lightState }: WidgetProps) {
  return (
    <div className="flex flex-col items-center gap-1.5 w-full">
      {/* Compact Traffic Light Housing */}
      <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 shadow-[0_4px_12px_rgba(0,0,0,0.6)] flex flex-col gap-2 items-center w-12">
        {/* Red light */}
        <div
          className={`w-4 h-4 rounded-full transition-all duration-300 ${
            lightState.red
              ? "bg-rose-500 border border-rose-400 shadow-[0_0_12px_rgba(239,68,68,0.8)]"
              : "bg-rose-950/30 border border-rose-900/40"
          }`}
        />
        {/* Yellow light */}
        <div
          className={`w-4 h-4 rounded-full transition-all duration-300 ${
            lightState.yellow
              ? "bg-amber-400 border border-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.8)] animate-pulse"
              : "bg-amber-950/20 border border-amber-900/20"
          }`}
        />
        {/* Green light */}
        <div
          className={`w-4 h-4 rounded-full transition-all duration-300 ${
            lightState.green
              ? `bg-emerald-500 border border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.8)] ${
                  data?.priority_score >= 900.0 ? "animate-strobe" : ""
                }`
              : "bg-emerald-950/30 border border-emerald-900/40"
          }`}
        />
      </div>

      {/* Info labels */}
      <div className="flex flex-col items-center text-center font-mono select-none">
        <span className="text-[8px] font-bold text-slate-400 leading-none">{direction}</span>
        <span className="text-[7px] text-slate-500 mt-1">Score: {data?.priority_score || 0}</span>
        <span className="text-[6px] text-slate-600">D: {data?.density || 0}% // V: {data?.vehicle_count || 0}</span>
      </div>
    </div>
  );
}

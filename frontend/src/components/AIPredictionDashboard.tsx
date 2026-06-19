"use client";

import React, { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, AlertTriangle, ShieldCheck, RefreshCw, Cpu, Layers } from "lucide-react";

interface AnalyticsDataPoint {
  time: string;
  label?: string;
  vehicle_count: number;
  density: number;
  type: string;
}

interface ForecastResponse {
  intersection_id: number;
  historical: AnalyticsDataPoint[];
  forecast: AnalyticsDataPoint[];
  combined: AnalyticsDataPoint[];
}

export default function AIPredictionDashboard() {
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [metric, setMetric] = useState<"density" | "vehicle_count">("density");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchForecast = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/analytics/forecast/1`);
      if (!res.ok) {
        throw new Error(`Analytics server responded with status: ${res.status}`);
      }
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to fetch analytics forecast");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForecast();
    const interval = setInterval(fetchForecast, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, []);

  if (error) {
    return (
      <div className="bg-[#0b1220]/80 border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center text-center font-mono text-xs text-rose-400">
        <AlertTriangle className="w-8 h-8 text-rose-500 mb-2 animate-bounce" />
        <span className="font-bold uppercase">Analytics Feed Interrupted</span>
        <p className="text-slate-500 mt-1 max-w-sm">{error}</p>
        <button onClick={fetchForecast} className="mt-4 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-emerald-400 font-bold rounded-lg transition-all">
          Retry Connection
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-[#0b1220]/80 border border-slate-800 rounded-xl p-8 flex flex-col items-center justify-center text-center font-mono py-16">
        <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mb-3" />
        <span className="text-xs text-slate-400">CONNECTING TO FORECAST ENGINE...</span>
      </div>
    );
  }

  // Pre-process data for split solid/dashed lines in Recharts
  const combined = data.combined;
  const chartData = combined.map((item, idx) => {
    const isHistory = item.type === "history";
    const isLastHistory = isHistory && (combined[idx + 1]?.type === "forecast");
    const isFirstForecast = !isHistory && (combined[idx - 1]?.type === "history");

    const val = metric === "density" ? item.density : item.vehicle_count;

    return {
      time: item.time,
      label: item.label || item.time,
      historicalVal: isHistory || isFirstForecast ? val : null,
      forecastVal: !isHistory || isLastHistory ? val : null,
      type: item.type
    };
  });

  // Risk assessment calculation based on forecast data points
  const getRiskStatus = (density: number) => {
    if (density < 40) {
      return {
        label: "Low Risk",
        bg: "bg-emerald-950/40 text-emerald-400 border-emerald-900/30",
        indicator: "bg-emerald-500"
      };
    } else if (density < 75) {
      return {
        label: "High Congestion Warning",
        bg: "bg-amber-950/40 text-amber-400 border-amber-900/30",
        indicator: "bg-amber-500"
      };
    } else {
      return {
        label: "Critical Gridlock Bottleneck",
        bg: "bg-rose-950/40 text-rose-400 border-rose-900/30",
        indicator: "bg-rose-500"
      };
    }
  };

  return (
    <div className="bg-[#0b1220]/80 border border-slate-800 rounded-xl p-5 flex flex-col lg:flex-row gap-6 shadow-xl backdrop-blur-md relative overflow-hidden group">
      
      {/* Dynamic line chart (Main panel) */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div>
            <h3 className="text-sm font-semibold tracking-wider font-mono text-slate-300 flex items-center gap-2 uppercase">
              <Cpu className="w-4 h-4 text-emerald-400" />
              AI Traffic Forecasting Engine
            </h3>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">
              INTERSECTION A (BROADWAY) {"//"} 60-MIN HISTORICAL & 30-MIN PREDICTIONS
            </p>
          </div>
          
          {/* Metric Selector Tabs */}
          <div className="flex bg-slate-950/80 p-0.5 rounded-lg border border-slate-800 font-mono text-[9px] font-bold">
            <button
              onClick={() => setMetric("density")}
              className={`px-3 py-1.5 rounded-md transition-all ${metric === "density" ? "bg-slate-900 text-emerald-400 border border-slate-800/80 shadow-md" : "text-slate-500 hover:text-slate-300"}`}
            >
              DENSITY (%)
            </button>
            <button
              onClick={() => setMetric("vehicle_count")}
              className={`px-3 py-1.5 rounded-md transition-all ${metric === "vehicle_count" ? "bg-slate-900 text-emerald-400 border border-slate-800/80 shadow-md" : "text-slate-500 hover:text-slate-300"}`}
            >
              VEHICLE COUNT (CARS)
            </button>
          </div>
        </div>

        {/* Recharts responsive container */}
        <div className="h-[220px] w-full mt-2 font-mono text-[9px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" strokeOpacity={0.2} />
              <XAxis dataKey="label" stroke="#4b5563" />
              <YAxis stroke="#4b5563" domain={metric === "density" ? [0, 100] : [0, 'auto']} />
              <Tooltip
                contentStyle={{ backgroundColor: "#070b13", borderColor: "#1f2937", borderRadius: "8px" }}
                labelStyle={{ color: "#9ca3af", fontWeight: "bold" }}
              />
              {/* Historical Solid Slate Line */}
              <Line
                type="monotone"
                dataKey="historicalVal"
                stroke="#64748b"
                strokeWidth={2}
                dot={{ r: 3, stroke: "#475569", fill: "#0f172a" }}
                name={metric === "density" ? "Historical Density (%)" : "Historical Count"}
                activeDot={{ r: 5 }}
              />
              {/* Forecast Dashed Neon-emerald/Amber Line */}
              <Line
                type="monotone"
                dataKey="forecastVal"
                stroke={metric === "density" ? "#10b981" : "#f59e0b"}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 4, stroke: metric === "density" ? "#10b981" : "#f59e0b", fill: "#0f172a" }}
                name={metric === "density" ? "Forecast Density (%)" : "Forecast Count"}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Warning Metric Sidebar */}
      <div className="w-full lg:w-[260px] flex flex-col gap-4 border-t lg:border-t-0 lg:border-l border-slate-800/80 pt-4 lg:pt-0 lg:pl-6">
        <h4 className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-emerald-500" />
          Forecast risk matrix
        </h4>

        <div className="flex flex-col gap-3 font-mono">
          {data.forecast.map((pt, idx) => {
            const risk = getRiskStatus(pt.density);
            return (
              <div
                key={idx}
                className="bg-slate-950/40 border border-slate-900 rounded-lg p-3 flex flex-col gap-2 transition-all hover:border-slate-800"
              >
                <div className="flex justify-between items-center text-[10px]">
                  <span className="font-bold text-white uppercase">{pt.label}</span>
                  <span className="text-slate-500 text-[9px]">{pt.time}</span>
                </div>
                
                {/* Risk Warning Badge */}
                <div className={`text-[9px] uppercase px-2 py-1 rounded border font-semibold flex items-center gap-1.5 ${risk.bg}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${risk.indicator} ${risk.label !== "Low Risk" ? "animate-pulse" : ""}`} />
                  {risk.label}
                </div>

                <div className="flex justify-between items-center text-[8px] text-slate-500 border-t border-slate-900/60 pt-1.5 mt-0.5">
                  <span>FLOW: {pt.vehicle_count} cars/m</span>
                  <span>DENSITY: {pt.density}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}

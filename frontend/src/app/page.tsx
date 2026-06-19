"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import VideoUploadModal from "@/components/VideoUploadModal";
import SignalControlCenter from "@/components/SignalControlCenter";
import EmergencyControlCenter from "@/components/EmergencyControlCenter";

const AIPredictionDashboard = dynamic(
  () => import("@/components/AIPredictionDashboard"),
  { ssr: false }
);
import { 
  Activity, 
  MapPin, 
  AlertTriangle, 
  TrendingUp, 
  CheckCircle2, 
  XCircle, 
  RefreshCw,
  Cpu,
  BarChart2,
  Clock,
  Radio,
  Database,
  Shield,
  Layers,
  Server
} from "lucide-react";

interface HealthStatus {
  status: string;
  project: string;
  database: string;
}

const radarNodes = [
  { id: 1, label: "INT-A", top: "30%", left: "25%", x: 25, y: 30 },
  { id: 2, label: "INT-B", top: "65%", left: "40%", x: 40, y: 65 },
  { id: 3, label: "INT-C", top: "45%", left: "70%", x: 70, y: 45 },
  { id: 4, label: "INT-D", top: "18%", left: "60%", x: 60, y: 18 },
  { id: 5, label: "INT-E", top: "75%", left: "75%", x: 75, y: 75 },
  { id: 6, label: "INT-F", top: "50%", left: "15%", x: 15, y: 50 },
];

const networkLinks = [
  { sourceId: 1, targetId: 2 }, // A -> B
  { sourceId: 1, targetId: 4 }, // A -> D
  { sourceId: 2, targetId: 3 }, // B -> C
  { sourceId: 3, targetId: 5 }, // C -> E
  { sourceId: 4, targetId: 5 }, // D -> E
  { sourceId: 4, targetId: 6 }, // D -> F
  { sourceId: 5, targetId: 6 }, // E -> F
  { sourceId: 6, targetId: 1 }, // F -> A
];

const getCongestionStyles = (density: string) => {
  switch (density) {
    case "Low":
      return {
        dotClass: "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]",
        labelClass: "text-slate-400 border-slate-800",
      };
    case "Medium":
      return {
        dotClass: "bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.8)]",
        labelClass: "text-amber-400 border-amber-950/40",
      };
    case "Heavy":
      return {
        dotClass: "bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.8)]",
        labelClass: "text-orange-400 border-orange-950/40",
      };
    case "Critical":
      return {
        dotClass: "bg-rose-500 shadow-[0_0_12px_rgba(239,68,68,0.8)] animate-pulse",
        labelClass: "text-rose-400 border-rose-950/40",
      };
    default:
      return {
        dotClass: "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]",
        labelClass: "text-slate-400 border-slate-800",
      };
  }
};

export default function CommandCenter() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string>("");
  const [currentTime, setCurrentTime] = useState<string>("");
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [activePreemption, setActivePreemption] = useState<any>(null);
  const [greenCorridorPath, setGreenCorridorPath] = useState<number[] | null>(null);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState<boolean>(true);

  // Authentication State
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ username: string; role: string } | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(false);

  useEffect(() => {
    const savedToken = localStorage.getItem("auth_token");
    const savedUser = localStorage.getItem("auth_user");
    if (savedToken && savedUser) {
      setToken(savedToken);
      setCurrentUser(JSON.parse(savedUser));
    }
  }, []);

  const loginAsRole = async (roleName: string) => {
    setIsAuthLoading(true);
    setAuthError(null);
    let username = "";
    let password = "";

    if (roleName === "Admin") {
      username = "admin";
      password = "adminpassword";
    } else if (roleName === "Traffic Operator") {
      username = "operator";
      password = "operatorpassword";
    } else {
      username = "viewer";
      password = "viewerpassword";
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        throw new Error("Failed to authenticate with backend.");
      }

      const data = await res.json();
      setToken(data.access_token);
      const userObj = { username: data.username, role: data.role };
      setCurrentUser(userObj);
      localStorage.setItem("auth_token", data.access_token);
      localStorage.setItem("auth_user", JSON.stringify(userObj));
    } catch (err: any) {
      setAuthError(err.message || "Authentication failed.");
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setCurrentUser(null);
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
  };

  // Smart City Command Mock Intersection Status Data State
  const [intersectionsState, setIntersectionsState] = useState([
    { id: 1, name: "Intersection A (Broadway & 42nd)", status: "active", density: "High", speed: "14 mph", count: 84, activeLogs: 256, predicted_incoming_vehicles: 0 },
    { id: 2, name: "Intersection B (5th Ave & 34th)", status: "active", density: "Medium", speed: "23 mph", count: 48, activeLogs: 198, predicted_incoming_vehicles: 0 },
    { id: 3, name: "Intersection C (FDR Drive & E 34th)", status: "congested", density: "Critical", speed: "4 mph", count: 142, activeLogs: 512, predicted_incoming_vehicles: 0 },
    { id: 4, name: "Intersection D (Madison Ave & 57th)", status: "active", density: "Low", speed: "32 mph", count: 19, activeLogs: 88, predicted_incoming_vehicles: 0 },
    { id: 5, name: "Intersection E (Lexington & 86th)", status: "maintenance", density: "None", speed: "0 mph", count: 0, activeLogs: 0, predicted_incoming_vehicles: 0 },
    { id: 6, name: "Intersection F (7th Ave & 23rd St)", status: "active", density: "Medium", speed: "18 mph", count: 55, activeLogs: 140, predicted_incoming_vehicles: 0 },
  ]);

  const handleUploadSuccess = (intersectionId: number, logData: any) => {
    setIntersectionsState((prev) =>
      prev.map((node) => {
        if (node.id === intersectionId) {
          // Adjust mock speed realistically depending on density
          let speedVal = "30 mph";
          if (logData.congestion_level === "Heavy") {
            speedVal = "5 mph";
          } else if (logData.congestion_level === "Medium") {
            speedVal = "18 mph";
          } else if (logData.congestion_level === "Low") {
            speedVal = "34 mph";
          }

          return {
            ...node,
            count: logData.vehicle_count,
            density: logData.congestion_level,
            speed: speedVal,
            status: logData.congestion_level === "Heavy" ? "congested" : "active",
            activeLogs: node.activeLogs + 1,
          };
        }
        return node;
      })
    );
  };

  const checkConnection = async () => {
    setLoading(true);
    setError(null);
    try {
      // Attempting to query the FastAPI backend health-check route
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/health`);
      if (!res.ok) {
        throw new Error(`Gateway response status: ${res.status}`);
      }
      const data = await res.json();
      setHealth(data);
      setError(null);
    } catch (err: any) {
      setHealth(null);
      setError(err.message || "Target host unreachable");
    } finally {
      setLoading(false);
      setLastChecked(new Date().toLocaleTimeString());
    }
  };

  const fetchNetworkTelemetry = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/network/grid-telemetry`);
      if (!res.ok) {
        throw new Error(`Telemetry status: ${res.status}`);
      }
      const data = await res.json();
      if (data && data.nodes) {
        setIntersectionsState((prev) =>
          prev.map((node) => {
            const telemetryNode = data.nodes.find((n: any) => n.intersection_id === node.id);
            if (telemetryNode) {
              let speedVal = "30 mph";
              if (telemetryNode.congestion_level === "Critical") {
                speedVal = "4 mph";
              } else if (telemetryNode.congestion_level === "Heavy") {
                speedVal = "8 mph";
              } else if (telemetryNode.congestion_level === "Medium") {
                speedVal = "18 mph";
              } else if (telemetryNode.congestion_level === "Low") {
                speedVal = "32 mph";
              }

              return {
                ...node,
                count: telemetryNode.vehicle_count,
                density: telemetryNode.congestion_level,
                speed: speedVal,
                status: telemetryNode.status,
                predicted_incoming_vehicles: telemetryNode.predicted_incoming_vehicles,
              };
            }
            return node;
          })
        );
        setActivePreemption(data.active_preemption);
        setGreenCorridorPath(data.green_corridor_path);
      }
    } catch (err) {
      console.error("Error fetching network telemetry:", err);
    }
  };

  useEffect(() => {
    checkConnection();
    fetchNetworkTelemetry();
    setCurrentTime(new Date().toLocaleString());
    
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date().toLocaleString());
    }, 1000);

    const checkInterval = setInterval(checkConnection, 15000);
    const telemetryInterval = setInterval(fetchNetworkTelemetry, 5000);

    return () => {
      clearInterval(timeInterval);
      clearInterval(checkInterval);
      clearInterval(telemetryInterval);
    };
  }, []);

  // intersectionsState is defined as React state hook above.

  return (
    <div className="min-h-screen bg-[#070b13] text-slate-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200">
      
      {/* Background Visual Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950/20 via-slate-950/80 to-[#070b13] pointer-events-none z-0" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293708_1px,transparent_1px),linear-gradient(to_bottom,#1f293708_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none z-0" />

      {/* Main Command Header */}
      <header className="relative z-10 border-b border-slate-800 bg-[#090f1d]/80 backdrop-blur-md px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
            <Radio className="w-6 h-6 text-emerald-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white font-mono uppercase">
                Aegis Traffic Command
              </h1>
              <span className="text-[10px] bg-slate-800 border border-slate-700 text-slate-400 font-mono px-1.5 py-0.5 rounded uppercase">
                v1.0.0
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">INTELLIGENT TRAFFIC MANAGEMENT SYSTEMS</p>
          </div>
        </div>

        {/* Action Button & Live Date & Time HUD */}
        <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6 text-xs font-mono text-slate-400">
          
          {/* Auth Role Switcher Panel */}
          <div className="flex items-center gap-2 bg-[#0d1527] border border-slate-800 rounded-lg px-3 py-1.5 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Access Clearance:</span>
            {isAuthLoading ? (
              <span className="text-[10px] text-amber-400 flex items-center gap-1 font-bold">
                <RefreshCw className="w-3 h-3 animate-spin" /> VERIFYING...
              </span>
            ) : currentUser ? (
              <div className="flex items-center gap-2">
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded border tracking-wider uppercase font-mono ${
                  currentUser.role === "Admin" ? "bg-rose-950/40 text-rose-400 border-rose-500/20" :
                  currentUser.role === "Traffic Operator" ? "bg-amber-950/40 text-amber-400 border-amber-500/20" :
                  "bg-slate-900 text-slate-400 border-slate-800"
                }`}>
                  {currentUser.role}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-[9px] text-rose-500 hover:text-rose-400 underline font-bold uppercase tracking-wider"
                >
                  [Logout]
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => loginAsRole("Admin")}
                  className="px-2 py-0.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded text-[9px] font-bold text-rose-450 tracking-wider transition-all"
                >
                  ADMIN
                </button>
                <button
                  onClick={() => loginAsRole("Traffic Operator")}
                  className="px-2 py-0.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded text-[9px] font-bold text-amber-450 tracking-wider transition-all"
                >
                  OPERATOR
                </button>
                <button
                  onClick={() => loginAsRole("Viewer")}
                  className="px-2 py-0.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded text-[9px] font-bold text-slate-400 tracking-wider transition-all"
                >
                  VIEWER
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold border border-emerald-500/20 rounded-lg shadow-[0_0_15px_rgba(16,185,129,0.1)] hover:shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-all flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>➕ PROCESS VIDEO FEED</span>
          </button>

          <button
            onClick={() => setIsAnalyticsOpen(!isAnalyticsOpen)}
            className={`px-4 py-2.5 font-bold border rounded-lg transition-all flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] ${
              isAnalyticsOpen
                ? "bg-slate-800/80 text-emerald-400 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                : "bg-slate-900/60 text-slate-500 border-slate-800/80 hover:text-slate-355"
            }`}
          >
            <span>📊 FORECAST ANALYTICS</span>
          </button>

          <div className="hidden lg:flex items-center gap-2 border-r border-slate-800 pr-6">
            <Clock className="w-4 h-4 text-emerald-500" />
            <span>SYS_TIME: {currentTime || "CALIBRATING..."}</span>
          </div>

          {/* Quick Health Node */}
          <div className="flex items-center gap-3">
            <span className="text-slate-500 uppercase">GATEWAY_CONN:</span>
            {loading ? (
              <span className="flex items-center gap-1.5 text-amber-400">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> PINGING...
              </span>
            ) : health ? (
              <span className="flex items-center gap-1.5 text-emerald-400 font-bold bg-emerald-500/5 border border-emerald-500/20 px-2 py-0.5 rounded shadow-[0_0_10px_rgba(16,185,129,0.05)]">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> ONLINE
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-rose-500 font-bold bg-rose-500/5 border border-rose-500/20 px-2 py-0.5 rounded">
                <span className="w-2 h-2 rounded-full bg-rose-600" /> OFFLINE
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="relative z-10 flex-1 grid grid-cols-1 xl:grid-cols-12 gap-6 p-6">
        
        {/* LEFT COLUMN: CONNECTION HEALTH AND CONTROL PANEL (4 cols) */}
        <section className="xl:col-span-4 flex flex-col gap-6">
          
          {/* Card 1: API Connection Integrity Shell */}
          <div className="bg-[#0b1220]/75 border border-slate-800 rounded-xl p-5 flex flex-col gap-4 shadow-xl backdrop-blur-md relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all duration-500" />
            
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h2 className="text-sm font-semibold tracking-wider font-mono text-slate-300 flex items-center gap-2 uppercase">
                <Server className="w-4 h-4 text-emerald-400" /> Node Connection Terminal
              </h2>
              <button 
                onClick={checkConnection}
                disabled={loading}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 border border-slate-700 hover:border-slate-600 disabled:border-slate-800 text-slate-300 disabled:text-slate-600 rounded transition-all flex items-center gap-1.5 text-xs font-mono"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                SYNC
              </button>
            </div>

            {/* Connection Detail Blocks */}
            <div className="flex flex-col gap-3.5">
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-lg flex flex-col gap-1">
                  <span className="text-slate-500">BACKEND_URL</span>
                  <span className="text-slate-300 truncate font-semibold">{process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}</span>
                </div>
                <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-lg flex flex-col gap-1">
                  <span className="text-slate-500">API_ENDPOINT</span>
                  <span className="text-slate-300 font-semibold">/api/v1/health</span>
                </div>
              </div>

              {/* Status Visual Representation */}
              {health ? (
                <div className="bg-emerald-950/15 border border-emerald-800/30 rounded-lg p-4 flex flex-col gap-2.5">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0 animate-glow-pulse" />
                    <span className="text-sm font-bold tracking-wider font-mono">CONNECTION ESTABLISHED</span>
                  </div>
                  <div className="text-xs font-mono text-slate-400 flex flex-col gap-1 border-t border-emerald-900/30 pt-2">
                    <div className="flex justify-between"><span className="text-slate-500">SERVICE:</span> <span>{health.project}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">SYSTEM STATUS:</span> <span>{health.status}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">DB STORAGE:</span> <span className="text-emerald-400 flex items-center gap-1"><Database className="w-3 h-3" /> {health.database}</span></div>
                  </div>
                </div>
              ) : error ? (
                <div className="bg-rose-950/10 border border-rose-900/30 rounded-lg p-4 flex flex-col gap-2.5">
                  <div className="flex items-center gap-2 text-rose-400">
                    <XCircle className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm font-bold tracking-wider font-mono">CONNECTION TERMINATED</span>
                  </div>
                  <div className="text-xs font-mono text-slate-400 flex flex-col gap-1 border-t border-rose-950/40 pt-2">
                    <div className="flex justify-between"><span className="text-slate-500">DIAGNOSIS:</span> <span className="text-rose-400 font-bold">{error}</span></div>
                    <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                      Verify FastAPI server is active on <code className="bg-slate-900 text-rose-300 px-1 py-0.5 rounded">port 8000</code> and CORS allow origin configuration includes local host origin.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-900/30 border border-slate-800/80 rounded-lg p-4 flex flex-col gap-2 text-center items-center py-6">
                  <RefreshCw className="w-8 h-8 text-slate-600 animate-spin mb-1" />
                  <span className="text-xs font-mono text-slate-400">CALIBRATING NODE COMMUNICATIONS...</span>
                </div>
              )}

              <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono pt-1">
                <span>CHECK_INTERVAL: 15s</span>
                <span>LAST_SYNC: {lastChecked || "NEVER"}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Command Center System Telemetry Metrics */}
          <div className="bg-[#0b1220]/75 border border-slate-800 rounded-xl p-5 flex flex-col gap-4 shadow-xl backdrop-blur-md">
            <h2 className="text-sm font-semibold tracking-wider font-mono text-slate-300 flex items-center gap-2 border-b border-slate-800 pb-3 uppercase">
              <Cpu className="w-4 h-4 text-emerald-400" /> HUD System Telemetry
            </h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-950/40 border border-slate-800/60 p-4 rounded-lg flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-500 uppercase">Flow Rate</span>
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <span className="text-2xl font-bold font-mono text-white tracking-tight">496<span className="text-xs text-slate-500 ml-1">/m</span></span>
                <span className="text-[10px] text-emerald-400 font-mono font-semibold">+8.4% vs last hr</span>
              </div>

              <div className="bg-slate-950/40 border border-slate-800/60 p-4 rounded-lg flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-500 uppercase">Avg Delay</span>
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <span className="text-2xl font-bold font-mono text-white tracking-tight">18.4s</span>
                <span className="text-[10px] text-amber-400 font-mono font-semibold">Moderately Heavy</span>
              </div>

              <div className="bg-slate-950/40 border border-slate-800/60 p-4 rounded-lg flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-500 uppercase">Detection accuracy</span>
                  <Shield className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <span className="text-2xl font-bold font-mono text-white tracking-tight">98.2%</span>
                <span className="text-[10px] text-slate-500 font-mono">YOLOv8 Dynamic Engine</span>
              </div>

              <div className="bg-slate-950/40 border border-slate-800/60 p-4 rounded-lg flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-500 uppercase">Congestion Index</span>
                  <AlertTriangle className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <span className="text-2xl font-bold font-mono text-emerald-400 tracking-tight">34%</span>
                <span className="text-[10px] text-emerald-400 font-mono font-semibold">Optimal Range</span>
              </div>
            </div>
          </div>

          <EmergencyControlCenter
            activePreemption={activePreemption}
            greenCorridorPath={greenCorridorPath}
            onOverrideTriggered={fetchNetworkTelemetry}
            token={token}
          />
        </section>

        {/* MIDDLE COLUMN: REAL-TIME RADAR GRID VIEW & ADAPTIVE SIGNAL CONTROL (4 cols) */}
        <section className="xl:col-span-4 flex flex-col gap-6">
          <div className="bg-[#0b1220]/75 border border-slate-800 rounded-xl p-5 flex flex-col gap-4 shadow-xl backdrop-blur-md relative h-[380px]">
            <h2 className="text-sm font-semibold tracking-wider font-mono text-slate-300 flex items-center gap-2 border-b border-slate-800 pb-3 uppercase">
              <Layers className="w-4 h-4 text-emerald-400" /> City Grid Radar Simulation
            </h2>

            {/* Radar View Container */}
            <div className="flex-1 relative bg-slate-950/80 border border-slate-800/60 rounded-lg overflow-hidden flex items-center justify-center p-6 shadow-inner">
              
              {/* Radar Circle Grids */}
              <div className="absolute w-[90%] aspect-square border border-emerald-500/10 rounded-full max-w-[280px]" />
              <div className="absolute w-[60%] aspect-square border border-emerald-500/10 rounded-full max-w-[280px]" />
              <div className="absolute w-[30%] aspect-square border border-emerald-500/10 rounded-full max-w-[280px]" />
              
              {/* Crosshair Lines */}
              <div className="absolute w-[90%] h-[1px] bg-emerald-500/10 max-w-[280px]" />
              <div className="absolute h-[90%] w-[1px] bg-emerald-500/10 max-h-[280px]" />
              
              {/* Spinning Radar Sweep */}
              <div className="absolute w-[45%] h-[45%] top-[5%] left-[5%] origin-bottom-right bg-gradient-to-tl from-emerald-500/15 to-transparent rounded-tl-full animate-radar-sweep pointer-events-none" />

              {/* Dynamic Traffic Propagation Vectors SVG Panel */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                  <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                    <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#f97316" />
                  </marker>
                  <marker id="arrow-emerald" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                    <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#10b981" />
                  </marker>
                </defs>

                {/* Green Corridor sequential path overlay */}
                {greenCorridorPath && greenCorridorPath.length > 1 && (
                  <g>
                    {greenCorridorPath.map((nodeId, idx) => {
                      if (idx === 0) return null;
                      const sourcePos = radarNodes.find(n => n.id === greenCorridorPath[idx - 1]);
                      const targetPos = radarNodes.find(n => n.id === nodeId);
                      if (!sourcePos || !targetPos) return null;
                      
                      return (
                        <g key={`corridor-${idx}`}>
                          {/* Pulsing glow background line */}
                          <line
                            x1={sourcePos.x}
                            y1={sourcePos.y}
                            x2={targetPos.x}
                            y2={targetPos.y}
                            stroke="#10b981"
                            strokeWidth="3.5"
                            strokeOpacity="0.8"
                            className="animate-pulse"
                            style={{ filter: "drop-shadow(0 0 6px rgba(16, 185, 129, 0.9))" }}
                          />
                          {/* Rapid moving dash for the emergency vehicle */}
                          <line
                            x1={sourcePos.x}
                            y1={sourcePos.y}
                            x2={targetPos.x}
                            y2={targetPos.y}
                            stroke="#6ee7b7"
                            strokeWidth="2"
                            strokeDasharray="10 30"
                            className="animate-dash"
                            markerEnd="url(#arrow-emerald)"
                          />
                        </g>
                      );
                    })}
                  </g>
                )}

                {networkLinks.map((link, idx) => {
                  const targetNode = intersectionsState.find((n) => n.id === link.targetId);
                  if (!targetNode) return null;

                  // Render path vector if predicted incoming vehicles is greater than 20
                  const isPropagating = targetNode.predicted_incoming_vehicles > 20;
                  if (!isPropagating) return null;

                  const sourcePos = radarNodes.find((n) => n.id === link.sourceId);
                  const targetPos = radarNodes.find((n) => n.id === link.targetId);
                  if (!sourcePos || !targetPos) return null;

                  return (
                    <g key={idx}>
                      {/* Underlying glowing vector line */}
                      <line
                        x1={sourcePos.x}
                        y1={sourcePos.y}
                        x2={targetPos.x}
                        y2={targetPos.y}
                        stroke="#f97316"
                        strokeWidth="1.5"
                        strokeOpacity="0.8"
                        strokeDasharray="3 3"
                        className="animate-pulse"
                        style={{ filter: "drop-shadow(0 0 4px rgba(249, 115, 22, 0.8))" }}
                      />
                      {/* Animated dash representation of traffic flow */}
                      <line
                        x1={sourcePos.x}
                        y1={sourcePos.y}
                        x2={targetPos.x}
                        y2={targetPos.y}
                        stroke="#fdba74"
                        strokeWidth="1.5"
                        strokeDasharray="6 24"
                        className="animate-dash"
                        markerEnd="url(#arrow)"
                      />
                    </g>
                  );
                })}
              </svg>

              {/* Pulsing Intersections (Coordinates mapped visual indicator) */}
              {radarNodes.map((nodeInfo) => {
                const nodeState = intersectionsState.find((n) => n.id === nodeInfo.id);
                const densityLevel = nodeState ? nodeState.density : "Low";
                const styles = getCongestionStyles(densityLevel);
                
                return (
                  <div
                    key={nodeInfo.id}
                    className="absolute flex flex-col items-center z-20"
                    style={{ top: nodeInfo.top, left: nodeInfo.left }}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${styles.dotClass}`} />
                    <span className={`text-[8px] font-mono mt-1 bg-slate-900/90 border px-1 py-0.5 rounded backdrop-blur-sm shadow-md transition-all duration-300 ${styles.labelClass}`}>
                      {nodeInfo.label}
                    </span>
                  </div>
                );
              })}

              {/* Status HUD Overlays */}
              <div className="absolute bottom-3 left-3 flex flex-col gap-1 font-mono text-[9px] text-slate-400 bg-slate-900/85 border border-slate-800 p-2 rounded-lg z-20">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
                  <span>ACTIVE OK ({intersectionsState.filter(n => n.status === "active").length})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(239,68,68,0.5)] animate-pulse" />
                  <span>CONGESTION ALERTS ({intersectionsState.filter(n => n.status === "congested").length})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]" />
                  <span>MAINTENANCE ({intersectionsState.filter(n => n.status === "maintenance").length})</span>
                </div>
              </div>

              <div className="absolute top-3 right-3 text-[10px] font-mono text-slate-500 bg-slate-900/50 px-2 py-0.5 rounded border border-slate-800/40 z-20">
                ZOOM: 1.2X
              </div>
            </div>
          </div>

          <SignalControlCenter />
        </section>

        {/* RIGHT COLUMN: DETAILED INTERSECTION LOGS GRID (4 cols) */}
        <section className="xl:col-span-4 flex flex-col gap-6">
          <div className="bg-[#0b1220]/75 border border-slate-800 rounded-xl p-5 flex flex-col gap-4 shadow-xl backdrop-blur-md flex-1">
            <h2 className="text-sm font-semibold tracking-wider font-mono text-slate-300 flex items-center gap-2 border-b border-slate-800 pb-3 uppercase">
              <BarChart2 className="w-4 h-4 text-emerald-400" /> Intersection Matrix
            </h2>

            {/* List scrollable */}
            <div className="flex-1 flex flex-col gap-3 overflow-y-auto max-h-[420px] xl:max-h-[480px] pr-1">
              {intersectionsState.map((node) => (
                <div 
                  key={node.id} 
                  className="bg-slate-950/50 hover:bg-slate-900/60 border border-slate-800 hover:border-slate-700/80 rounded-lg p-3 flex flex-col gap-2 transition-all duration-200"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                      <MapPin className={`w-3.5 h-3.5 ${
                        node.status === "congested" ? "text-rose-500" :
                        node.status === "maintenance" ? "text-amber-500" : "text-emerald-500"
                      }`} />
                      {node.name}
                    </span>
                    
                    {/* Tiny Status Badge */}
                    <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border font-semibold ${
                      node.status === "active" 
                        ? "bg-emerald-950/20 text-emerald-400 border-emerald-900/30" 
                        : node.status === "congested"
                        ? "bg-rose-950/20 text-rose-400 border-rose-900/30"
                        : "bg-amber-950/20 text-amber-400 border-amber-900/30"
                    }`}>
                      {node.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-slate-400 border-t border-slate-900 pt-2 mt-0.5">
                    <div className="flex flex-col">
                      <span className="text-slate-500 text-[8px] uppercase">Vehicle Flow</span>
                      <span className="font-semibold text-slate-200 mt-0.5">{node.count} cars/m</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-slate-500 text-[8px] uppercase">Speed</span>
                      <span className="font-semibold text-slate-200 mt-0.5">{node.speed}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-slate-500 text-[8px] uppercase">Density</span>
                      <span className={`font-bold mt-0.5 ${
                        node.density === "Critical" ? "text-rose-500" :
                        node.density === "High" ? "text-amber-500" :
                        node.density === "Medium" ? "text-emerald-400" : "text-slate-400"
                      }`}>{node.density}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {isAnalyticsOpen && (
          <section className="xl:col-span-12 w-full">
            <AIPredictionDashboard />
          </section>
        )}

      </main>

      {/* Footer System Output Log ticker */}
      <footer className="relative z-10 border-t border-slate-800 bg-[#060b14] px-6 py-3 flex flex-col sm:flex-row justify-between items-center text-[10px] font-mono text-slate-500 gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
          <span>SYS_STATUS: CALIBRATED {"//"} ACTIVE METRICS STREAMING</span>
        </div>
        <div className="flex items-center gap-4">
          <span>HOST: LOCALSOCKET_HUD</span>
          <span className="text-emerald-500/60">© 2026 INTELLIGENT TRAFFIC SYSTEMS CO.</span>
        </div>
      </footer>

      {isUploadModalOpen && (
        <VideoUploadModal
          onClose={() => setIsUploadModalOpen(false)}
          onSuccess={handleUploadSuccess}
          token={token}
        />
      )}

    </div>
  );
}

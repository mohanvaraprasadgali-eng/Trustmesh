"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, ExternalLink, X } from "lucide-react";

export interface NotificationItem {
  id: string;
  type: "success" | "error" | "info" | "warning";
  title: string;
  message: string;
  txHash?: string;
  timestamp: number;
}

interface NotificationContextType {
  notifications: NotificationItem[];
  notify: (notification: Omit<NotificationItem, "id" | "timestamp">) => void;
  dismiss: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const notify = useCallback(
    ({ type, title, message, txHash }: Omit<NotificationItem, "id" | "timestamp">) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newNotification: NotificationItem = {
        id,
        type,
        title,
        message,
        txHash,
        timestamp: Date.now(),
      };

      setNotifications((prev) => [newNotification, ...prev].slice(0, 5));

      // Auto-dismiss after 7 seconds
      setTimeout(() => {
        dismiss(id);
      }, 7000);
    },
    [dismiss]
  );

  return (
    <NotificationContext.Provider value={{ notifications, notify, dismiss }}>
      {children}
      {/* Toast Notification Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {notifications.map((n) => {
          const isSuccess = n.type === "success";
          const isError = n.type === "error";
          const isWarning = n.type === "warning";

          return (
            <div
              key={n.id}
              className={`pointer-events-auto p-4 rounded-xl border backdrop-blur-xl shadow-2xl transition-all duration-300 animate-in slide-in-from-right-4 font-mono text-xs ${
                isSuccess
                  ? "bg-[#0d1e1c]/95 border-emerald-500/50 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                  : isError
                  ? "bg-[#200f14]/95 border-rose-500/50 text-rose-300 shadow-[0_0_20px_rgba(244,63,94,0.2)]"
                  : isWarning
                  ? "bg-[#20190a]/95 border-amber-500/50 text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.2)]"
                  : "bg-[#0d1627]/95 border-[#00f2fe]/40 text-sky-300 shadow-[0_0_20px_rgba(0,242,254,0.15)]"
              }`}
            >
              <div className="flex justify-between items-start gap-2">
                <div className="flex items-center gap-2 font-bold font-sans text-sm text-white">
                  {isSuccess && <CheckCircle2 size={16} className="text-emerald-400" />}
                  {isError && <XCircle size={16} className="text-rose-400" />}
                  {isWarning && <AlertTriangle size={16} className="text-amber-400" />}
                  {!isSuccess && !isError && !isWarning && <Info size={16} className="text-[#00f2fe]" />}
                  <span>{n.title}</span>
                </div>
                <button
                  onClick={() => dismiss(n.id)}
                  className="text-gray-400 hover:text-white transition"
                >
                  <X size={14} />
                </button>
              </div>

              <p className="mt-1 text-gray-300 font-sans text-xs leading-relaxed">{n.message}</p>

              {n.txHash && (
                <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
                  <span className="text-gray-400">TX: {n.txHash.slice(0, 12)}...{n.txHash.slice(-6)}</span>
                  <a
                    href={`https://mstscan.com/tx/${n.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#00f2fe] flex items-center gap-1 hover:underline"
                  >
                    <span>MSTScan</span>
                    <ExternalLink size={10} />
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification must be used within a NotificationProvider");
  }
  return {
    ...context,
    addNotification: context.notify,
  };
};

export const useNotifications = useNotification;


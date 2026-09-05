"use client";

import React, { useEffect, useState } from "react";
import { api } from "../lib/api";

interface HeaderProps {
  onOpenDisclaimer: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenDisclaimer }) => {
  const [backendStatus, setBackendStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [apiVersion, setApiVersion] = useState<string>("1.0.0");

  useEffect(() => {
    let isMounted = true;
    api.checkHealth()
      .then((res) => {
        if (isMounted) {
          setBackendStatus("connected");
          if (res.version) setApiVersion(res.version);
        }
      })
      .catch(() => {
        if (isMounted) setBackendStatus("disconnected");
      });
    return () => { isMounted = false; };
  }, []);

  return (
    <header className="masthead">
      <div className="masthead-inner">
        <div className="brand-block">
          <span className="brand-wordmark">Jerifin</span>
          <span className="brand-subtitle">Institutional Capital Allocation & Treasury Risk Platform</span>
        </div>

        <div className="status-cluster">
          <div className="demo-indicator" title="Deterministic synthetic market data for demonstration">
            <span className="demo-dot" />
            <span>DEMO / SYNTHETIC DATA</span>
          </div>

          <div className="api-status-pill">
            <span
              className="status-dot-green"
              style={{
                backgroundColor:
                  backendStatus === "connected"
                    ? "#10B981"
                    : backendStatus === "connecting"
                    ? "#F59E0B"
                    : "#EF4444",
              }}
            />
            <span>
              API: {backendStatus.toUpperCase()} {backendStatus === "connected" ? `(v${apiVersion})` : ""}
            </span>
          </div>

          <button
            onClick={onOpenDisclaimer}
            className="btn btn-secondary"
            style={{ fontSize: "11px", padding: "3px 8px" }}
            title="View methodology, disclaimers, and mathematical assumptions"
          >
            Methodology & Disclaimer
          </button>
        </div>
      </div>
    </header>
  );
};

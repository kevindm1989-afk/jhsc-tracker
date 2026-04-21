import { useState, useEffect, useCallback } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export const DEFAULT_NAV_ORDER = [
  "/",
  "/action-items",
  "/closed-items-log",
  "/member-actions",
  "/chat",
  "/notification-rules",
  "/health-safety-report",
  "/hs-reports-log",
  "/hazard-findings",
  "/inspection-log",
  "/conduct-inspection",
  "/worker-statements",
  "/right-to-refuse",
  "/suggestions",
  "/suggestions-log",
  "/files",
  "/import-minutes",
  "/minutes-log",
  "/meetings",
  "/incidents",
  "/emergency-contacts",
  "/meeting-transcription",
  "/manage-users",
  "/inspection-reminder",
  "/notification-settings",
];

export function useNavOrder() {
  const [order, setOrder] = useState<string[] | null>(null);

  useEffect(() => {
    fetch(`${BASE}/api/settings/nav-order`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.order && Array.isArray(data.order)) {
          setOrder(data.order);
        } else {
          setOrder(DEFAULT_NAV_ORDER);
        }
      })
      .catch(() => setOrder(DEFAULT_NAV_ORDER));
  }, []);

  const saveOrder = useCallback(async (newOrder: string[]) => {
    setOrder(newOrder);
    await fetch(`${BASE}/api/settings/nav-order`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ order: newOrder }),
    });
  }, []);

  return { order: order ?? DEFAULT_NAV_ORDER, saveOrder };
}

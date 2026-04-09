import { useState, useEffect, useCallback } from "react";
import { apiUrl } from "@/lib/api";

export const DEFAULT_NAV_ORDER = [
  "/",
  "/action-items",
  "/closed-items-log",
  "/member-actions",
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
  "/meeting-transcription",
  "/manage-users",
];

export function useNavOrder() {
  const [order, setOrder] = useState<string[] | null>(null);

  useEffect(() => {
    fetch(apiUrl("/api/settings/nav-order"), { credentials: "include" })
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
    await fetch(apiUrl("/api/settings/nav-order"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ order: newOrder }),
    });
  }, []);

  return { order: order ?? DEFAULT_NAV_ORDER, saveOrder };
}

// The dashboard window (DopamineWin/DashboardWindow.cs) has no Windows title bar when it opens
// the page with `?frame=custom`: the page draws its own and asks the window, through WebView2's
// `chrome.webview` messages, to minimise, maximise or close. In a browser none of this applies.
import { useEffect, useState } from "react";

type WebViewBridge = {
  postMessage(message: string): void;
  addEventListener(type: "message", listener: (e: { data: unknown }) => void): void;
  removeEventListener(type: "message", listener: (e: { data: unknown }) => void): void;
};

function bridge(): WebViewBridge | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { chrome?: { webview?: WebViewBridge } }).chrome?.webview ?? null;
}

/** Set before first paint by layout.tsx, from `?frame=custom`. */
function isCustomFrame(): boolean {
  return typeof document !== "undefined" && document.documentElement.dataset.frame === "custom" && bridge() !== null;
}

/** Whether the page draws the window's title bar, and the window buttons' actions. */
export function useWindowFrame() {
  const [custom, setCustom] = useState(false);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const b = bridge();
    if (!b || !isCustomFrame()) return;
    setCustom(true);
    const onMessage = (e: { data: unknown }) => {
      const d = e.data as { maximized?: unknown } | null;
      if (d && typeof d.maximized === "boolean") setMaximized(d.maximized);
    };
    b.addEventListener("message", onMessage);
    b.postMessage("state");
    return () => b.removeEventListener("message", onMessage);
  }, []);

  return {
    custom,
    maximized,
    minimize: () => bridge()?.postMessage("minimize"),
    toggleMaximize: () => bridge()?.postMessage("maximize"),
    close: () => bridge()?.postMessage("close"),
  };
}

/**
 * In the dashboard window, behave like an app: no browser context menu (Back, Reload, Print…)
 * except where text can be edited or is selected.
 */
export function useAppBehaviour() {
  useEffect(() => {
    if (!isCustomFrame()) return;
    const onContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable]")) return;
      if (window.getSelection()?.toString()) return;
      e.preventDefault();
    };
    document.addEventListener("contextmenu", onContextMenu);
    return () => document.removeEventListener("contextmenu", onContextMenu);
  }, []);
}

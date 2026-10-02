// The dashboard windows of the desktop agents draw no title bar of their own; the page draws it.
//  - Windows (DopamineWin/DashboardWindow.cs) opens the page with `?frame=custom`: the page also
//    draws the minimise, maximise and close buttons and asks the window, through WebView2's
//    `chrome.webview` messages, to use them. The bar moves the window through CSS `app-region`.
//  - macOS (DopamineMac/DashboardWindow.swift) opens it with `?frame=mac`: the traffic lights stay
//    native, at the bar's left end, and the page asks the window through WebKit's
//    `webkit.messageHandlers.dopamine` to move or zoom it (WebKit ignores `app-region`).
// In a browser none of this applies.
import { useEffect, useState } from "react";

export type Frame = "custom" | "mac";

type WebViewBridge = {
  postMessage(message: string): void;
  addEventListener(type: "message", listener: (e: { data: unknown }) => void): void;
  removeEventListener(type: "message", listener: (e: { data: unknown }) => void): void;
};

type WebKitBridge = { postMessage(message: { type: string; [key: string]: unknown }): void };

/** Sent by the Mac window as a `dopamine:host` event when it enters or leaves full screen. */
export const HOST_EVENT = "dopamine:host";

function webView(): WebViewBridge | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { chrome?: { webview?: WebViewBridge } }).chrome?.webview ?? null;
}

function webKit(): WebKitBridge | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { webkit?: { messageHandlers?: { dopamine?: WebKitBridge } } }).webkit?.messageHandlers?.dopamine ?? null;
}

/** The window the page is drawn in, as set before first paint by layout.tsx; null in a browser. */
export function currentFrame(): Frame | null {
  if (typeof document === "undefined") return null;
  const frame = document.documentElement.dataset.frame;
  if (frame === "custom" && webView()) return "custom";
  if (frame === "mac" && webKit()) return "mac";
  return null;
}

/** Whether the page draws the window's title bar, and the window buttons' actions. */
export function useWindowFrame() {
  const [frame, setFrame] = useState<Frame | null>(null);
  const [maximized, setMaximized] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);

  useEffect(() => {
    const current = currentFrame();
    setFrame(current);
    if (current === "custom") {
      const b = webView()!;
      const onMessage = (e: { data: unknown }) => {
        const d = e.data as { maximized?: unknown } | null;
        if (d && typeof d.maximized === "boolean") setMaximized(d.maximized);
      };
      b.addEventListener("message", onMessage);
      b.postMessage("state");
      return () => b.removeEventListener("message", onMessage);
    }
    if (current === "mac") {
      const onHost = (e: Event) => {
        const d = (e as CustomEvent<{ fullScreen?: unknown }>).detail;
        if (d && typeof d.fullScreen === "boolean") setFullScreen(d.fullScreen);
      };
      window.addEventListener(HOST_EVENT, onHost);
      webKit()!.postMessage({ type: "state" });
      return () => window.removeEventListener(HOST_EVENT, onHost);
    }
  }, []);

  return {
    /** The page draws the Windows caption buttons. */
    custom: frame === "custom",
    /** The page sits under the Mac traffic lights, which need room unless the window is full screen. */
    mac: frame === "mac",
    trafficLights: frame === "mac" && !fullScreen,
    maximized,
    minimize: () => webView()?.postMessage("minimize"),
    toggleMaximize: () => webView()?.postMessage("maximize"),
    close: () => webView()?.postMessage("close"),
  };
}

/** Elements on the title bar that take the click themselves instead of moving the window. */
const NO_DRAG = ".no-drag, button, a, input, select, label, [role='tab']";

/**
 * In a dashboard window, behave like an app: no browser context menu (Back, Reload, Print…)
 * except where text can be edited or is selected. In the Mac window, the title bar also moves
 * the window and double-clicks to zoom it, and the window follows the theme on screen.
 */
export function useAppBehaviour() {
  useEffect(() => {
    const frame = currentFrame();
    if (!frame) return;
    const onContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable]")) return;
      if (window.getSelection()?.toString()) return;
      e.preventDefault();
    };
    document.addEventListener("contextmenu", onContextMenu);
    if (frame !== "mac") return () => document.removeEventListener("contextmenu", onContextMenu);

    const host = webKit()!;
    // The window only moves once the pressed mouse does, so a click or double-click is never
    // swallowed by a drag the window starts after the button is already up.
    let armed = false;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      armed = false;
      if (e.button !== 0 || !target?.closest(".drag") || target.closest(NO_DRAG)) return;
      e.preventDefault();
      if (e.detail === 2) host.postMessage({ type: "zoom" });
      else armed = true;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!armed) return;
      armed = false;
      if (e.buttons & 1) host.postMessage({ type: "drag" });
    };
    const disarm = () => (armed = false);
    // The window stays hidden until the page has painted, then animates in complete.
    requestAnimationFrame(() => requestAnimationFrame(() => host.postMessage({ type: "ready" })));
    const root = document.documentElement;
    const reportTheme = () => host.postMessage({ type: "theme", theme: root.dataset.theme === "dark" ? "dark" : "light" });
    reportTheme();
    const observer = new MutationObserver(reportTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", disarm);
    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", disarm);
      observer.disconnect();
    };
  }, []);
}

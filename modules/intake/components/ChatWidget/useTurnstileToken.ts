"use client";

import { useEffect, useState } from "react";

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const SCRIPT_ELEMENT_ID = "cf-turnstile-script";

interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "error-callback"?: () => void;
      "expired-callback"?: () => void;
      appearance?: "always" | "execute" | "interaction-only";
      size?: "normal" | "flexible" | "compact";
    },
  ) => string;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

function siteKey(): string | null {
  const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  return key === "" ? null : key;
}

function loadScriptOnce(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.turnstile) {
      resolve();
      return;
    }

    const existing = document.getElementById(SCRIPT_ELEMENT_ID);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("load")));
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ELEMENT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () => reject(new Error("load")));
    document.head.appendChild(script);
  });
}

export interface TurnstileGate {
  setContainer: (node: HTMLDivElement | null) => void;
  token: string | null;
  isRequired: boolean;
  isReady: boolean;
}

export function useTurnstileToken(isActive: boolean): TurnstileGate {
  const key = siteKey();
  const isRequired = key !== null;

  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [hasFailed, setHasFailed] = useState(false);

  useEffect(() => {
    if (!isActive || key === null || container === null) return;

    let widgetId: string | null = null;
    let cancelled = false;

    loadScriptOnce()
      .then(() => {
        if (cancelled || !window.turnstile) return;

        widgetId = window.turnstile.render(container, {
          sitekey: key,
          appearance: "interaction-only",
          size: "flexible",
          callback: (issued) => setToken(issued),
          "expired-callback": () => setToken(null),
          "error-callback": () => setHasFailed(true),
        });
      })
      .catch(() => setHasFailed(true));

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [isActive, key, container]);

  return {
    setContainer,
    token,
    isRequired,
    isReady: !isRequired || token !== null || hasFailed,
  };
}

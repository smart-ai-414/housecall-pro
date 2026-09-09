"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { PhotoType } from "@/generated/prisma/enums";
import type {
  ApiErrorBody,
  IntakeSessionView,
  SignedUploadResponse,
} from "@/modules/intake/types";

const STORAGE_KEY = "glassbot.intake.credentials";

interface StoredCredentials {
  sessionId: string;
  resumeToken: string;
}

function readStoredCredentials(): StoredCredentials | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as StoredCredentials).sessionId === "string" &&
      typeof (parsed as StoredCredentials).resumeToken === "string"
    ) {
      return parsed as StoredCredentials;
    }
    return null;
  } catch {
    return null;
  }
}

function writeStoredCredentials(credentials: StoredCredentials): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
  } catch {
    return;
  }
}

function clearStoredCredentials(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    return;
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let message = "Something went wrong. Please try again.";
    try {
      const parsed = (await response.json()) as ApiErrorBody;
      if (parsed?.error?.message) message = parsed.error.message;
    } catch {
      message = `Request failed (${response.status})`;
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export interface IntakeSessionController {
  session: IntakeSessionView | null;
  isStarting: boolean;
  isSending: boolean;
  uploadingPhotoType: PhotoType | null;
  error: string | null;
  start: () => Promise<void>;
  sendMessage: (message: string) => Promise<void>;
  uploadPhoto: (photoType: PhotoType, file: File) => Promise<void>;
  submitContactDetails: (input: {
    name: string;
    phone: string;
    email: string;
    serviceAddress: string;
  }) => Promise<void>;
  reset: () => void;
  dismissError: () => void;
}

export function useIntakeSession(): IntakeSessionController {
  const [session, setSession] = useState<IntakeSessionView | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [uploadingPhotoType, setUploadingPhotoType] =
    useState<PhotoType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mountedAtRef = useRef<number>(0);

  useEffect(() => {
    mountedAtRef.current = Date.now();
  }, []);
  const startInFlightRef = useRef(false);

  const credentialsFor = useCallback((current: IntakeSessionView | null) => {
    if (current) {
      return {
        sessionId: current.sessionId,
        resumeToken: current.resumeToken,
      };
    }
    throw new Error("The estimate session has not started yet.");
  }, []);

  const start = useCallback(async () => {
    if (session || startInFlightRef.current) return;

    startInFlightRef.current = true;
    setIsStarting(true);
    setError(null);

    try {
      const stored = readStoredCredentials();

      if (stored) {
        try {
          const resumed = await postJson<IntakeSessionView>(
            "/api/intake/messages",
            { ...stored, message: "I am back." },
          );
          setSession(resumed);
          return;
        } catch {
          clearStoredCredentials();
        }
      }

      const started = await postJson<IntakeSessionView>(
        "/api/intake/sessions",
        { clientRenderedAt: mountedAtRef.current || Date.now() },
      );

      writeStoredCredentials({
        sessionId: started.sessionId,
        resumeToken: started.resumeToken,
      });
      setSession(started);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start.");
    } finally {
      setIsStarting(false);
      startInFlightRef.current = false;
    }
  }, [session]);

  const sendMessage = useCallback(
    async (message: string) => {
      setIsSending(true);
      setError(null);

      try {
        const updated = await postJson<IntakeSessionView>(
          "/api/intake/messages",
          { ...credentialsFor(session), message },
        );
        setSession(updated);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Send failed.");
      } finally {
        setIsSending(false);
      }
    },
    [credentialsFor, session],
  );

  const uploadPhoto = useCallback(
    async (photoType: PhotoType, file: File) => {
      setUploadingPhotoType(photoType);
      setError(null);

      try {
        const credentials = credentialsFor(session);

        const signed = await postJson<SignedUploadResponse>(
          "/api/intake/photo-upload-url",
          {
            ...credentials,
            photoType,
            contentType: file.type,
            byteSize: file.size,
          },
        );

        const uploaded = await fetch(signed.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": signed.requiredContentType },
          body: file,
        });

        if (!uploaded.ok) {
          throw new Error(
            "The photo did not finish uploading. Check your connection and try again.",
          );
        }

        const updated = await postJson<IntakeSessionView>(
          "/api/intake/photo-confirm",
          { ...credentials, photoType, storageKey: signed.storageKey },
        );

        setSession(updated);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Upload failed.");
      } finally {
        setUploadingPhotoType(null);
      }
    },
    [credentialsFor, session],
  );

  const submitContactDetails = useCallback(
    async (input: {
      name: string;
      phone: string;
      email: string;
      serviceAddress: string;
    }) => {
      setIsSending(true);
      setError(null);

      try {
        const updated = await postJson<IntakeSessionView>(
          "/api/intake/contact",
          { ...credentialsFor(session), ...input },
        );
        setSession(updated);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Save failed.");
      } finally {
        setIsSending(false);
      }
    },
    [credentialsFor, session],
  );

  const reset = useCallback(() => {
    clearStoredCredentials();
    setSession(null);
    setError(null);
  }, []);

  const dismissError = useCallback(() => setError(null), []);

  return {
    session,
    isStarting,
    isSending,
    uploadingPhotoType,
    error,
    start,
    sendMessage,
    uploadPhoto,
    submitContactDetails,
    reset,
    dismissError,
  };
}

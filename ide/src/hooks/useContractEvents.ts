/**
 * useContractEvents
 *
 * React hook that drives `createEventSubscriber` and keeps a live, capped
 * list of `ContractEvent` objects in component state.
 *
 * The subscriber is automatically started/stopped/restarted whenever
 * `contractId` or `rpcUrl` changes, and is always cleaned up on unmount.
 *
 * Usage:
 *   const { events, error, isListening } = useContractEvents();
 */

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useWorkspaceStore } from "@/store/workspaceStore";
import {
  createEventSubscriber,
  type ContractEvent,
  type EventSubscriber,
} from "@/utils/eventSubscriber";

const BUFFER_SIZE = 100;
const POLL_INTERVAL_MS = 3_000;

export interface UseContractEventsResult {
  /** Latest events, newest first, capped at BUFFER_SIZE. */
  events: ContractEvent[];
  /** Last error from a failed poll cycle (cleared on next successful poll). */
  error: Error | null;
  /** True while a subscriber is active. */
  isListening: boolean;
  /** Manually clear the event list. */
  clearEvents: () => void;
}

export function useContractEvents(): UseContractEventsResult {
  const { contractId, customRpcUrl } = useWorkspaceStore();

  const [events, setEvents] = useState<ContractEvent[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [isListening, setIsListening] = useState(false);

  // Keep a stable ref to the active subscriber so we can stop it on cleanup
  const subscriberRef = useRef<EventSubscriber | null>(null);

  const handleEvent = useCallback((evt: ContractEvent) => {
    setError(null);
    setEvents((prev) => {
      // Prepend newest event; trim to buffer cap
      const next = [evt, ...prev];
      return next.length > BUFFER_SIZE ? next.slice(0, BUFFER_SIZE) : next;
    });
  }, []);

  const handleError = useCallback((err: Error) => {
    setError(err);
  }, []);

  useEffect(() => {
    // Nothing to subscribe to without a deployed contract
    if (!contractId || !customRpcUrl) {
      subscriberRef.current?.stop();
      subscriberRef.current = null;
      setIsListening(false);
      return;
    }

    // Stop any previous subscriber before creating a new one
    subscriberRef.current?.stop();

    const sub = createEventSubscriber({
      rpcUrl: customRpcUrl,
      contractId,
      onEvent: handleEvent,
      onError: handleError,
      pollIntervalMs: POLL_INTERVAL_MS,
      bufferSize: BUFFER_SIZE,
    });

    subscriberRef.current = sub;
    sub.start();
    setIsListening(true);

    return () => {
      sub.stop();
      setIsListening(false);
    };
  }, [contractId, customRpcUrl, handleEvent, handleError]);

  const clearEvents = useCallback(() => setEvents([]), []);

  return { events, error, isListening, clearEvents };
}

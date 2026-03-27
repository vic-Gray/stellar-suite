/**
 * useProptestOutputWatcher.ts
 *
 * Watches `terminalOutput` from the workspace store and drives
 * `useProptestStore` in real time as `cargo test` output streams in.
 *
 * Mount this hook once at the app level (e.g. inside Index.tsx) so it is
 * always active regardless of which bottom-panel tab is visible.
 *
 * ── How it works ─────────────────────────────────────────────────────────────
 *
 * 1. On every change to `terminalOutput` we re-parse the full string.
 *    (Output is typically < 50 KB so a full re-scan is cheap.)
 *
 * 2. We diff the new parse result against what we've already processed
 *    (tracked in a ref) so we only dispatch incremental store updates.
 *
 * 3. When a new prop_ test name appears we call `startRun`.
 *    When a "pass" event appears we call `recordPass` (once per test).
 *    When a "fail" event appears we call `recordFailure` + `finishRun`.
 *    When the summary line appears we call `finishRun` for any still-running tests.
 */

"use client";

import { useEffect, useRef } from "react";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useProptestStore } from "@/store/useProptestStore";
import {
  parseProptestOutput,
  extractCasesCount,
  type ParsedCounterExample,
} from "@/utils/parseProptestOutput";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WatcherState {
  /** Test names for which startRun has been called. */
  started: Set<string>;
  /** Test names for which a final result (pass/fail) has been dispatched. */
  finished: Set<string>;
  /** Counter-example test names already dispatched. */
  failuresDispatched: Set<string>;
  /** The terminal output string we last processed. */
  lastOutput: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useProptestOutputWatcher(): void {
  const terminalOutput = useWorkspaceStore((s) => s.terminalOutput);
  const {
    startRun,
    recordPass,
    recordFailure,
    finishRun,
    clearResults,
  } = useProptestStore();

  const stateRef = useRef<WatcherState>({
    started: new Set(),
    finished: new Set(),
    failuresDispatched: new Set(),
    lastOutput: "",
  });

  useEffect(() => {
    const state = stateRef.current;

    // Nothing new to process
    if (terminalOutput === state.lastOutput) return;

    // Detect a fresh run: if the output shrank (cleared) reset our tracking
    if (terminalOutput.length < state.lastOutput.length) {
      state.started.clear();
      state.finished.clear();
      state.failuresDispatched.clear();
      clearResults();
    }

    state.lastOutput = terminalOutput;

    // Only bother parsing if there's proptest-related content
    if (!terminalOutput.includes("prop_")) return;

    const { events, counterExamples, summary } =
      parseProptestOutput(terminalOutput);

    const totalCases = extractCasesCount(terminalOutput);

    // ── Start runs for newly seen test names ─────────────────────────────────
    for (const ev of events) {
      if (!state.started.has(ev.testName)) {
        state.started.add(ev.testName);
        startRun(ev.testName, totalCases);
      }
    }

    // ── Dispatch pass events ─────────────────────────────────────────────────
    for (const ev of events) {
      if (ev.type === "pass" && !state.finished.has(ev.testName)) {
        state.finished.add(ev.testName);
        // Mark all cases as passed then finish
        recordPass(ev.testName);
        finishRun(ev.testName);
      }
    }

    // ── Dispatch failure + counter-example ───────────────────────────────────
    const ceByName = new Map<string, ParsedCounterExample>(
      counterExamples.map((ce) => [ce.testName, ce]),
    );

    for (const ev of events) {
      if (ev.type === "fail" && !state.finished.has(ev.testName)) {
        state.finished.add(ev.testName);
        state.failuresDispatched.add(ev.testName);

        const ce = ceByName.get(ev.testName);
        recordFailure(ev.testName, {
          args: ce?.args ?? [],
          message: ce?.message ?? "Test failed",
          shrinkSteps: ce?.shrinkSteps ?? 0,
        });
        finishRun(ev.testName);
      }
    }

    // ── Handle summary: finish any tests still marked running ─────────────────
    if (summary) {
      for (const name of state.started) {
        if (!state.finished.has(name)) {
          state.finished.add(name);
          finishRun(name);
        }
      }
    }
  }, [
    terminalOutput,
    startRun,
    recordPass,
    recordFailure,
    finishRun,
    clearResults,
  ]);
}

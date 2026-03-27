/**
 * useProptestStore
 *
 * Zustand store that holds the live state of a proptest run.
 * ProptestView reads from this; the test runner (or a simulation)
 * writes to it via the exported actions.
 */

import { create } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProptestPhase =
  | "idle"       // nothing running
  | "running"    // cases being generated and tested
  | "shrinking"  // failure found, minimising the counter-example
  | "passed"     // all cases passed
  | "failed";    // shrinking complete, counter-example ready

export interface CounterExample {
  /** The minimised failing input values, one entry per argument. */
  args: { name: string; value: string }[];
  /** The panic message or assertion failure text. */
  message: string;
  /** Number of shrink steps performed before this minimal example was found. */
  shrinkSteps: number;
}

export interface ProptestResult {
  testName: string;
  phase: ProptestPhase;
  /** Cases executed so far. */
  passed: number;
  /** Total cases configured (ProptestConfig.cases). */
  total: number;
  /** Wall-clock ms elapsed since the run started. */
  elapsedMs: number;
  /** Only present when phase === "shrinking" | "failed". */
  counterExample: CounterExample | null;
  /** Current shrink iteration (0 while running, increments during shrinking). */
  shrinkIteration: number;
  /** Max shrink iterations configured. */
  maxShrinkIters: number;
  /** ISO timestamp of when the run started. */
  startedAt: string | null;
  /** ISO timestamp of when the run finished (passed or failed). */
  finishedAt: string | null;
}

interface ProptestState {
  results: ProptestResult[];
  activeTestName: string | null;

  // Actions
  startRun: (testName: string, total: number, maxShrinkIters?: number) => void;
  recordPass: (testName: string) => void;
  recordFailure: (testName: string, counterExample: CounterExample) => void;
  recordShrinkStep: (testName: string, candidate: CounterExample) => void;
  finishRun: (testName: string) => void;
  clearResults: () => void;
  setActiveTest: (testName: string | null) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResult(
  testName: string,
  total: number,
  maxShrinkIters: number,
): ProptestResult {
  return {
    testName,
    phase: "running",
    passed: 0,
    total,
    elapsedMs: 0,
    counterExample: null,
    shrinkIteration: 0,
    maxShrinkIters,
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
}

function updateResult(
  results: ProptestResult[],
  testName: string,
  patch: Partial<ProptestResult>,
): ProptestResult[] {
  return results.map((r) =>
    r.testName === testName ? { ...r, ...patch } : r,
  );
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useProptestStore = create<ProptestState>((set, get) => ({
  results: [],
  activeTestName: null,

  startRun(testName, total, maxShrinkIters = 512) {
    const existing = get().results.find((r) => r.testName === testName);
    const fresh = makeResult(testName, total, maxShrinkIters);
    set({
      results: existing
        ? updateResult(get().results, testName, {
            ...fresh,
            // keep history length stable — replace in-place
          })
        : [...get().results, fresh],
      activeTestName: testName,
    });
  },

  recordPass(testName) {
    const now = Date.now();
    set((state) => ({
      results: updateResult(state.results, testName, (r => ({
        passed: r.passed + 1,
        elapsedMs: r.startedAt
          ? now - new Date(r.startedAt).getTime()
          : r.elapsedMs,
      }))(state.results.find((r) => r.testName === testName)!)),
    }));
  },

  recordFailure(testName, counterExample) {
    set((state) => ({
      results: updateResult(state.results, testName, {
        phase: "shrinking",
        counterExample,
        shrinkIteration: 0,
      }),
    }));
  },

  recordShrinkStep(testName, candidate) {
    set((state) => {
      const r = state.results.find((x) => x.testName === testName);
      if (!r) return state;
      return {
        results: updateResult(state.results, testName, {
          phase: "shrinking",
          counterExample: candidate,
          shrinkIteration: r.shrinkIteration + 1,
        }),
      };
    });
  },

  finishRun(testName) {
    set((state) => {
      const r = state.results.find((x) => x.testName === testName);
      if (!r) return state;
      const finishedAt = new Date().toISOString();
      const elapsedMs = r.startedAt
        ? Date.now() - new Date(r.startedAt).getTime()
        : r.elapsedMs;
      const phase: ProptestPhase =
        r.counterExample ? "failed" : "passed";
      return {
        results: updateResult(state.results, testName, {
          phase,
          finishedAt,
          elapsedMs,
        }),
      };
    });
  },

  clearResults() {
    set({ results: [], activeTestName: null });
  },

  setActiveTest(testName) {
    set({ activeTestName: testName });
  },
}));

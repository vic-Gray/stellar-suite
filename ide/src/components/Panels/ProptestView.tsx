"use client";

/**
 * ProptestView.tsx
 *
 * Bottom-panel pane that visualises a live proptest run:
 *   • Progress bar — cases passed / total, Nufatech blue (#2A66F8)
 *   • Shrinking animation — pulsing indicator while the fuzzer minimises
 *   • Counter-example box — high-contrast amber/red display of the minimal
 *     failing input once shrinking completes
 *   • Per-test result list with pass / fail / shrinking badges
 *
 * State is driven by `useProptestStore`. A "Demo" button simulates a full
 * run so the UI can be verified without a real Rust test runner.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FlaskConical,
  Play,
  Trash2,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Minimize2,
  Clock,
} from "lucide-react";
import {
  useProptestStore,
  type ProptestPhase,
  type ProptestResult,
  type CounterExample,
} from "@/store/useProptestStore";

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

/** Nufatech brand blue — success / progress fill */
const BLUE = "#2A66F8";
/** Soft amber — shrinking state */
const AMBER = "#F59E0B";
/** Soft red — failure state */
const RED = "#EF4444";
/** Muted green — passed state */
const GREEN = "#22C55E";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function pct(passed: number, total: number): number {
  if (total === 0) return 0;
  return Math.min(100, Math.round((passed / total) * 100));
}

// ---------------------------------------------------------------------------
// PhaseBadge
// ---------------------------------------------------------------------------

const PHASE_STYLES: Record<
  ProptestPhase,
  { label: string; color: string; bg: string; border: string }
> = {
  idle:      { label: "idle",      color: "rgba(255,255,255,0.3)",  bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.08)" },
  running:   { label: "running",   color: BLUE,                     bg: "rgba(42,102,248,0.12)",  border: "rgba(42,102,248,0.3)"  },
  shrinking: { label: "shrinking", color: AMBER,                    bg: "rgba(245,158,11,0.10)",  border: "rgba(245,158,11,0.3)"  },
  passed:    { label: "passed",    color: GREEN,                    bg: "rgba(34,197,94,0.10)",   border: "rgba(34,197,94,0.3)"   },
  failed:    { label: "failed",    color: RED,                      bg: "rgba(239,68,68,0.10)",   border: "rgba(239,68,68,0.3)"   },
};

function PhaseBadge({ phase }: { phase: ProptestPhase }) {
  const s = PHASE_STYLES[phase];
  return (
    <span
      className="inline-flex items-center gap-1 rounded border px-1.5 py-px font-mono text-[10px] uppercase tracking-wider"
      style={{ color: s.color, background: s.bg, borderColor: s.border }}
    >
      {phase === "running" && (
        <Loader2 className="h-2.5 w-2.5 animate-spin" aria-hidden="true" />
      )}
      {phase === "shrinking" && (
        <Minimize2 className="h-2.5 w-2.5 animate-pulse" aria-hidden="true" />
      )}
      {phase === "passed" && (
        <CheckCircle2 className="h-2.5 w-2.5" aria-hidden="true" />
      )}
      {phase === "failed" && (
        <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" />
      )}
      {s.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// ProgressBar
// ---------------------------------------------------------------------------

interface ProgressBarProps {
  passed: number;
  total: number;
  phase: ProptestPhase;
}

function ProgressBar({ passed, total, phase }: ProgressBarProps) {
  const percent = pct(passed, total);

  const fillColor =
    phase === "failed" || phase === "shrinking"
      ? RED
      : phase === "passed"
        ? GREEN
        : BLUE;

  return (
    <div className="space-y-1">
      {/* Label row */}
      <div className="flex items-center justify-between font-mono text-[11px]">
        <span style={{ color: fillColor }}>
          {passed.toLocaleString()}
          <span className="text-white/30"> / {total.toLocaleString()} cases</span>
        </span>
        <span className="text-white/30">{percent}%</span>
      </div>

      {/* Track */}
      <div
        className="h-1.5 w-full overflow-hidden rounded-full"
        style={{ background: "rgba(255,255,255,0.07)" }}
        role="progressbar"
        aria-valuenow={passed}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`${passed} of ${total} test cases passed`}
      >
        <div
          className="h-full rounded-full transition-all duration-150 ease-out"
          style={{
            width: `${percent}%`,
            background: fillColor,
            boxShadow: phase === "running" ? `0 0 6px ${fillColor}80` : "none",
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ShrinkingIndicator
// ---------------------------------------------------------------------------

interface ShrinkingIndicatorProps {
  iteration: number;
  maxIters: number;
  candidate: CounterExample | null;
}

function ShrinkingIndicator({
  iteration,
  maxIters,
  candidate,
}: ShrinkingIndicatorProps) {
  return (
    <div
      className="rounded border px-3 py-2.5 space-y-2"
      style={{
        borderColor: "rgba(245,158,11,0.25)",
        background: "rgba(245,158,11,0.05)",
      }}
      role="status"
      aria-live="polite"
      aria-label="Shrinking counter-example"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <Minimize2
          className="h-3.5 w-3.5 animate-pulse"
          style={{ color: AMBER }}
          aria-hidden="true"
        />
        <span
          className="font-mono text-[11px] font-semibold"
          style={{ color: AMBER }}
        >
          Shrinking counter-example
        </span>
        <span className="ml-auto font-mono text-[10px] text-white/30">
          step {iteration} / {maxIters}
        </span>
      </div>

      {/* Shrink progress bar */}
      <div
        className="h-1 w-full overflow-hidden rounded-full"
        style={{ background: "rgba(255,255,255,0.07)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-200"
          style={{
            width: `${pct(iteration, maxIters)}%`,
            background: AMBER,
          }}
        />
      </div>

      {/* Current candidate */}
      {candidate && (
        <div className="space-y-1">
          <p className="font-mono text-[10px] text-white/30 uppercase tracking-wider">
            Current candidate
          </p>
          <div className="space-y-0.5">
            {candidate.args.map((a) => (
              <div key={a.name} className="flex gap-2 font-mono text-[11px]">
                <span className="text-white/40 shrink-0">{a.name}:</span>
                <span style={{ color: AMBER }}>{a.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CounterExampleBox
// ---------------------------------------------------------------------------

interface CounterExampleBoxProps {
  example: CounterExample;
}

function CounterExampleBox({ example }: CounterExampleBoxProps) {
  return (
    <div
      className="rounded border px-3 py-2.5 space-y-2.5"
      style={{
        borderColor: "rgba(239,68,68,0.35)",
        background: "rgba(239,68,68,0.07)",
      }}
      role="alert"
      aria-label="Counter-example found"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <AlertTriangle
          className="h-3.5 w-3.5 shrink-0"
          style={{ color: RED }}
          aria-hidden="true"
        />
        <span
          className="font-mono text-[11px] font-semibold"
          style={{ color: RED }}
        >
          Counter-example found
        </span>
        <span className="ml-auto font-mono text-[10px] text-white/30">
          after {example.shrinkSteps} shrink step
          {example.shrinkSteps !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Minimised inputs */}
      <div
        className="rounded border px-2.5 py-2 space-y-1"
        style={{
          borderColor: "rgba(239,68,68,0.2)",
          background: "rgba(0,0,0,0.25)",
        }}
      >
        <p className="font-mono text-[10px] uppercase tracking-wider text-white/30 mb-1.5">
          Minimal failing input
        </p>
        {example.args.map((a) => (
          <div key={a.name} className="flex gap-2 font-mono text-[11px]">
            <span className="text-white/40 shrink-0 min-w-[80px]">{a.name}:</span>
            <span
              className="font-semibold break-all"
              style={{ color: "#FCA5A5" }}
            >
              {a.value}
            </span>
          </div>
        ))}
      </div>

      {/* Failure message */}
      <div
        className="rounded border px-2.5 py-2"
        style={{
          borderColor: "rgba(239,68,68,0.15)",
          background: "rgba(0,0,0,0.2)",
        }}
      >
        <p className="font-mono text-[10px] uppercase tracking-wider text-white/30 mb-1">
          Failure reason
        </p>
        <pre
          className="font-mono text-[11px] whitespace-pre-wrap break-all leading-relaxed"
          style={{ color: "#FCA5A5" }}
        >
          {example.message}
        </pre>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ResultRow — collapsible per-test result
// ---------------------------------------------------------------------------

interface ResultRowProps {
  result: ProptestResult;
  isActive: boolean;
  onClick: () => void;
}

function ResultRow({ result, isActive, onClick }: ResultRowProps) {
  const { phase, passed, total, elapsedMs, testName } = result;

  const rowBg = isActive
    ? "rgba(42,102,248,0.06)"
    : "transparent";

  return (
    <div
      className="border-b"
      style={{ borderColor: "rgba(255,255,255,0.05)", background: rowBg }}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary/30"
      >
        {isActive ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-white/30" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-white/30" aria-hidden="true" />
        )}

        {/* Test name */}
        <span className="flex-1 truncate font-mono text-[11px] text-white/70">
          {testName}
        </span>

        {/* Elapsed */}
        {elapsedMs > 0 && (
          <span className="shrink-0 font-mono text-[10px] text-white/25 flex items-center gap-0.5">
            <Clock className="h-2.5 w-2.5" aria-hidden="true" />
            {formatMs(elapsedMs)}
          </span>
        )}

        <PhaseBadge phase={phase} />
      </button>

      {/* Expanded detail */}
      {isActive && (
        <div className="px-3 pb-3 pt-1 space-y-2.5">
          <ProgressBar passed={passed} total={total} phase={phase} />

          {phase === "shrinking" && (
            <ShrinkingIndicator
              iteration={result.shrinkIteration}
              maxIters={result.maxShrinkIters}
              candidate={result.counterExample}
            />
          )}

          {phase === "failed" && result.counterExample && (
            <CounterExampleBox example={result.counterExample} />
          )}

          {phase === "passed" && (
            <div
              className="flex items-center gap-2 rounded border px-2.5 py-2 font-mono text-[11px]"
              style={{
                borderColor: "rgba(34,197,94,0.25)",
                background: "rgba(34,197,94,0.06)",
                color: GREEN,
              }}
              role="status"
            >
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              All {total.toLocaleString()} cases passed in {formatMs(elapsedMs)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Demo simulation — lets the UI be verified without a real test runner
// ---------------------------------------------------------------------------

const DEMO_TESTS = [
  {
    name: "prop_transfer_conserves_balance",
    total: 256,
    outcome: "passed" as const,
  },
  {
    name: "prop_fee_no_overflow",
    total: 128,
    outcome: "failed" as const,
    counterExample: {
      args: [
        { name: "amount", value: "9_223_372_036_854_775_807i128" },
        { name: "bps",    value: "10_000u32" },
      ],
      message:
        'thread \'prop_fee_no_overflow\' panicked at \'assertion failed: fee <= amount\nfee=9223372036854775807 amount=9223372036854775807\', src/lib.rs:42:9',
      shrinkSteps: 14,
    },
  },
  {
    name: "prop_counter_is_monotonic",
    total: 64,
    outcome: "passed" as const,
  },
];

function useDemoRunner() {
  const { startRun, recordPass, recordFailure, recordShrinkStep, finishRun } =
    useProptestStore();

  return useCallback(() => {
    DEMO_TESTS.forEach((test, testIdx) => {
      const delay = testIdx * 1800;
      const { name, total, outcome } = test;

      setTimeout(() => {
        startRun(name, total, 64);

        // Tick passes at ~20ms intervals
        const passInterval = Math.max(8, Math.floor(1200 / total));
        let passed = 0;

        const ticker = setInterval(() => {
          passed += Math.ceil(total / 60);
          if (passed >= total) {
            passed = total;
            clearInterval(ticker);

            if (outcome === "failed" && test.counterExample) {
              // Record initial failure
              recordFailure(name, { ...test.counterExample, shrinkSteps: 0 });

              // Simulate shrinking steps
              let step = 0;
              const maxSteps = 14;
              const shrinkInterval = setInterval(() => {
                step++;
                const shrunkArgs = test.counterExample!.args.map((a) => ({
                  ...a,
                  value:
                    step < maxSteps
                      ? `${a.value} → shrinking…`
                      : test.counterExample!.args.find(
                          (x) => x.name === a.name,
                        )!.value,
                }));
                recordShrinkStep(name, {
                  args: shrunkArgs,
                  message: test.counterExample!.message,
                  shrinkSteps: step,
                });

                if (step >= maxSteps) {
                  clearInterval(shrinkInterval);
                  // Final minimal counter-example
                  recordShrinkStep(name, test.counterExample!);
                  setTimeout(() => finishRun(name), 200);
                }
              }, 120);
            } else {
              setTimeout(() => finishRun(name), 100);
            }
          } else {
            recordPass(name);
          }
        }, passInterval);
      }, delay);
    });
  }, [startRun, recordPass, recordFailure, recordShrinkStep, finishRun]);
}

// ---------------------------------------------------------------------------
// ProptestView — root component
// ---------------------------------------------------------------------------

export function ProptestView() {
  const { results, activeTestName, clearResults, setActiveTest } =
    useProptestStore();

  const runDemo = useDemoRunner();

  // Auto-select the first result when results appear
  useEffect(() => {
    if (results.length > 0 && activeTestName === null) {
      setActiveTest(results[0].testName);
    }
  }, [results, activeTestName, setActiveTest]);

  // Auto-select a newly started test
  useEffect(() => {
    const running = results.find((r) => r.phase === "running" || r.phase === "shrinking");
    if (running) setActiveTest(running.testName);
  }, [results, setActiveTest]);

  const summary = useMemo(() => {
    const total = results.length;
    const passed = results.filter((r) => r.phase === "passed").length;
    const failed = results.filter((r) => r.phase === "failed").length;
    const running = results.filter(
      (r) => r.phase === "running" || r.phase === "shrinking",
    ).length;
    return { total, passed, failed, running };
  }, [results]);

  const hasResults = results.length > 0;

  return (
    <div
      className="flex h-full flex-col overflow-hidden font-mono"
      style={{ background: "#0B1120" }}
    >
      {/* ── Header ── */}
      <div
        className="flex shrink-0 items-center gap-2 border-b px-3 py-1.5"
        style={{ borderColor: "rgba(255,255,255,0.07)" }}
      >
        <FlaskConical
          className="h-3.5 w-3.5 shrink-0"
          style={{ color: BLUE }}
          aria-hidden="true"
        />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
          Proptest
        </span>

        {/* Summary chips */}
        {hasResults && (
          <div className="flex items-center gap-1.5 ml-1">
            {summary.passed > 0 && (
              <span
                className="rounded px-1.5 py-px text-[10px]"
                style={{ color: GREEN, background: "rgba(34,197,94,0.1)" }}
              >
                {summary.passed} passed
              </span>
            )}
            {summary.failed > 0 && (
              <span
                className="rounded px-1.5 py-px text-[10px]"
                style={{ color: RED, background: "rgba(239,68,68,0.1)" }}
              >
                {summary.failed} failed
              </span>
            )}
            {summary.running > 0 && (
              <span
                className="rounded px-1.5 py-px text-[10px] flex items-center gap-1"
                style={{ color: BLUE, background: "rgba(42,102,248,0.1)" }}
              >
                <Loader2 className="h-2.5 w-2.5 animate-spin" aria-hidden="true" />
                {summary.running} running
              </span>
            )}
          </div>
        )}

        <div className="ml-auto flex items-center gap-1">
          {/* Demo button — simulates a full run for UI verification */}
          <button
            type="button"
            onClick={runDemo}
            disabled={summary.running > 0}
            className="flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] transition-colors disabled:pointer-events-none disabled:opacity-40"
            style={{
              color: BLUE,
              borderColor: `${BLUE}40`,
              background: `${BLUE}10`,
            }}
            title="Simulate a proptest run (demo)"
            aria-label="Run demo simulation"
          >
            <Play className="h-2.5 w-2.5" aria-hidden="true" />
            Demo
          </button>

          {/* Clear */}
          {hasResults && (
            <button
              type="button"
              onClick={clearResults}
              disabled={summary.running > 0}
              className="rounded p-1 text-white/25 transition-colors hover:text-white/60 disabled:pointer-events-none disabled:opacity-40"
              aria-label="Clear results"
              title="Clear results"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      {!hasResults ? (
        <EmptyState onDemo={runDemo} />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {results.map((r) => (
            <ResultRow
              key={r.testName}
              result={r}
              isActive={activeTestName === r.testName}
              onClick={() =>
                setActiveTest(
                  activeTestName === r.testName ? null : r.testName,
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------

function EmptyState({ onDemo }: { onDemo: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
      <FlaskConical
        className="h-8 w-8 opacity-20"
        style={{ color: BLUE }}
        aria-hidden="true"
      />
      <div className="text-center space-y-1">
        <p className="text-[12px] text-white/30">No proptest results yet</p>
        <p className="text-[11px] text-white/20">
          Run{" "}
          <span
            className="font-mono rounded px-1 py-px"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            cargo test
          </span>{" "}
          with proptest enabled, or try the demo
        </p>
      </div>
      <button
        type="button"
        onClick={onDemo}
        className="flex items-center gap-1.5 rounded border px-3 py-1.5 text-[11px] transition-colors"
        style={{
          color: BLUE,
          borderColor: `${BLUE}40`,
          background: `${BLUE}0D`,
        }}
      >
        <Play className="h-3 w-3" aria-hidden="true" />
        Run demo simulation
      </button>
    </div>
  );
}

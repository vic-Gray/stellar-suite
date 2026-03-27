/**
 * parseProptestOutput.ts
 *
 * Parses the text output of `cargo test` when proptest is in use and extracts
 * structured data that can be fed directly into `useProptestStore`.
 *
 * ── Real proptest output format ──────────────────────────────────────────────
 *
 * Passing run:
 *   test prop_tests::prop_transfer_conserves_balance ... ok
 *
 * Failing run (proptest prints its own block before the standard FAILED line):
 *   thread 'prop_tests::prop_fee_no_overflow' panicked at 'assertion failed: fee <= amount
 *   fee=9223372036854775807 amount=9223372036854775807', src/lib.rs:42:9
 *   note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace
 *   thread 'prop_tests::prop_fee_no_overflow' panicked at 'proptest: Test failed: ...
 *   Minimal failing input:
 *       amount = 9223372036854775807
 *       bps = 10000
 *   Shrunk 14 time(s) to above input.
 *   test prop_tests::prop_fee_no_overflow ... FAILED
 *
 * Summary line:
 *   test result: FAILED. 2 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out
 *   test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
 *
 * ── Strategies ───────────────────────────────────────────────────────────────
 *
 * We scan line-by-line and maintain a small state machine per test name.
 * The parser is intentionally lenient — it never throws, and unknown lines
 * are silently ignored.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParsedTestEvent {
  type: "pass" | "fail" | "start";
  testName: string;
}

export interface ParsedCounterExample {
  testName: string;
  /** Parsed key=value pairs from the "Minimal failing input:" block. */
  args: { name: string; value: string }[];
  /** The raw panic message (first panic line for this test). */
  message: string;
  /** Number reported by "Shrunk N time(s)" */
  shrinkSteps: number;
}

export interface ParsedSummary {
  passed: number;
  failed: number;
  total: number;
  ok: boolean;
}

export interface ProptestParseResult {
  events: ParsedTestEvent[];
  counterExamples: ParsedCounterExample[];
  summary: ParsedSummary | null;
}

// ---------------------------------------------------------------------------
// Regex patterns
// ---------------------------------------------------------------------------

// "test some::path::prop_foo ... ok"  or  "... FAILED"
const TEST_RESULT_RE = /^test\s+([\w:]+)\s+\.\.\.\s+(ok|FAILED|ignored)$/;

// "test some::path::prop_foo" — running line (no result yet, rare but present
// with --nocapture)
const TEST_RUNNING_RE = /^test\s+([\w:]+)\s*$/;

// proptest "Minimal failing input:" block header
const MINIMAL_INPUT_HEADER_RE = /^\s*Minimal failing input:/;

// A key = value line inside the minimal-input block
// Handles:  "    amount = 9223372036854775807"
//           "    bps = 10000"
const INPUT_KV_RE = /^\s{2,}(\w+)\s*=\s*(.+)$/;

// "Shrunk N time(s) to above input."
const SHRUNK_RE = /Shrunk\s+(\d+)\s+time/;

// First panic line for a test:
// "thread 'some::path::prop_foo' panicked at '..."
const PANIC_RE = /^thread\s+'([\w:]+)'\s+panicked at\s+'(.+)/;

// Summary: "test result: ok. 3 passed; 1 failed; ..."
const SUMMARY_RE =
  /^test result:\s+(ok|FAILED)\.\s+(\d+)\s+passed;\s+(\d+)\s+failed/;

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parse a complete or partial `cargo test` output string.
 *
 * Safe to call incrementally — pass the full accumulated terminal string each
 * time; the parser re-scans from scratch (output is typically < 50 KB).
 */
export function parseProptestOutput(raw: string): ProptestParseResult {
  const lines = raw.split(/\r?\n/);

  const events: ParsedTestEvent[] = [];
  const counterExamples: ParsedCounterExample[] = [];
  let summary: ParsedSummary | null = null;

  // Per-test accumulation state
  const panicMessages: Map<string, string> = new Map();
  const shrinkSteps: Map<string, number> = new Map();

  // State machine for the "Minimal failing input:" block
  let inMinimalBlock = false;
  let minimalBlockTest: string | null = null;
  const minimalArgs: { name: string; value: string }[] = [];

  for (const line of lines) {
    // ── Panic line ──────────────────────────────────────────────────────────
    const panicMatch = PANIC_RE.exec(line);
    if (panicMatch) {
      const name = panicMatch[1];
      const msg = panicMatch[2].replace(/'$/, ""); // strip trailing quote
      if (!panicMessages.has(name)) {
        panicMessages.set(name, msg);
      }
      continue;
    }

    // ── Shrunk line ─────────────────────────────────────────────────────────
    const shrunkMatch = SHRUNK_RE.exec(line);
    if (shrunkMatch && minimalBlockTest) {
      shrinkSteps.set(minimalBlockTest, parseInt(shrunkMatch[1], 10));
      continue;
    }

    // ── Minimal failing input header ────────────────────────────────────────
    if (MINIMAL_INPUT_HEADER_RE.test(line)) {
      inMinimalBlock = true;
      // The test name was set by the most recent panic line
      minimalBlockTest =
        panicMessages.size > 0
          ? [...panicMessages.keys()].at(-1) ?? null
          : null;
      minimalArgs.length = 0;
      continue;
    }

    // ── Key=value lines inside the minimal block ────────────────────────────
    if (inMinimalBlock) {
      const kvMatch = INPUT_KV_RE.exec(line);
      if (kvMatch) {
        minimalArgs.push({ name: kvMatch[1], value: kvMatch[2].trim() });
        continue;
      }
      // Any non-kv line ends the block
      if (line.trim() !== "") {
        inMinimalBlock = false;
      }
    }

    // ── Test result line ────────────────────────────────────────────────────
    const resultMatch = TEST_RESULT_RE.exec(line);
    if (resultMatch) {
      const testName = resultMatch[1];
      const outcome = resultMatch[2];

      if (outcome === "ok") {
        events.push({ type: "pass", testName });
      } else if (outcome === "FAILED") {
        events.push({ type: "fail", testName });

        // Flush accumulated counter-example data for this test
        const msg = panicMessages.get(testName) ?? "Test failed";
        const steps = shrinkSteps.get(testName) ?? 0;

        // Use the minimal args we collected, or fall back to empty
        counterExamples.push({
          testName,
          args: minimalBlockTest === testName ? [...minimalArgs] : [],
          message: msg,
          shrinkSteps: steps,
        });
      }
      continue;
    }

    // ── Running line (test started) ─────────────────────────────────────────
    const runningMatch = TEST_RUNNING_RE.exec(line);
    if (runningMatch) {
      events.push({ type: "start", testName: runningMatch[1] });
      continue;
    }

    // ── Summary line ────────────────────────────────────────────────────────
    const summaryMatch = SUMMARY_RE.exec(line);
    if (summaryMatch) {
      const passed = parseInt(summaryMatch[2], 10);
      const failed = parseInt(summaryMatch[3], 10);
      summary = {
        ok: summaryMatch[1] === "ok",
        passed,
        failed,
        total: passed + failed,
      };
    }
  }

  return { events, counterExamples, summary };
}

// ---------------------------------------------------------------------------
// Helpers for the watcher hook
// ---------------------------------------------------------------------------

/**
 * Extract all unique prop_ test names mentioned in the output.
 * Used to seed `startRun` calls before the result lines appear.
 */
export function extractPropTestNames(raw: string): string[] {
  const names = new Set<string>();
  for (const line of raw.split(/\r?\n/)) {
    const m = TEST_RESULT_RE.exec(line) ?? TEST_RUNNING_RE.exec(line);
    if (m && m[1].includes("prop_")) {
      names.add(m[1]);
    }
    const p = PANIC_RE.exec(line);
    if (p && p[1].includes("prop_")) {
      names.add(p[1]);
    }
  }
  return [...names];
}

/**
 * Parse the ProptestConfig cases count from terminal output.
 * proptest prints: "proptest: Saving this test vector to file: ..."
 * or we can look for the config line if verbose.
 * Falls back to 100 if not found.
 */
export function extractCasesCount(raw: string): number {
  // Look for "Running N tests" or "test result: ... N passed"
  const summaryMatch = SUMMARY_RE.exec(raw);
  if (summaryMatch) {
    return parseInt(summaryMatch[2], 10) + parseInt(summaryMatch[3], 10);
  }
  return 100;
}

"use client";

/**
 * GeneratePropertyTest.tsx
 *
 * A focused "Generate Property Test" panel that lives in the Testing/ directory.
 *
 * Features
 * ────────
 * • Form-driven snippet builder — the user fills in contract name, function
 *   name, argument names/types, and a strategy; the component renders a
 *   syntactically correct proptest! block in real time.
 *
 * • One-click "Insert into editor" — appends the generated code to the
 *   currently active .rs file via the workspace store.
 *
 * • "Copy to clipboard" fallback.
 *
 * • Strategy reference table — shows the most common proptest strategies for
 *   Soroban types so the developer doesn't have to look them up.
 *
 * The generated Rust is verified against the proptest crate syntax:
 *   - Uses `proptest! { #[test] fn … }` macro form
 *   - Strategies follow `arg in strategy` syntax
 *   - Imports are included in the output
 */

import React, { useState, useCallback, useMemo } from "react";
import {
  FlaskConical,
  Plus,
  Trash2,
  Copy,
  Check,
  PackagePlus,
  ChevronDown,
  ChevronRight,
  Info,
} from "lucide-react";
import { useWorkspaceStore } from "@/store/workspaceStore";

// ---------------------------------------------------------------------------
// Strategy catalogue
// ---------------------------------------------------------------------------

interface StrategyEntry {
  label: string;
  strategy: string;
  rustType: string;
  description: string;
}

const STRATEGY_CATALOGUE: StrategyEntry[] = [
  // Integers
  { label: "any u64",          strategy: "any::<u64>()",                rustType: "u64",   description: "Any 64-bit unsigned integer" },
  { label: "any u32",          strategy: "any::<u32>()",                rustType: "u32",   description: "Any 32-bit unsigned integer" },
  { label: "any i128",         strategy: "any::<i128>()",               rustType: "i128",  description: "Any 128-bit signed integer" },
  { label: "token amount",     strategy: "0i128..=100_000_000i128",     rustType: "i128",  description: "Valid Soroban token amount range" },
  { label: "counter u32",      strategy: "1u32..=1_000u32",             rustType: "u32",   description: "Bounded counter range" },
  { label: "timestamp",        strategy: "0u64..=1_700_000_000u64",     rustType: "u64",   description: "Unix timestamp range" },
  { label: "basis points",     strategy: "1u32..=10_000u32",            rustType: "u32",   description: "Fee in basis points (0.01%–100%)" },
  { label: "ledger seq",       strategy: "1u32..=u32::MAX",             rustType: "u32",   description: "Ledger sequence number" },
  // Booleans
  { label: "any bool",         strategy: "any::<bool>()",               rustType: "bool",  description: "Any boolean value" },
  // Address seed (derive address from u64 seed)
  { label: "address seed",     strategy: "0u64..=u64::MAX",             rustType: "u64",   description: "Seed for Address::generate (set as ledger seq)" },
  // Strings (Soroban uses fixed-length symbols)
  { label: "symbol length",    strategy: "1usize..=32usize",            rustType: "usize", description: "Valid Soroban Symbol length" },
];

// ---------------------------------------------------------------------------
// Argument row
// ---------------------------------------------------------------------------

interface ArgRow {
  id: number;
  name: string;
  strategy: string;
}

let nextId = 1;
function makeArg(name = "", strategy = ""): ArgRow {
  return { id: nextId++, name, strategy };
}

// ---------------------------------------------------------------------------
// Code generator
// ---------------------------------------------------------------------------

function generateSnippet(
  contractName: string,
  fnName: string,
  testFnName: string,
  args: ArgRow[],
  assertBody: string,
): string {
  const validArgs = args.filter((a) => a.name.trim() && a.strategy.trim());

  const argList = validArgs
    .map((a) => `        ${a.name.trim()} in ${a.strategy.trim()}`)
    .join(",\n");

  const argRefs = validArgs.map((a) => `&${a.name.trim()}`).join(", ");

  const contractIdent = contractName.trim() || "MyContract";
  const fn = fnName.trim() || "my_fn";
  const testFn = testFnName.trim() || `prop_${fn}`;
  const body = assertBody.trim() || `prop_assert!(result >= 0, "result must be non-negative");`;

  const argsBlock = validArgs.length > 0 ? `(\n${argList},\n    )` : "()";

  return `#[cfg(test)]
mod prop_tests {
    use super::*;
    use proptest::prelude::*;
    use soroban_sdk::{testutils::Address as _, Address, Env};

    proptest! {
        #[test]
        fn ${testFn}${argsBlock} {
            let env = Env::default();
            env.mock_all_auths();
            let contract_id = env.register(${contractIdent}, ());
            let client = ${contractIdent}Client::new(&env, &contract_id);

            let result = client.${fn}(${argRefs});
            ${body}
        }
    }
}`;
}

// ---------------------------------------------------------------------------
// StrategyRef — collapsible reference table
// ---------------------------------------------------------------------------

function StrategyRef() {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded border border-border text-[11px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-2.5 py-2 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary/40"
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <Info className="h-3 w-3 shrink-0 text-primary/70" aria-hidden="true" />
        <span className="font-semibold text-foreground">Strategy reference</span>
      </button>

      {open && (
        <div className="border-t border-border overflow-x-auto">
          <table className="w-full font-mono text-[10px]">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-2.5 py-1.5 text-left font-semibold text-muted-foreground">Strategy</th>
                <th className="px-2.5 py-1.5 text-left font-semibold text-muted-foreground">Type</th>
                <th className="px-2.5 py-1.5 text-left font-semibold text-muted-foreground">Description</th>
              </tr>
            </thead>
            <tbody>
              {STRATEGY_CATALOGUE.map((s) => (
                <tr key={s.label} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="px-2.5 py-1 text-primary/80">{s.strategy}</td>
                  <td className="px-2.5 py-1 text-muted-foreground">{s.rustType}</td>
                  <td className="px-2.5 py-1 text-muted-foreground">{s.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// GeneratePropertyTest
// ---------------------------------------------------------------------------

export function GeneratePropertyTest() {
  const { activeTabPath, files, updateFileContent } = useWorkspaceStore();

  const [contractName, setContractName] = useState("MyContract");
  const [fnName, setFnName] = useState("my_fn");
  const [testFnName, setTestFnName] = useState("prop_my_fn");
  const [args, setArgs] = useState<ArgRow[]>([
    makeArg("amount", "0i128..=100_000_000i128"),
  ]);
  const [assertBody, setAssertBody] = useState(
    'prop_assert!(result >= 0i128, "result must be non-negative");',
  );
  const [copied, setCopied] = useState(false);
  const [inserted, setInserted] = useState(false);

  // Sync test fn name when fn name changes (unless user has customised it)
  const [testFnCustomised, setTestFnCustomised] = useState(false);
  const handleFnNameChange = useCallback(
    (v: string) => {
      setFnName(v);
      if (!testFnCustomised) {
        setTestFnName(`prop_${v}`);
      }
    },
    [testFnCustomised],
  );

  // Resolve active .rs file
  const activeFile = useMemo(() => {
    const find = (nodes: typeof files, parts: string[]): (typeof files)[0] | null => {
      for (const n of nodes) {
        if (n.name === parts[0]) {
          if (parts.length === 1) return n;
          if (n.children) return find(n.children, parts.slice(1));
        }
      }
      return null;
    };
    return find(files, activeTabPath);
  }, [files, activeTabPath]);

  const isRustFile =
    activeFile?.type === "file" && (activeFile.name?.endsWith(".rs") ?? false);

  // Generated code
  const generated = useMemo(
    () => generateSnippet(contractName, fnName, testFnName, args, assertBody),
    [contractName, fnName, testFnName, args, assertBody],
  );

  // Arg management
  const addArg = useCallback(() => setArgs((prev) => [...prev, makeArg()]), []);
  const removeArg = useCallback(
    (id: number) => setArgs((prev) => prev.filter((a) => a.id !== id)),
    [],
  );
  const updateArg = useCallback(
    (id: number, field: "name" | "strategy", value: string) =>
      setArgs((prev) =>
        prev.map((a) => (a.id === id ? { ...a, [field]: value } : a)),
      ),
    [],
  );

  // Insert into editor
  const handleInsert = useCallback(() => {
    if (!isRustFile || !activeFile) return;
    const current = activeFile.content ?? "";
    const sep = current.endsWith("\n") ? "\n" : "\n\n";
    updateFileContent(activeTabPath, current + sep + generated + "\n");
    setInserted(true);
    setTimeout(() => setInserted(false), 1500);
  }, [activeFile, activeTabPath, generated, isRustFile, updateFileContent]);

  // Copy to clipboard
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(generated);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [generated]);

  return (
    <div className="flex h-full flex-col bg-sidebar overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-sidebar-border px-3 py-2 shrink-0">
        <FlaskConical className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Generate Property Test
        </span>
      </div>

      {/* Active file banner */}
      <div className="border-b border-sidebar-border px-3 py-1.5 text-[10px] shrink-0">
        {isRustFile ? (
          <span className="text-muted-foreground">
            Target:{" "}
            <span className="font-mono text-foreground">{activeTabPath.join("/")}</span>
          </span>
        ) : (
          <span className="text-amber-400/70">
            Open a <span className="font-mono">.rs</span> file to enable insertion
          </span>
        )}
      </div>

      <div className="flex-1 space-y-4 p-3">
        {/* ── Contract & function ── */}
        <section className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Contract
          </p>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-[10px] text-muted-foreground">Contract name</span>
              <input
                value={contractName}
                onChange={(e) => setContractName(e.target.value)}
                placeholder="MyContract"
                className="w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px] text-foreground outline-none focus:ring-1 focus:ring-primary/50"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] text-muted-foreground">Function name</span>
              <input
                value={fnName}
                onChange={(e) => handleFnNameChange(e.target.value)}
                placeholder="my_fn"
                className="w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px] text-foreground outline-none focus:ring-1 focus:ring-primary/50"
              />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-[10px] text-muted-foreground">Test function name</span>
            <input
              value={testFnName}
              onChange={(e) => {
                setTestFnCustomised(true);
                setTestFnName(e.target.value);
              }}
              placeholder="prop_my_fn"
              className="w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px] text-foreground outline-none focus:ring-1 focus:ring-primary/50"
            />
          </label>
        </section>

        {/* ── Arguments ── */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Arguments
            </p>
            <button
              type="button"
              onClick={addArg}
              className="flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <Plus className="h-3 w-3" aria-hidden="true" />
              Add
            </button>
          </div>

          {args.length === 0 && (
            <p className="text-[10px] text-muted-foreground italic">
              No arguments — test will call fn with no parameters.
            </p>
          )}

          {args.map((arg) => (
            <div key={arg.id} className="flex items-center gap-1.5">
              <input
                value={arg.name}
                onChange={(e) => updateArg(arg.id, "name", e.target.value)}
                placeholder="arg_name"
                aria-label="Argument name"
                className="w-24 shrink-0 rounded border border-border bg-background px-2 py-1 font-mono text-[11px] text-foreground outline-none focus:ring-1 focus:ring-primary/50"
              />
              <span className="text-[10px] text-muted-foreground shrink-0">in</span>
              <input
                value={arg.strategy}
                onChange={(e) => updateArg(arg.id, "strategy", e.target.value)}
                placeholder="0i128..=100_000_000i128"
                aria-label="Proptest strategy"
                className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 font-mono text-[11px] text-foreground outline-none focus:ring-1 focus:ring-primary/50"
              />
              <button
                type="button"
                onClick={() => removeArg(arg.id)}
                className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-destructive"
                aria-label={`Remove argument ${arg.name}`}
              >
                <Trash2 className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
          ))}
        </section>

        {/* ── Assertion body ── */}
        <section className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Assertion
          </p>
          <textarea
            value={assertBody}
            onChange={(e) => setAssertBody(e.target.value)}
            rows={3}
            placeholder='prop_assert!(result >= 0i128, "must be non-negative");'
            className="w-full resize-y rounded border border-border bg-background px-2 py-1.5 font-mono text-[11px] text-foreground outline-none focus:ring-1 focus:ring-primary/50"
          />
        </section>

        {/* ── Strategy reference ── */}
        <StrategyRef />

        {/* ── Preview ── */}
        <section className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Generated code
          </p>
          <pre className="overflow-x-auto rounded bg-[#0d1117] p-2.5 font-mono text-[10px] text-[#e6edf3] leading-relaxed whitespace-pre">
            {generated}
          </pre>
        </section>

        {/* ── Actions ── */}
        <div className="flex items-center gap-2 pb-2">
          <button
            type="button"
            onClick={handleInsert}
            disabled={!isRustFile}
            className="flex items-center gap-1.5 rounded bg-primary/15 px-3 py-1.5 font-mono text-[11px] text-primary transition-colors hover:bg-primary/25 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
          >
            {inserted ? (
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <PackagePlus className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {inserted ? "Inserted" : "Insert into editor"}
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded border border-border px-3 py-1.5 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-400" aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}

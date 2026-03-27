import { describe, expect, it } from "vitest";

import { computeRustFoldingRanges } from "@/lib/rustFolding";

describe("computeRustFoldingRanges", () => {
  it("folds Rust brace blocks across modules and functions", () => {
    const source = [
      "mod outer {",
      "    pub fn run() {",
      "        if true {",
      "            println!(\"hi\");",
      "        }",
      "    }",
      "}",
    ].join("\n");

    expect(computeRustFoldingRanges(source)).toEqual([
      { start: 1, end: 7 },
      { start: 2, end: 6 },
      { start: 3, end: 5 },
    ]);
  });

  it("folds consecutive Rust line comments and block comments", () => {
    const source = [
      "// alpha",
      "// beta",
      "fn main() {}",
      "/* one",
      "two",
      "three */",
    ].join("\n");

    expect(computeRustFoldingRanges(source)).toEqual([
      { start: 1, end: 2, kind: "comment" },
      { start: 4, end: 6, kind: "comment" },
    ]);
  });

  it("supports explicit region markers without merging them into normal comments", () => {
    const source = [
      "// #region setup",
      "fn setup() {",
      "    // body",
      "}",
      "// #endregion",
      "// trailing",
      "// comment",
    ].join("\n");

    expect(computeRustFoldingRanges(source)).toEqual([
      { start: 1, end: 5, kind: "region" },
      { start: 2, end: 4 },
      { start: 6, end: 7, kind: "comment" },
    ]);
  });

  it("ignores braces that appear inside strings and raw strings", () => {
    const source = [
      "fn main() {",
      "    let normal = \"{\";",
      "    let raw = r#\"}\"#;",
      "}",
    ].join("\n");

    expect(computeRustFoldingRanges(source)).toEqual([{ start: 1, end: 4 }]);
  });
});

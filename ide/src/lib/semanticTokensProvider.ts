import type * as Monaco from "monaco-editor";

export enum SemanticTokenTypes {
  // Built-in semantic token types
  Variable = "variable",
  Function = "function",
  Method = "method",
  Property = "property",
  Class = "class",
  Interface = "interface",
  Enum = "enum",
  EnumMember = "enumMember",
  Type = "type",
  Parameter = "parameter",

  // Custom semantic token types
  Constant = "constant",
  MutableVariable = "mutableVariable",
  CustomType = "customType",
  Struct = "struct",
  Trait = "trait",
  Macro = "macro",
  Lifetime = "lifetime",
}

export enum SemanticTokenModifiers {
  Declaration = "declaration",
  Definition = "definition",
  Readonly = "readonly",
  Static = "static",
  Deprecated = "deprecated",
  Abstract = "abstract",
  Async = "async",
  Modification = "modification",
  Documentation = "documentation",
  DefaultLibrary = "defaultLibrary",
}

export interface SemanticTokenLegend {
  tokenTypes: string[];
  tokenModifiers: string[];
}

export class RustSemanticTokensProvider
  implements Monaco.languages.DocumentSemanticTokensProvider
{
  private readonly legend: Monaco.languages.SemanticTokensLegend;

  constructor() {
    this.legend = {
      tokenTypes: [
        SemanticTokenTypes.Variable,
        SemanticTokenTypes.Function,
        SemanticTokenTypes.Method,
        SemanticTokenTypes.Property,
        SemanticTokenTypes.Class,
        SemanticTokenTypes.Interface,
        SemanticTokenTypes.Enum,
        SemanticTokenTypes.EnumMember,
        SemanticTokenTypes.Type,
        SemanticTokenTypes.Parameter,
        SemanticTokenTypes.Constant,
        SemanticTokenTypes.MutableVariable,
        SemanticTokenTypes.CustomType,
        SemanticTokenTypes.Struct,
        SemanticTokenTypes.Trait,
        SemanticTokenTypes.Macro,
        SemanticTokenTypes.Lifetime,
      ],
      tokenModifiers: [
        SemanticTokenModifiers.Declaration,
        SemanticTokenModifiers.Definition,
        SemanticTokenModifiers.Readonly,
        SemanticTokenModifiers.Static,
        SemanticTokenModifiers.Deprecated,
        SemanticTokenModifiers.Abstract,
        SemanticTokenModifiers.Async,
        SemanticTokenModifiers.Modification,
        SemanticTokenModifiers.Documentation,
        SemanticTokenModifiers.DefaultLibrary,
      ],
    };
  }

  getLegend(): Monaco.languages.SemanticTokensLegend {
    return this.legend;
  }

  provideDocumentSemanticTokens(
    model: Monaco.editor.ITextModel,
    lastResultId: string | null,
    token: Monaco.CancellationToken,
  ): Monaco.languages.ProviderResult<
    Monaco.languages.SemanticTokens | Monaco.languages.SemanticTokensEdits
  > {
    const content = model.getValue();
    const tokens = this.analyzeRustCode(content);
    return {
      data: new Uint32Array(tokens),
      resultId: lastResultId || undefined,
    };
  }

  provideDocumentSemanticTokensEdits(
    model: Monaco.editor.ITextModel,
    lastResultId: string,
  ):
    | Monaco.languages.SemanticTokensEdits
    | Promise<Monaco.languages.SemanticTokensEdits> {
    // For simplicity, we'll return full tokens instead of incremental edits
    return {
      edits: [],
      resultId: lastResultId,
    };
  }

  releaseDocumentSemanticTokens(resultId: string): void {
    // Clean up resources if needed
  }

  private analyzeRustCode(content: string): number[] {
    const tokens: number[] = [];
    const lines = content.split("\n");

    // Track declared variables, constants, types, etc.
    const declaredConstants = new Set<string>();
    const declaredTypes = new Set<string>();
    const declaredVariables = new Set<string>();
    const declaredStructs = new Set<string>();
    const declaredTraits = new Set<string>();
    const declaredMacros = new Set<string>();

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];

      // Match constants (SHOUTY_CASE)
      const constRegex = /const\s+(\w+)\s*[:=]/g;
      let match;
      while ((match = constRegex.exec(line)) !== null) {
        const constName = match[1];
        if (this.isShoutyCase(constName)) {
          declaredConstants.add(constName);
          const startIndex = match.index;
          const nameIndex = line.indexOf(constName, startIndex);
          if (nameIndex !== -1) {
            tokens.push(
              lineNum, // line number
              nameIndex, // start column
              constName.length, // length
              this.getTokenTypeIndex(SemanticTokenTypes.Constant),
              this.getTokenModifierIndex(SemanticTokenModifiers.Declaration),
            );
          }
        }
      }

      // Match static variables
      const staticRegex = /static\s+(\w+)\s*[:=]/g;
      while ((match = staticRegex.exec(line)) !== null) {
        const varName = match[1];
        declaredVariables.add(varName);
        const startIndex = match.index;
        const nameIndex = line.indexOf(varName, startIndex);
        if (nameIndex !== -1) {
          tokens.push(
            lineNum,
            nameIndex,
            varName.length,
            this.getTokenTypeIndex(SemanticTokenTypes.MutableVariable),
            this.getTokenModifierIndex(SemanticTokenModifiers.Static),
          );
        }
      }

      // Match let bindings (mutable variables)
      const letRegex = /let\s+(mut\s+)?(\w+)\s*[:=]/g;
      while ((match = letRegex.exec(line)) !== null) {
        const isMutable = !!match[1];
        const varName = match[2];
        declaredVariables.add(varName);
        const startIndex = match.index;
        const nameIndex = line.indexOf(varName, startIndex);
        if (nameIndex !== -1) {
          tokens.push(
            lineNum,
            nameIndex,
            varName.length,
            this.getTokenTypeIndex(
              isMutable
                ? SemanticTokenTypes.MutableVariable
                : SemanticTokenTypes.Variable,
            ),
            this.getTokenModifierIndex(SemanticTokenModifiers.Declaration),
          );
        }
      }

      // Match struct definitions
      const structRegex = /(?:pub\s+)?struct\s+(\w+)/g;
      while ((match = structRegex.exec(line)) !== null) {
        const structName = match[1];
        declaredStructs.add(structName);
        declaredTypes.add(structName);
        const startIndex = match.index;
        const nameIndex = line.indexOf(structName, startIndex);
        if (nameIndex !== -1) {
          tokens.push(
            lineNum,
            nameIndex,
            structName.length,
            this.getTokenTypeIndex(SemanticTokenTypes.Struct),
            this.getTokenModifierIndex(SemanticTokenModifiers.Declaration),
          );
        }
      }

      // Match enum definitions
      const enumRegex = /(?:pub\s+)?enum\s+(\w+)/g;
      while ((match = enumRegex.exec(line)) !== null) {
        const enumName = match[1];
        declaredTypes.add(enumName);
        const startIndex = match.index;
        const nameIndex = line.indexOf(enumName, startIndex);
        if (nameIndex !== -1) {
          tokens.push(
            lineNum,
            nameIndex,
            enumName.length,
            this.getTokenTypeIndex(SemanticTokenTypes.Enum),
            this.getTokenModifierIndex(SemanticTokenModifiers.Declaration),
          );
        }
      }

      // Match trait definitions
      const traitRegex = /(?:pub\s+)?trait\s+(\w+)/g;
      while ((match = traitRegex.exec(line)) !== null) {
        const traitName = match[1];
        declaredTraits.add(traitName);
        declaredTypes.add(traitName);
        const startIndex = match.index;
        const nameIndex = line.indexOf(traitName, startIndex);
        if (nameIndex !== -1) {
          tokens.push(
            lineNum,
            nameIndex,
            traitName.length,
            this.getTokenTypeIndex(SemanticTokenTypes.Trait),
            this.getTokenModifierIndex(SemanticTokenModifiers.Declaration),
          );
        }
      }

      // Match type aliases
      const typeAliasRegex = /(?:pub\s+)?type\s+(\w+)\s*=/g;
      while ((match = typeAliasRegex.exec(line)) !== null) {
        const typeName = match[1];
        declaredTypes.add(typeName);
        const startIndex = match.index;
        const nameIndex = line.indexOf(typeName, startIndex);
        if (nameIndex !== -1) {
          tokens.push(
            lineNum,
            nameIndex,
            typeName.length,
            this.getTokenTypeIndex(SemanticTokenTypes.CustomType),
            this.getTokenModifierIndex(SemanticTokenModifiers.Declaration),
          );
        }
      }

      // Match macro definitions
      const macroRegex = /(?:pub\s+)?macro_rules!\s+(\w+)/g;
      while ((match = macroRegex.exec(line)) !== null) {
        const macroName = match[1];
        declaredMacros.add(macroName);
        const startIndex = match.index;
        const nameIndex = line.indexOf(macroName, startIndex);
        if (nameIndex !== -1) {
          tokens.push(
            lineNum,
            nameIndex,
            macroName.length,
            this.getTokenTypeIndex(SemanticTokenTypes.Macro),
            this.getTokenModifierIndex(SemanticTokenModifiers.Declaration),
          );
        }
      }

      // Match function definitions
      const fnRegex = /(?:pub\s+)?(?:async\s+)?(?:extern\s+)?fn\s+(\w+)\s*\(/g;
      while ((match = fnRegex.exec(line)) !== null) {
        const fnName = match[1];
        const startIndex = match.index;
        const nameIndex = line.indexOf(fnName, startIndex);
        if (nameIndex !== -1) {
          tokens.push(
            lineNum,
            nameIndex,
            fnName.length,
            this.getTokenTypeIndex(SemanticTokenTypes.Function),
            this.getTokenModifierIndex(SemanticTokenModifiers.Declaration),
          );
        }
      }

      // Match lifetimes
      const lifetimeRegex = /'(\w+)/g;
      while ((match = lifetimeRegex.exec(line)) !== null) {
        const lifetime = match[1];
        const startIndex = match.index;
        const nameIndex = line.indexOf(lifetime, startIndex);
        if (nameIndex !== -1) {
          tokens.push(
            lineNum,
            nameIndex,
            lifetime.length + 1, // Include the apostrophe
            this.getTokenTypeIndex(SemanticTokenTypes.Lifetime),
            0,
          );
        }
      }

      // Match usage of declared identifiers (not declarations)
      this.findIdentifierUsages(
        line,
        lineNum,
        declaredConstants,
        declaredTypes,
        declaredVariables,
        declaredStructs,
        declaredTraits,
        declaredMacros,
        tokens,
      );
    }

    return tokens;
  }

  private findIdentifierUsages(
    line: string,
    lineNum: number,
    declaredConstants: Set<string>,
    declaredTypes: Set<string>,
    declaredVariables: Set<string>,
    declaredStructs: Set<string>,
    declaredTraits: Set<string>,
    declaredMacros: Set<string>,
    tokens: number[],
  ): void {
    // Simple word boundary regex to find identifiers
    const wordRegex = /\b(\w+)\b/g;
    let match;

    while ((match = wordRegex.exec(line)) !== null) {
      const word = match[1];
      const startIndex = match.index;

      // Skip if this is part of a declaration (we already handled those)
      if (this.isDeclarationContext(line, startIndex)) {
        continue;
      }

      // Check if it's a constant usage
      if (declaredConstants.has(word) && this.isShoutyCase(word)) {
        tokens.push(
          lineNum,
          startIndex,
          word.length,
          this.getTokenTypeIndex(SemanticTokenTypes.Constant),
          0,
        );
      }
      // Check if it's a type usage
      else if (declaredTypes.has(word)) {
        tokens.push(
          lineNum,
          startIndex,
          word.length,
          this.getTokenTypeIndex(SemanticTokenTypes.CustomType),
          0,
        );
      }
      // Check if it's a variable usage
      else if (declaredVariables.has(word)) {
        tokens.push(
          lineNum,
          startIndex,
          word.length,
          this.getTokenTypeIndex(SemanticTokenTypes.Variable),
          0,
        );
      }
      // Check if it's a macro usage (ends with !)
      else if (
        declaredMacros.has(word) &&
        line.charAt(startIndex + word.length) === "!"
      ) {
        tokens.push(
          lineNum,
          startIndex,
          word.length + 1, // Include the exclamation mark
          this.getTokenTypeIndex(SemanticTokenTypes.Macro),
          0,
        );
      }
    }
  }

  private isDeclarationContext(line: string, index: number): boolean {
    const before = line.substring(0, index).trim();
    const keywords = [
      "const",
      "let",
      "static",
      "struct",
      "enum",
      "trait",
      "type",
      "fn",
      "macro_rules!",
    ];
    return keywords.some((keyword) => before.endsWith(keyword));
  }

  private isShoutyCase(name: string): boolean {
    return /^[A-Z][A-Z0-9_]*$/.test(name);
  }

  private getTokenTypeIndex(tokenType: string): number {
    return this.legend.tokenTypes.indexOf(tokenType);
  }

  private getTokenModifierIndex(modifier: string): number {
    const index = this.legend.tokenModifiers.indexOf(modifier);
    return index >= 0 ? 1 << index : 0;
  }
}

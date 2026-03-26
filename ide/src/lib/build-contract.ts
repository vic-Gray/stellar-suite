import { FileNode } from "@/lib/sample-contracts";

export interface WorkspaceFile {
  path: string;
  content: string;
  language: string;
}

export interface BuildWorkspacePayload {
  files: WorkspaceFile[];
  network: string;
}

export interface CompileResult {
  success?: boolean;
  output: string;
  contractHash?: string | null;
}

export class CompileRequestError extends Error {
  status: number;
  responseBody: string;

  constructor(message: string, status: number, responseBody: string) {
    super(message);
    this.name = "CompileRequestError";
    this.status = status;
    this.responseBody = responseBody;
  }
}

const DEFAULT_COMPILE_API_URL = "/api/compile";

const flattenFiles = (nodes: FileNode[], parentPath = ""): WorkspaceFile[] =>
  nodes.flatMap((node) => {
    const path = parentPath ? `${parentPath}/${node.name}` : node.name;

    if (node.type === "folder") {
      return flattenFiles(node.children ?? [], path);
    }

    return [
      {
        path,
        content: node.content ?? "",
        language: node.language ?? "text",
      },
    ];
  });

const stringifyOutput = (value: unknown) => {
  if (typeof value === "string") return value;
  if (Array.isArray(value))
    return value.map(stringifyOutput).filter(Boolean).join("\n");
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

export const createBuildWorkspacePayload = (
  files: FileNode[],
  network: string,
): BuildWorkspacePayload => ({
  files: flattenFiles(files),
  network,
});

export async function compileWorkspace(
  payload: BuildWorkspacePayload,
): Promise<CompileResult> {
  const response = await fetch(
    process.env.NEXT_PUBLIC_COMPILE_API_URL || DEFAULT_COMPILE_API_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/plain",
      },
      body: JSON.stringify(payload),
    },
  );

  const responseBody = await response.text();

  if (!response.ok) {
    const message =
      responseBody.trim() ||
      `Compile request failed with status ${response.status}`;

    throw new CompileRequestError(message, response.status, responseBody);
  }

  if (!responseBody.trim()) {
    return { output: "" };
  }

  try {
    const parsed = JSON.parse(responseBody) as
      | {
          output?: unknown;
          logs?: unknown;
          success?: boolean;
          contractHash?: string | null;
        }
      | unknown[];

    if (Array.isArray(parsed)) {
      return {
        output: stringifyOutput(parsed),
      };
    }

    return {
      success: typeof parsed.success === "boolean" ? parsed.success : undefined,
      output: stringifyOutput(parsed.output ?? parsed.logs ?? responseBody),
      contractHash:
        typeof parsed.contractHash === "string" ? parsed.contractHash : null,
    };
  } catch {
    return {
      output: responseBody,
    };
  }
}

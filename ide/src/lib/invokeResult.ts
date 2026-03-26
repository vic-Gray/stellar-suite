import type { NetworkKey } from "@/lib/networkConfig";

export interface InvocationDebugData {
  result: string;
  functionName: string;
  args: string;
  signer: string;
  network: NetworkKey;
  unsignedXdr: string;
  signedXdr: string;
  createdAt: string;
}

const encodeBase64Utf8 = (value: string) => {
  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    const bytes = new TextEncoder().encode(value);
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
    return window.btoa(binary);
  }

  return Buffer.from(value, "utf8").toString("base64");
};

const buildUnsignedEnvelope = (functionName: string, args: string, signer: string, network: NetworkKey) =>
  JSON.stringify({
    type: "soroban.invoke.unsigned",
    functionName,
    args,
    signer,
    network,
  });

const buildSignedEnvelope = (functionName: string, args: string, signer: string, network: NetworkKey, result: string) =>
  JSON.stringify({
    type: "soroban.invoke.signed",
    functionName,
    args,
    signer,
    network,
    result,
  });

export const createInvocationDebugData = ({
  functionName,
  args,
  signer,
  network,
  result,
}: Omit<InvocationDebugData, "unsignedXdr" | "signedXdr" | "createdAt">): InvocationDebugData => ({
  functionName,
  args,
  signer,
  network,
  result,
  unsignedXdr: encodeBase64Utf8(buildUnsignedEnvelope(functionName, args, signer, network)),
  signedXdr: encodeBase64Utf8(buildSignedEnvelope(functionName, args, signer, network, result)),
  createdAt: new Date().toISOString(),
});

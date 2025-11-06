// scripts/lib/params.ts

// Robust parser: prefer env vars; then args after `--`; then best-effort fallback.
function parseTireBatch(): { tireId: string; batchId: string } {
  // 1) ENV first
  const envTire = process.env.TIRE_ID?.trim();
  const envBatch = process.env.BATCH_ID?.trim();
  if (envTire && envBatch) return { tireId: envTire, batchId: envBatch };

  // 2) Args after `--`
  const sep = process.argv.indexOf("--");
  if (sep >= 0 && process.argv.length >= sep + 3) {
    const tireId = process.argv[sep + 1];
    const batchId = process.argv[sep + 2];
    return { tireId, batchId };
  }

  // 3) Best-effort: last two positional tokens that aren't Hardhat internals
  const pos = process.argv.filter(
    (a) =>
      a &&
      !a.startsWith("-") &&
      !a.endsWith("hardhat") &&
      a !== "run" &&
      !a.endsWith(".ts") &&
      !a.endsWith(".js")
  );
  if (pos.length >= 2) {
    return { tireId: pos[pos.length - 2], batchId: pos[pos.length - 1] };
  }

  // 4) Defaults (keeps scripts runnable)
  return { tireId: "TIRE001", batchId: "BATCH-2025-11-05-A" };
}

// New API (preferred)
export function tireBatchFromCLI() {
  return parseTireBatch();
}

// Backward-compat shims (so your existing scripts keep working)
export function tireParam() {
  return parseTireBatch().tireId;
}
export function batchParam() {
  return parseTireBatch().batchId;
}

// Small helper you were using in some scripts to build URIs
export function uri(name: string) {
  return `ipfs://${name}`;
}

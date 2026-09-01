export type DiffType = "added" | "removed" | "unchanged";

export interface DiffLine {
  type: DiffType;
  text: string;
}

export function lineDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const m = oldLines.length;
  const n = newLines.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0),
  );

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (oldLines[i] === newLines[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const diff: DiffLine[] = [];
  let i = 0;
  let j = 0;

  while (i < m && j < n) {
    if (oldLines[i] === newLines[j]) {
      diff.push({ type: "unchanged", text: oldLines[i] });
      i += 1;
      j += 1;
      continue;
    }

    if (dp[i + 1][j] >= dp[i][j + 1]) {
      diff.push({ type: "removed", text: oldLines[i] });
      i += 1;
    } else {
      diff.push({ type: "added", text: newLines[j] });
      j += 1;
    }
  }

  while (i < m) {
    diff.push({ type: "removed", text: oldLines[i] });
    i += 1;
  }

  while (j < n) {
    diff.push({ type: "added", text: newLines[j] });
    j += 1;
  }

  return diff;
}

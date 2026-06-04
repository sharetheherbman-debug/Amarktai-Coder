// Compute a simple unified-diff-like text for display purposes.
// This is not a strict unified diff; it's a line-by-line side comparison
// good enough to render in the diff viewer.

export function lineDiff(before: string, after: string): string {
  const a = (before || '').split(/\r?\n/);
  const b = (after || '').split(/\r?\n/);
  const out: string[] = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    const la = a[i];
    const lb = b[i];
    if (la === lb) {
      if (la !== undefined) out.push('  ' + la);
    } else {
      if (la !== undefined) out.push('- ' + la);
      if (lb !== undefined) out.push('+ ' + lb);
    }
  }
  return out.join('\n');
}

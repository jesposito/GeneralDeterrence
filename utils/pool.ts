// In-place array compaction for the game loop's entity/particle pools. Keeps elements where
// `keep` returns true, preserving order, WITHOUT allocating a new array — avoids the per-frame GC
// churn of `ref.current = ref.current.filter(...)`. `keep` runs exactly once per element in order
// (same contract as Array.filter), so predicates with side effects behave identically. Mutates arr.
export function retainInPlace<T>(arr: T[], keep: (x: T) => boolean): void {
  let w = 0;
  for (let r = 0; r < arr.length; r++) {
    const x = arr[r];
    if (keep(x)) {
      if (w !== r) arr[w] = x;
      w++;
    }
  }
  arr.length = w;
}

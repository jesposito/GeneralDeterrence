/**
 * Merge Utilities
 *
 * Functions for merging lists and objects while preserving order
 * and handling deduplication.
 *
 * @module self-learning/lib/merge
 */

// =============================================================================
// List Operations
// =============================================================================

/**
 * Merge two arrays, preserving order and removing duplicates.
 *
 * Items from the second array are added after the first array's items,
 * but duplicates are skipped.
 *
 * @param a - First array
 * @param b - Second array
 * @returns Merged array with duplicates removed
 *
 * @example
 * ```typescript
 * mergeListPreserve(["a", "b"], ["b", "c"]);
 * // ["a", "b", "c"]
 * ```
 */
export function mergeListPreserve<T>(a: T[], b: T[]): T[] {
  const seen = new Set(a);
  const result = [...a];

  for (const item of b) {
    if (!seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }

  return result;
}

/**
 * Deduplicate an array while preserving order.
 *
 * @param arr - Array to deduplicate
 * @returns Array with duplicates removed
 */
export function dedupePreserveOrder<T>(arr: T[]): T[] {
  const seen = new Set<T>();
  const result: T[] = [];

  for (const item of arr) {
    if (!seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }

  return result;
}

/**
 * Deduplicate an array of objects by a key field.
 *
 * Later items with the same key override earlier ones.
 *
 * @param arr - Array of objects
 * @param keyFn - Function to extract the key from an object
 * @returns Array with duplicates removed (latest wins)
 */
export function dedupeByKey<T>(arr: T[], keyFn: (item: T) => string): T[] {
  const map = new Map<string, T>();

  for (const item of arr) {
    map.set(keyFn(item), item);
  }

  return Array.from(map.values());
}

// =============================================================================
// Object Operations
// =============================================================================

/**
 * Deep merge two objects.
 *
 * - Arrays are replaced, not merged
 * - Nested objects are merged recursively
 * - Source values override target values
 *
 * @param target - Target object
 * @param source - Source object (values override target)
 * @returns Merged object
 *
 * @example
 * ```typescript
 * deepMerge({ a: 1, b: { c: 2 } }, { b: { d: 3 } });
 * // { a: 1, b: { c: 2, d: 3 } }
 * ```
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target };

  for (const key of Object.keys(source) as (keyof T)[]) {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (sourceValue === undefined) {
      continue;
    }

    if (
      typeof sourceValue === "object" &&
      sourceValue !== null &&
      !Array.isArray(sourceValue) &&
      typeof targetValue === "object" &&
      targetValue !== null &&
      !Array.isArray(targetValue)
    ) {
      // Recursively merge objects
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      ) as T[keyof T];
    } else {
      // Replace value
      result[key] = sourceValue as T[keyof T];
    }
  }

  return result;
}

/**
 * Merge Aha Card fields, preserving existing values and merging arrays.
 *
 * Used when reinforcing an existing card with new discovery.
 *
 * @param existing - Existing card data
 * @param update - New card data
 * @returns Merged card data
 */
export function mergeAhaCard<
  T extends {
    solution_steps?: string[];
    evidence?: string[];
    tags?: string[];
    gotchas?: string[];
    links?: string[];
  }
>(existing: T, update: Partial<T>): T {
  const result = { ...existing };

  // Merge array fields
  const arrayFields = [
    "solution_steps",
    "evidence",
    "tags",
    "gotchas",
    "links",
  ] as const;

  for (const field of arrayFields) {
    const existingArr = existing[field] as string[] | undefined;
    const updateArr = update[field] as string[] | undefined;

    if (updateArr && updateArr.length > 0) {
      result[field] = mergeListPreserve(
        existingArr ?? [],
        updateArr
      ) as T[typeof field];
    }
  }

  // Preserve non-null string fields from existing
  const stringFields = ["when_to_use", "problem"] as const;

  for (const field of stringFields) {
    if (
      (existing[field as keyof T] as string | undefined) &&
      !(update[field as keyof T] as string | undefined)
    ) {
      // Keep existing value
    } else if (update[field as keyof T] !== undefined) {
      result[field as keyof T] = update[field as keyof T] as T[keyof T];
    }
  }

  return result;
}

// =============================================================================
// Comparison
// =============================================================================

/**
 * Check if two objects are equal (shallow comparison).
 *
 * @param a - First object
 * @param b - Second object
 * @param excludeKeys - Keys to exclude from comparison
 * @returns true if objects are equal
 */
export function shallowEqual(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  excludeKeys: string[] = []
): boolean {
  const keysA = Object.keys(a).filter((k) => !excludeKeys.includes(k));
  const keysB = Object.keys(b).filter((k) => !excludeKeys.includes(k));

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (const key of keysA) {
    if (!keysB.includes(key)) {
      return false;
    }

    const valA = a[key];
    const valB = b[key];

    if (Array.isArray(valA) && Array.isArray(valB)) {
      if (
        valA.length !== valB.length ||
        !valA.every((v, i) => v === valB[i])
      ) {
        return false;
      }
    } else if (valA !== valB) {
      return false;
    }
  }

  return true;
}

/**
 * Check if content has changed (excluding timestamp fields).
 *
 * @param a - First record
 * @param b - Second record
 * @returns true if content differs
 */
export function contentChanged(
  a: Record<string, unknown>,
  b: Record<string, unknown>
): boolean {
  return !shallowEqual(a, b, ["ts", "last_touched_ts", "id"]);
}

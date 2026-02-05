/**
 * Result Parser Module
 *
 * Parses Claude CLI output into structured evaluation results.
 * Handles malformed output gracefully with fail-open behavior.
 */

import type { EvaluationResult, Verdict, Violation } from "./types";

/**
 * Default pass result - used when parsing fails or evaluator is disabled
 */
export const DEFAULT_PASS_RESULT: EvaluationResult = {
  verdict: "pass",
  violations: [],
  feedback: "",
};

/**
 * Validate that a value is a valid verdict
 */
function isValidVerdict(value: unknown): value is Verdict {
  return value === "pass" || value === "warn" || value === "block";
}

/**
 * Validate that a value is a valid violation
 */
function isValidViolation(value: unknown): value is Violation {
  if (!value || typeof value !== "object") {
    return false;
  }
  const v = value as Record<string, unknown>;
  return (
    typeof v.rule === "string" &&
    typeof v.description === "string" &&
    (v.severity === "error" || v.severity === "warning" || v.severity === "info")
  );
}

/**
 * Attempt to extract JSON from a string that may contain additional text
 *
 * Claude sometimes wraps JSON in markdown code blocks or adds explanation text.
 */
function extractJson(text: string): string | null {
  // First, try to parse the entire text as JSON
  try {
    JSON.parse(text);
    return text;
  } catch {
    // Continue to extraction attempts
  }

  // Try to find JSON in markdown code block
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    try {
      JSON.parse(codeBlockMatch[1].trim());
      return codeBlockMatch[1].trim();
    } catch {
      // Continue
    }
  }

  // Try to find JSON object by finding matching braces
  const firstBrace = text.indexOf("{");
  if (firstBrace === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = firstBrace; i < text.length; i++) {
    const char = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === "\\") {
      escape = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{") {
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0) {
        const jsonStr = text.substring(firstBrace, i + 1);
        try {
          JSON.parse(jsonStr);
          return jsonStr;
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

/**
 * Parse Claude CLI output into an EvaluationResult
 *
 * Expected format:
 * ```json
 * {
 *   "verdict": "pass" | "warn" | "block",
 *   "violations": [
 *     { "rule": "...", "description": "...", "severity": "error" | "warning" | "info" }
 *   ],
 *   "feedback": "Human-readable message"
 * }
 * ```
 *
 * Handles malformed output gracefully - returns pass verdict on any parsing failure.
 */
export function parseResult(rawOutput: string): EvaluationResult {
  if (!rawOutput || !rawOutput.trim()) {
    return { ...DEFAULT_PASS_RESULT, rawResponse: rawOutput };
  }

  // Try to extract JSON from the output
  const jsonStr = extractJson(rawOutput.trim());
  if (!jsonStr) {
    // No JSON found - check if output contains obvious failure indicators
    const lowerOutput = rawOutput.toLowerCase();
    if (
      lowerOutput.includes("block") ||
      lowerOutput.includes("violation") ||
      lowerOutput.includes("fail")
    ) {
      return {
        verdict: "warn",
        violations: [
          {
            rule: "parse-error",
            description: "Could not parse evaluation output but detected possible failure",
            severity: "warning",
          },
        ],
        feedback: rawOutput.substring(0, 500),
        rawResponse: rawOutput,
      };
    }
    return { ...DEFAULT_PASS_RESULT, rawResponse: rawOutput };
  }

  try {
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

    // Validate and extract verdict
    let verdict: Verdict = "pass";
    if (isValidVerdict(parsed.verdict)) {
      verdict = parsed.verdict;
    }

    // Validate and extract violations
    const violations: Violation[] = [];
    if (Array.isArray(parsed.violations)) {
      for (const v of parsed.violations) {
        if (isValidViolation(v)) {
          violations.push(v);
        } else if (v && typeof v === "object") {
          // Try to salvage partial violation data
          const partial = v as Record<string, unknown>;
          violations.push({
            rule: String(partial.rule || "unknown"),
            description: String(partial.description || partial.message || "Unknown violation"),
            severity:
              partial.severity === "error" || partial.severity === "warning"
                ? partial.severity
                : "info",
          });
        }
      }
    }

    // Extract feedback
    let feedback = "";
    if (typeof parsed.feedback === "string") {
      feedback = parsed.feedback;
    } else if (typeof parsed.message === "string") {
      feedback = parsed.message;
    }

    return {
      verdict,
      violations,
      feedback,
      rawResponse: rawOutput,
    };
  } catch {
    // JSON parse failed despite extraction - return pass
    return { ...DEFAULT_PASS_RESULT, rawResponse: rawOutput };
  }
}

/**
 * Format evaluation result for display to user
 */
export function formatResultForDisplay(result: EvaluationResult): string {
  const lines: string[] = [];

  // Verdict icon
  const icon = result.verdict === "pass" ? "✓" : result.verdict === "warn" ? "⚠" : "✗";
  const verdictLabel =
    result.verdict === "pass" ? "PASSED" : result.verdict === "warn" ? "WARNING" : "BLOCKED";

  lines.push(`${icon} Evaluation: ${verdictLabel}`);

  // Feedback
  if (result.feedback) {
    lines.push("");
    lines.push(result.feedback);
  }

  // Violations
  if (result.violations.length > 0) {
    lines.push("");
    lines.push("Violations:");
    for (const v of result.violations) {
      const severityIcon =
        v.severity === "error" ? "✗" : v.severity === "warning" ? "⚠" : "ℹ";
      lines.push(`  ${severityIcon} [${v.rule}] ${v.description}`);
    }
  }

  return lines.join("\n");
}

/**
 * Create a blocking hook output from an evaluation result
 */
export function createBlockingOutput(result: EvaluationResult): {
  hookSpecificOutput: {
    decision: { behavior: "allow" | "block" };
    message: string;
  };
} {
  const shouldBlock = result.verdict === "block";

  return {
    hookSpecificOutput: {
      decision: {
        behavior: shouldBlock ? "block" : "allow",
      },
      message: formatResultForDisplay(result),
    },
  };
}

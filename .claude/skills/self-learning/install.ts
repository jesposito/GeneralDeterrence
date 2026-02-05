#!/usr/bin/env bun

/**
 * Self-Learning Skills Installer
 *
 * Installs the self-learning skills into a target project.
 *
 * Usage:
 *   bun run install.ts [target-dir]
 *
 * If target-dir is not specified, installs to current directory's .claude/skills/
 *
 * @module self-learning/install
 */

import { mkdir, cp, readdir } from "fs/promises";
import { join, dirname } from "path";

const SKILL_NAME = "self-learning";
const VERSION = "1.0.0";

// Files and directories to copy
const COPY_ITEMS = [
  "package.json",
  "tsconfig.json",
  "LICENSE.txt",
  "NOTICE.md",
  "types",
  "lib",
  "commands",
  "scripts",
];

// Files to skip
const SKIP_FILES = ["install.ts"];

async function main() {
  const args = process.argv.slice(2);
  const targetBase = args[0] || process.cwd();
  const targetDir = join(targetBase, ".claude", "skills", SKILL_NAME);
  const sourceDir = dirname(import.meta.path);

  console.log(`Self-Learning Skills Installer v${VERSION}`);
  console.log(`Source: ${sourceDir}`);
  console.log(`Target: ${targetDir}`);
  console.log("");

  // Check if already installed
  const targetPackageJson = join(targetDir, "package.json");
  const targetFile = Bun.file(targetPackageJson);

  if (await targetFile.exists()) {
    const existing = await targetFile.json();
    console.log(`Existing installation found: v${existing.version}`);

    if (existing.version === VERSION) {
      console.log("Already at latest version. Use --force to reinstall.");
      if (!args.includes("--force")) {
        process.exit(0);
      }
      console.log("Force reinstalling...");
    } else {
      console.log(`Upgrading from v${existing.version} to v${VERSION}...`);
    }
    console.log("");
  }

  // Create target directory
  await mkdir(targetDir, { recursive: true });

  // Copy files
  for (const item of COPY_ITEMS) {
    if (SKIP_FILES.includes(item)) continue;

    const sourcePath = join(sourceDir, item);
    const targetPath = join(targetDir, item);

    const sourceFile = Bun.file(sourcePath);
    if (!(await sourceFile.exists())) {
      // Check if it's a directory
      try {
        const entries = await readdir(sourcePath);
        if (entries.length > 0) {
          await cp(sourcePath, targetPath, { recursive: true });
          console.log(`  Copied ${item}/`);
        }
      } catch {
        console.log(`  Skipped ${item} (not found)`);
      }
      continue;
    }

    await cp(sourcePath, targetPath, { recursive: true });
    console.log(`  Copied ${item}`);
  }

  console.log("");
  console.log("Installation complete!");
  console.log("");
  console.log("Next steps:");
  console.log(`  1. cd ${targetBase}`);
  console.log(`  2. bun run .claude/skills/self-learning/scripts/self-learning.ts init`);
  console.log(`  3. Start recording learnings!`);
  console.log("");
  console.log("Commands available:");
  console.log("  init              Initialize store in current repo");
  console.log("  record            Record aha cards and recommendations");
  console.log("  list              List aha cards");
  console.log("  use               Mark items as used");
  console.log("  review            Dashboard view");
  console.log("  promote           Promote to global scope");
  console.log("  export-backport   Backport to skills");
  console.log("  backport-inspect  Inspect existing backports");
}

main().catch((error) => {
  console.error("Installation failed:", error);
  process.exit(1);
});

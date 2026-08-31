#!/usr/bin/env node
/**
 * Metro breaks when `node_modules` is a symlink (package.json path ≠ file-map path).
 * Undo any leftover node_modules → node_modules.nosync layout from earlier startups,
 * and warn if iCloud has evicted deps to dataless stubs.
 */
import { existsSync, lstatSync, readlinkSync, renameSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

if (process.env.VERCEL === "1") {
  process.exit(0);
}

const nm = resolve("node_modules");
const nosync = resolve("node_modules.nosync");

try {
  // Undo symlink layout so Metro can resolve packages.
  if (existsSync(nm) && lstatSync(nm).isSymbolicLink()) {
    const target = readlinkSync(nm);
    if (target === "node_modules.nosync" || target.endsWith("/node_modules.nosync")) {
      rmSync(nm);
      if (existsSync(nosync)) {
        renameSync(nosync, nm);
        console.log("Restored real node_modules (symlink breaks Metro resolution).");
      }
    }
  } else if (!existsSync(nm) && existsSync(nosync)) {
    renameSync(nosync, nm);
    console.log("Restored node_modules from node_modules.nosync.");
  } else if (existsSync(nosync) && existsSync(nm) && !lstatSync(nm).isSymbolicLink()) {
    // Stale leftover after a previous restore
    rmSync(nosync, { recursive: true, force: true });
  }

  if (process.platform === "darwin" && existsSync(nm)) {
    try {
      const sample = execSync(
        'ls -lO node_modules/yaml/package.json node_modules/expo/package.json node_modules/hoist-non-react-statics/dist/hoist-non-react-statics.cjs.js 2>/dev/null || true',
        { encoding: "utf8" },
      );
      if (/\bdataless\b/.test(sample)) {
        console.warn("");
        console.warn(
          "WARNING: Some node_modules files are iCloud dataless stubs (Optimize Mac Storage).",
        );
        console.warn(
          "That makes Metro hang or fail. Fix: run `npm ci`, or move the repo out of ~/Documents.",
        );
        console.warn("");
      }
    } catch {
      // ignore
    }
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`ensure-node-modules-nosync: ${message}`);
}

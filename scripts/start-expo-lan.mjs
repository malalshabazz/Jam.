import { networkInterfaces } from "node:os";
import { spawn, execSync } from "node:child_process";
import { createConnection } from "node:net";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const metroPort = Number(process.env.RCT_METRO_PORT ?? 8081);
const iosBundleUrl =
  `http://127.0.0.1:${metroPort}/index.bundle?platform=ios&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.bytecode=1&transform.routerRoot=app&unstable_transformProfile=hermes-stable`;

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function isPortInUse(port) {
  return new Promise((resolvePromise) => {
    const socket = createConnection({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.end();
      resolvePromise(true);
    });
    socket.once("error", () => resolvePromise(false));
    socket.setTimeout(750, () => {
      socket.destroy();
      resolvePromise(false);
    });
  });
}

function countRunningExpoStarts() {
  try {
    const output = execSync('pgrep -f "expo/bin/cli start" 2>/dev/null || true', {
      encoding: "utf8",
    });
    return output
      .trim()
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean).length;
  } catch {
    return 0;
  }
}

function getLanIp() {
  const interfaces = networkInterfaces();
  const preferredNames = ["en0", "en1"];

  for (const name of preferredNames) {
    const match = interfaces[name]?.find(
      (item) => item.family === "IPv4" && !item.internal,
    );
    if (match?.address) return match.address;
  }

  for (const entries of Object.values(interfaces)) {
    const match = entries?.find(
      (item) => item.family === "IPv4" && !item.internal,
    );
    if (match?.address) return match.address;
  }

  return null;
}

async function waitForMetro(timeoutMs = 1_200_000) {
  const deadline = Date.now() + timeoutMs;
  let polls = 0;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${metroPort}/status`);
      if (response.ok) return true;
    } catch {
      // Metro is still starting.
    }

    polls += 1;
    if (polls % 15 === 0) {
      console.log("Still waiting for Metro to start…");
    }

    await sleep(2000);
  }

  return false;
}

function warnAboutNodeVersion() {
  const major = Number(process.versions.node.split(".")[0]);
  if (major === 20) return;

  console.warn("");
  if (major >= 24) {
    console.warn(
      `Warning: Node ${process.versions.node} is much slower for Metro bundling.`,
    );
    console.warn("This project targets Node 20. Run: nvm use");
  } else {
    console.warn(
      `Warning: Node ${process.versions.node} is not the recommended Node 20 runtime.`,
    );
    console.warn("If bundling is slow or stuck, run: nvm use");
  }
  console.warn("");
}

async function warmIosBundle() {
  console.log(
    "Pre-building the iOS bundle. Do not scan the QR code yet — the first compile can take several minutes.",
  );

  await sleep(3000);

  const startedAt = Date.now();
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 900_000);

    try {
      const response = await fetch(iosBundleUrl, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Bundle request failed with status ${response.status}`);
      }

      await response.arrayBuffer();
      const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
      console.log("");
      console.log(`Bundle ready (${elapsedSeconds}s). Scan the QR code in Expo Go now.`);
      console.log("");
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt < maxAttempts) {
        console.warn(
          `Bundle pre-build attempt ${attempt} failed (${message}). Retrying…`,
        );
        await sleep(4000 * attempt);
      } else {
        throw error;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

async function main() {
  warnAboutNodeVersion();

  const runningExpoStarts = countRunningExpoStarts();
  if (runningExpoStarts > 0) {
    console.error("Another Expo dev server is already starting or running.");
    console.error(
      "Stop it first (Ctrl+C in other terminals), then run npm run dev again.",
    );
    process.exit(1);
  }

  if (await isPortInUse(metroPort)) {
    console.error(`Port ${metroPort} is already in use.`);
    console.error(
      "Stop any other Metro/Expo process, then run npm run dev again.",
    );
    process.exit(1);
  }

  const lanIp = getLanIp();
  if (!lanIp) {
    console.error("Could not find a LAN IP address for Expo.");
    process.exit(1);
  }

  console.log(`Starting Expo with LAN host ${lanIp}`);

  const localExpoBin = resolve("node_modules/expo/bin/cli");
  const expoBin = existsSync(localExpoBin) ? localExpoBin : "expo";

  const child = spawn(
    existsSync(localExpoBin) ? process.execPath : expoBin,
    [...(existsSync(localExpoBin) ? [expoBin] : []), "start", "--host", "lan", ...args],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        EXPO_NO_TELEMETRY: "1",
        EXPO_PACKAGER_HOSTNAME: lanIp,
        REACT_NATIVE_PACKAGER_HOSTNAME: lanIp,
      },
    },
  );

  child.on("error", (error) => {
    console.error(`Failed to start Expo CLI from ${expoBin}:`, error);
    process.exit(1);
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });

  const ready = await waitForMetro();
  if (!ready) {
    console.warn(
      "Metro did not start within 20 minutes. Check the terminal for errors.",
    );
    return;
  }

  try {
    await warmIosBundle();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Could not pre-build the iOS bundle: ${message}`);
    console.warn(
      "Wait until the terminal shows 'iOS Bundled', then scan the QR code or shake your phone and tap Reload.",
    );
  }
}

void main();

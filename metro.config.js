const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

function escapeRegex(value) {
  return String(value).replace(/[\\^$.*+?()[\]{}|]/g, function (ch) {
    return "\\" + ch;
  });
}

// Only block project-root folders. A bare /dist/ pattern also matched
// node_modules package entry files (e.g. hoist-non-react-statics/dist/...).
function projectDirBlock(dirName) {
  const absolute = path.resolve(__dirname, dirName);
  return new RegExp("^" + escapeRegex(absolute) + "([/\\\\]|$)");
}

const blockPatterns = [
  projectDirBlock("app"),
  projectDirBlock(".next"),
  projectDirBlock("dist"),
  projectDirBlock("supabase"),
  projectDirBlock(".vercel"),
  projectDirBlock(".git"),
  projectDirBlock("android"),
  projectDirBlock("ios"),
  /[/\\]node_modules[/\\]next[/\\]/,
  /[/\\]node_modules[/\\]eas-cli[/\\]/,
  /[/\\]node_modules[/\\]\.cache[/\\]/,
];

const existing = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
  ...blockPatterns,
].filter(Boolean);

module.exports = config;

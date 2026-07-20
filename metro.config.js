const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// The Vercel upload API is not part of the native bundle.
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : [config.resolver.blockList].filter(Boolean)),
  /[/\\]app[/\\]/,
  /[/\\]\.next[/\\]/,
];

module.exports = config;

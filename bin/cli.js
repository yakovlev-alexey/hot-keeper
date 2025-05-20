#!/usr/bin/env node

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import fs from "fs";
import { Command } from "commander";
import { startHotKeeper } from "../lib/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Default configuration
const defaultConfig = {
  secure: false,
  port: 3000,
  watch: ["./"],
  excludeWatch: ["node_modules", ".git"],
};

const program = new Command();

// Setup CLI options
program
  .name("hot-keeper")
  .description("Hot reload your CommonJS application with variable persistence")
  .version("1.0.0")
  .argument("<entry-file>", "Entry point file for your application")
  .option("-c, --config <path>", "Path to configuration file")
  .option("-p, --port <number>", "Port to run server on")
  .option("-s, --secure", "Use HTTPS instead of HTTP")
  .option("-w, --watch <paths...>", "Directories to watch for changes")
  .option("-e, --exclude <paths...>", "Directories to exclude from watching")
  .option("--cert <path>", "Path to SSL certificate file")
  .option("--key <path>", "Path to SSL key file");

program.parse();

const options = program.opts();
const args = program.args;

if (args.length < 1) {
  console.error("Error: Entry file is required");
  program.help();
}

const entryFile = resolve(process.cwd(), args[0]);

// Check if entry file exists
if (!fs.existsSync(entryFile)) {
  console.error(`Entry file not found: ${entryFile}`);
  process.exit(1);
}

// Load configuration from file if specified
let config = { ...defaultConfig };
if (options.config) {
  const configFile = resolve(process.cwd(), options.config);
  try {
    if (fs.existsSync(configFile)) {
      const configData = fs.readFileSync(configFile, "utf8");
      const fileConfig = JSON.parse(configData);
      config = { ...config, ...fileConfig };
    } else {
      console.warn(
        `Config file not found: ${configFile}, using defaults and CLI options`
      );
    }
  } catch (error) {
    console.error(`Error loading config file: ${error.message}`);
    process.exit(1);
  }
} else {
  // Check if default config file exists
  const defaultConfigFile = resolve(process.cwd(), "hot-keeper.json");
  try {
    if (fs.existsSync(defaultConfigFile)) {
      const configData = fs.readFileSync(defaultConfigFile, "utf8");
      const fileConfig = JSON.parse(configData);
      config = { ...config, ...fileConfig };
    }
  } catch (error) {
    console.warn(
      `Error loading default config file: ${error.message}, using defaults and CLI options`
    );
  }
}

// Override config with command line options
if (options.port) {
  config.port = parseInt(options.port, 10);
}

if (options.secure) {
  config.secure = true;
}

if (options.watch) {
  config.watch = options.watch;
}

if (options.exclude) {
  config.excludeWatch = options.exclude;
}

// Handle SSL certificate options
if (options.cert || options.key) {
  if (!config.certs) {
    config.certs = {};
  }

  if (options.cert) {
    config.certs.cert = options.cert;
  }

  if (options.key) {
    config.certs.key = options.key;
  }
}

// Validate configuration
if (
  config.secure &&
  (!config.certs || !config.certs.cert || !config.certs.key)
) {
  console.error("Error: HTTPS requires both cert and key files");
  process.exit(1);
}

console.log(
  "Starting hot-keeper with configuration:",
  JSON.stringify(config, null, 2)
);

// Start the hot reloader
startHotKeeper(entryFile, config);

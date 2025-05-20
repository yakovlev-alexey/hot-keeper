import fs from "fs";
import http from "http";
import https from "https";
import { createRequire } from "module";
import { resolve, dirname } from "path";
import chokidar from "chokidar";

/**
 * Start the hot reloader
 * @param {string} entryFile - The entry file path
 * @param {Object} config - Configuration object
 * @returns {Promise<void>}
 */
export async function startHotKeeper(entryFile, config) {
  const require = createRequire(import.meta.url);
  let server = null;
  const cwd = process.cwd();

  // Function to clear cache for specified directories
  const clearRequireCache = () => {
    const watchPaths = Array.isArray(config.watch)
      ? config.watch
      : [config.watch];
    const excludePaths = Array.isArray(config.excludeWatch)
      ? config.excludeWatch
      : [];

    Object.keys(require.cache).forEach((key) => {
      const shouldExclude = excludePaths.some((excludePath) =>
        key.includes(resolve(cwd, excludePath))
      );

      if (shouldExclude) {
        return;
      }

      const shouldClear = watchPaths.some((watchPath) =>
        key.includes(resolve(cwd, watchPath))
      );

      if (shouldClear) {
        delete require.cache[key];
      }
    });
  };

  // Function to start the server
  const startServer = async () => {
    try {
      if (server) {
        await new Promise((resolve, reject) => {
          server.close((err) => {
            if (err) {
              reject(err);
            }
            resolve();
          });
        });
        console.log("Server closed");
      }

      clearRequireCache();

      // Require the entry module
      const app = require(entryFile);

      // Extract the server from the module or use it directly if it's a server
      const appServer = app.default || app;

      // Start HTTP or HTTPS server
      if (config.secure) {
        const certPath = resolve(cwd, config.certs?.cert || "./certs/cert.pem");
        const keyPath = resolve(cwd, config.certs?.key || "./certs/key.pem");

        if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
          console.error(
            `SSL certificates not found at ${certPath} or ${keyPath}`
          );
          process.exit(1);
        }

        const key = fs.readFileSync(keyPath, "utf-8");
        const cert = fs.readFileSync(certPath, "utf-8");

        server = https
          .createServer({ key, cert }, appServer)
          .listen(config.port || 443, () => {
            console.log(`HTTPS server started on port ${config.port || 443}`);
          });
      } else {
        if (typeof appServer.listen === "function") {
          // If app has a listen method, use it directly
          server = appServer.listen(config.port || 3000, () => {
            console.log(`HTTP server started on port ${config.port || 3000}`);
          });
        } else {
          // If not, wrap it in http.createServer
          server = http
            .createServer(appServer)
            .listen(config.port || 3000, () => {
              console.log(`HTTP server started on port ${config.port || 3000}`);
            });
        }
      }
    } catch (error) {
      console.error("Error starting server:", error);
    }
  };

  // Start the server initially
  await startServer();

  // Set up file watching
  const watchPaths = Array.isArray(config.watch)
    ? config.watch
    : [config.watch];
  const excludePaths = Array.isArray(config.excludeWatch)
    ? config.excludeWatch
    : [];

  const resolvedWatchPaths = watchPaths.map((path) => resolve(cwd, path));
  const ignorePatterns = excludePaths.map((path) => `**/${path}/**`);

  console.log(`Watching for changes in: ${resolvedWatchPaths.join(", ")}`);
  console.log(`Ignoring: ${ignorePatterns.join(", ")}`);

  const watcher = chokidar.watch(resolvedWatchPaths, {
    ignored: ignorePatterns,
    persistent: true,
  });

  watcher.on("change", async (path) => {
    console.log(`File changed: ${path}`);
    await startServer();
  });

  // Handle process exit
  const cleanup = async () => {
    if (watcher) {
      await watcher.close();
    }

    if (server) {
      await new Promise((resolve) => {
        server.close(() => resolve());
      });
    }

    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

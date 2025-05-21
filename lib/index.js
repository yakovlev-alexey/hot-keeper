import fs from "fs";
import http from "http";
import https from "https";
import { createRequire } from "module";
import { resolve } from "path";
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
  let app = null;
  const cwd = process.cwd();

  // Keep track of all sockets to force close them when needed
  const sockets = new Set();

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

  const closeServer = async () => {
    console.log("Stopping server...");

    if (app && typeof app.emit === "function") {
      app.emit("close");
    }

    // Force close all tracked sockets
    if (sockets.size > 0) {
      console.log(`Forcibly closing ${sockets.size} active connections`);
      for (const socket of sockets) {
        // Set a short timeout to let data be flushed
        socket.setTimeout(100);
        // Destroy the socket forcibly
        socket.destroy();
      }
      sockets.clear();
    }

    // Try to close all connections if supported
    if (typeof server?.closeAllConnections === "function") {
      server.closeAllConnections();
    }

    if (server) {
      await Promise.race([
        new Promise((resolve, reject) => {
          server.close((err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        }),
        new Promise((_, reject) => {
          setTimeout(() => {
            console.error(
              "Server shutdown timed out after 15 seconds, forcing exit to prevent leaks"
            );
            reject(new Error("Server shutdown timeout"));
          }, 15000);
        }),
      ]).catch((err) => {
        console.error(
          "Failed to close server gracefully:",
          err?.message || "Unknown error"
        );
        process.exit(1);
      });
    }

    console.log("Server closed");
  };

  // Function to start the server
  const startServer = async () => {
    try {
      if (server || app) {
        await closeServer();
      }

      clearRequireCache();

      // Require the entry module
      app = require(entryFile);

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

      // Track all sockets to be able to force-close them later
      server.on("connection", (socket) => {
        sockets.add(socket);
        socket.on("close", () => {
          sockets.delete(socket);
        });
      });

      // Also track secure connections
      if (config.secure) {
        server.on("secureConnection", (socket) => {
          sockets.add(socket);
          socket.on("close", () => {
            sockets.delete(socket);
          });
        });
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
      try {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject("Cleanup timed out after 5 seconds, forcing exit");
          }, 5000);
        });

        await Promise.race([closeServer(), timeoutPromise]);
      } catch (error) {
        console.error("Error during cleanup:", error);
        process.exit(1);
      }
    }

    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

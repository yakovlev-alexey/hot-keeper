const express = require("express");
const { keep, kept } = require("../../lib/keeper.cjs");

// Create a counter that persists between reloads
const counter = kept("counter", 0);

// Create an expensive operation that only runs once
const expensiveOperationResult =
  kept("expensiveOperationResult") ??
  (() => {
    console.log("Running expensive operation...");
    // Simulate an expensive operation
    const start = Date.now();
    while (Date.now() - start < 500) {}
    console.log("Expensive operation completed");
    return { timestamp: Date.now() };
  })();

keep("expensiveOperationResult", expensiveOperationResult);

const app = express();

app.get("/", (req, res) => {
  // Increment counter on each request
  keep("counter", counter + 1);

  res.send(`
    <html>
      <head>
        <title>hot-keeper Example</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 30px; }
          .counter { font-size: 24px; font-weight: bold; }
          .timestamp { margin-top: 20px; color: #666; }
          .edit-me { margin-top: 20px; padding: 10px; background-color: #f0f0f0; }
        </style>
      </head>
      <body>
        <h1>hot-keeper Example</h1>
        <p>Request count: <span class="counter">${counter}</span></p>
        <p>Edit the message below in app.js and watch it update without losing the counter!</p>
        <div class="edit-me">
          Edit me in app.js! The time is ${new Date().toLocaleTimeString()}
        </div>
        <p class="timestamp">Expensive operation timestamp: ${new Date(
          expensiveOperationResult.timestamp
        ).toLocaleString()}</p>
      </body>
    </html>
  `);
});

module.exports = app;

# hot-keeper

A hot reloader for CommonJS applications that allows you to keep specified variables between restarts.

## Table of Contents

- [Installation](#installation)
- [Features](#features)
- [How It Works](#how-it-works)
- [Why Only CommonJS?](#why-only-commonjs)
- [Usage](#usage)
  - [Command Line](#command-line)
  - [Command Line Options](#command-line-options)
  - [Configuration File](#configuration-file)
  - [Keeping Variables Between Reloads](#keeping-variables-between-reloads)
- [Configuration Options](#configuration-options)
- [Example](#example)
- [License](#license)

## Installation

```bash
pnpm add hot-keeper
```

Or using npm:

```bash
npm install hot-keeper
```

Or using yarn:

```bash
yarn add hot-keeper
```

## Features

- Hot reloads your CommonJS application when files change
- Preserves specified variables between reloads
- Supports both HTTP and HTTPS servers
- Configurable through JSON config file and/or command line arguments
- Works with Express, Koa, and other Node.js server frameworks

## How It Works

`hot-keeper` is designed to provide hot-reloading for Node.js applications written in CommonJS (CJS), while allowing you to persist certain variables (such as caches, compilers, or other expensive-to-create objects) between restarts. This is especially useful for development servers, build tools, or any scenario where you want to avoid re-initializing heavy resources on every code change.

## Why Only CommonJS?

`hot-keeper` relies on Node's `require.cache` to control which modules are reloaded and which are kept alive between reloads. This is only possible with CommonJS modules, because:

- **CommonJS**: Every `require()` call is cached in `require.cache`, which can be programmatically cleared or preserved for specific modules. This allows us to keep the state of the `keeper.cjs` module while reloading everything else.
- **ES Modules**: Node.js does not expose a module cache for ES Modules, and there is no supported way to clear or preserve module state between reloads. As a result, variable persistence and fine-grained cache control are not possible with ESM.

The only way to leverage this module for variable persistance is to first transpile your ESM server code into CJS using tools like [esbuild](https://esbuild.github.io) or [SWC](https://swc.rs).

## Usage

### Command Line

Basic usage:

```bash
pnpm hot-keeper <entry-file> [options]
```

### Command Line Options

```
Options:
  -c, --config <path>     Path to configuration file
  -p, --port <number>     Port to run server on
  -s, --secure            Use HTTPS instead of HTTP
  -w, --watch <paths...>  Directories to watch for changes
  -e, --exclude <paths...> Directories to exclude from watching
  --cert <path>           Path to SSL certificate file
  --key <path>            Path to SSL key file
  -h, --help              Display help
  -V, --version           Display version
```

Examples:

```bash
# Basic usage with default config file
pnpm hot-keeper app.js

# Specify config file
pnpm hot-keeper app.js -c config.json

# Command line options override config
pnpm hot-keeper app.js -p 8000 -s --watch ./src ./api

# Configure HTTPS
pnpm hot-keeper app.js -s --cert ./certs/cert.pem --key ./certs/key.pem
```

### Configuration File

Create a `hot-keeper.json` file in your project root (or specify a custom path with `-c`):

```json
{
  "secure": false,
  "port": 3000,
  "watch": ["./src", "./lib"],
  "excludeWatch": ["node_modules", ".git"],
  "certs": {
    "key": "./certs/key.pem",
    "cert": "./certs/cert.pem"
  }
}
```

### Keeping Variables Between Reloads

In your application, require the `keep` and `kept` functions:

```js
const { keep, kept } = require("hot-keeper/lib/keeper.cjs");

// After restart, retrieve the variable
const storedCache = kept("myCache", {}); // Second parameter is the default value

// Store a variable that will persist between reloads
keep("myCache", {});
```

## Configuration Options

| Option         | Type          | Default                                                | Description                          |
| -------------- | ------------- | ------------------------------------------------------ | ------------------------------------ |
| `secure`       | boolean       | `false`                                                | Whether to use HTTPS                 |
| `port`         | number        | `3000` (HTTP) or `443` (HTTPS)                         | Port to run server on                |
| `watch`        | array\|string | `['./']`                                               | Directories to watch for changes     |
| `excludeWatch` | array         | `['node_modules', '.git']`                             | Directories to exclude from watching |
| `certs`        | object        | `{ key: './certs/key.pem', cert: './certs/cert.pem' }` | Paths to SSL certificates            |

## Example

### Basic Express Application

```js
const express = require("express");
const { keep, kept } = require("hot-keeper/lib/keeper.cjs");

let webpackCompiler = kept("webpackCompiler", null);

if (!webpackCompiler) {
  webpackCompiler = createWebpackCompiler();
  keep("webpackCompiler", webpackCompiler);
}

const app = express();

app.get("/", (req, res) => {
  res.send("Hello, hot reloading world!");
});

module.exports = app;
```

## License

MIT

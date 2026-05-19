import { defineConfig } from "vite";

export default defineConfig({
  server: { port: 5173, host: true, allowedHosts: true },
  build: { target: "es2020" },
  // Force Vite to pre-bundle @spotify/basic-pitch and its CJS deps (tfjs,
  // protobufjs, long) into ESM so they load in the browser. If we don't, the
  // raw CJS `module.exports = ...` lines crash with "module is not defined".
  optimizeDeps: { include: ["@spotify/basic-pitch", "@tonejs/midi"] },
});

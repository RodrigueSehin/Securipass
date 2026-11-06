import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => ({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    env: loadEnv(mode, process.cwd(), ""),
    include: ["src/**/*.test.ts"],
    testTimeout: 30_000,
    // Les tests d'intégration créent des comptes via le réseau : l'initialisation peut dépasser les 10 s par défaut.
    hookTimeout: 60_000,
  },
}));

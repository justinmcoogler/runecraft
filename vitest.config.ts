import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.ts"],
    // The first test in each world file pays the (memoized) large-world
    // generation cost, which can exceed the 5 s default on a loaded machine.
    testTimeout: 30_000,
  },
});

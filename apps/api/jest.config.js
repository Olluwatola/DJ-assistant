/** @type {import("jest").Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  setupFiles: ["<rootDir>/tests/setup.ts"],
  roots: ["<rootDir>/tests"],
  moduleNameMapper: {
    "^@dj-assistant/types$": "<rootDir>/../../packages/types/src/index.ts",
  },
  testTimeout: 10000,
  clearMocks: true,
};

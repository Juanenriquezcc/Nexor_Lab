import tsJest from "ts-jest";

const tsJestTransformCfg = tsJest.createDefaultPreset().transform;

/** @type {import("jest").Config} **/
export default {
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  transform: {
    ...tsJestTransformCfg,
  },
};

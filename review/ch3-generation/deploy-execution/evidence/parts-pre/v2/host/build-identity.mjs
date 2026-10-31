// Build identity for the v2 host. BUILD_COMMIT is replaced by the
// deterministic artifact builder (tools/build-p8-part1.mjs) with the
// exact source commit. It is never hand-edited to a release commit.
export const BUILD_VERSION = "2.0.0";
export const BUILD_COMMIT = "945875bc26b0e2ca965d5c0f710f11c0164025f8";
export const BUILD_IDENTITY = Object.freeze({ version: BUILD_VERSION, commit: BUILD_COMMIT });

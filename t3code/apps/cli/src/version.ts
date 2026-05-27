/** Read version from package.json at build time. */
export const version: string = JSON.parse(
  require("fs").readFileSync(require.resolve("../../package.json"), "utf8"),
).version;

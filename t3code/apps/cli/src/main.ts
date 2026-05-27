#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { version } from "./version.js";

yargs(hideBin(process.argv))
  .scriptName("t3code")
  .command(
    "version",
    "Print T3 CLI version",
    () => {},
    () => console.log("t3code-cli v" + version),
  )
  .option("version", {
    alias: "V",
    type: "boolean",
    description: "Print T3 CLI version and exit",
  })
  .help()
  .alias("help", "h")
  .parse();

#!/usr/bin/env node
console.error(
  "[paneljs] The CLI now ships in the paneljs package. Use: npx paneljs " +
    process.argv.slice(2).join(" "),
);
process.exitCode = 1;

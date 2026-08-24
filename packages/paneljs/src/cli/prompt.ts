import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import { color } from "./color.js";

export interface SelectItem {
  value: string;
  label: string;
  disabled?: boolean;
  hint?: string;
}

export async function question(label: string): Promise<string> {
  const terminal = createInterface({ input: stdin, output: stdout });
  try {
    return (await terminal.question(label)).trim();
  } finally {
    terminal.close();
  }
}

export async function confirm(
  label: string,
  defaultYes = true,
): Promise<boolean> {
  const suffix = defaultYes ? color.dim(" [Y/n]: ") : color.dim(" [y/N]: ");
  const answer = (
    await question(`${color.question(label)}${suffix}`)
  ).toLowerCase();
  if (!answer) return defaultYes;
  return answer === "y" || answer === "yes";
}

export async function hiddenQuestion(label: string): Promise<string> {
  if (!stdin.isTTY)
    throw new Error(
      "Password input requires a terminal. Pass --password or set EXPRESS_ADMIN_PASSWORD for non-interactive use.",
    );
  stdout.write(label);
  return new Promise((resolveQuestion, rejectQuestion) => {
    let value = "";
    const restore = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off("data", onData);
    };
    const onData = (chunk: Buffer) => {
      for (const character of chunk.toString("utf8")) {
        if (character === "\r" || character === "\n") {
          restore();
          stdout.write("\n");
          resolveQuestion(value);
          return;
        }
        if (character === "\u0003") {
          restore();
          rejectQuestion(new Error("Cancelled."));
          return;
        }
        if (character === "\b" || character === "\u007f") {
          if (value) {
            value = value.slice(0, -1);
            stdout.write("\b \b");
          }
          continue;
        }
        value += character;
        stdout.write("•");
      }
    };
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}

export async function select(
  label: string,
  items: SelectItem[],
): Promise<string> {
  const enabled = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !item.disabled);
  if (enabled.length === 0)
    throw new Error(`No available options for ${label}`);
  if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
    throw new Error(
      `${label} requires a terminal, or pass the matching flag (--framework / --orm).`,
    );
  }

  let current = enabled[0].index;

  const render = (first: boolean) => {
    if (!first) stdout.write(`\x1b[${items.length}A`);
    for (const [index, item] of items.entries()) {
      const selected = index === current;
      const cursor = selected ? color.accent("❯ ") : "  ";
      const name = item.disabled
        ? color.dim(item.label)
        : selected
          ? color.accent(item.label)
          : item.label;
      const hint = item.disabled
        ? color.yellow(" (coming soon)")
        : item.hint
          ? color.dim(` ${item.hint}`)
          : "";
      stdout.write(`\x1b[2K${cursor}${name}${hint}\n`);
    }
  };

  stdout.write(`${color.question(label)}\n`);
  stdout.write("\x1b[?25l");
  render(true);

  return new Promise((resolveSelect, rejectSelect) => {
    const restore = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off("data", onData);
      stdout.write("\x1b[?25h");
    };
    const move = (direction: 1 | -1) => {
      const position = enabled.findIndex(({ index }) => index === current);
      const next =
        enabled[(position + direction + enabled.length) % enabled.length];
      current = next.index;
      render(false);
    };
    const onData = (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      if (text === "\u0003") {
        restore();
        stdout.write("\n");
        rejectSelect(new Error("Cancelled."));
        return;
      }
      if (text === "\r" || text === "\n") {
        restore();
        stdout.write(`\x1b[${items.length}A`);
        for (const [index, item] of items.entries()) {
          const selected = index === current;
          const mark = selected ? color.accent("❯ ") : "  ";
          const name = item.disabled
            ? color.dim(item.label)
            : selected
              ? color.accent(item.label)
              : item.label;
          const hint = item.disabled ? color.yellow(" (coming soon)") : "";
          stdout.write(`\x1b[2K${mark}${name}${hint}\n`);
        }
        resolveSelect(items[current].value);
        return;
      }
      if (text === "\u001b[A" || text === "k") move(-1);
      if (text === "\u001b[B" || text === "j") move(1);
    };
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}

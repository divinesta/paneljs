import { stdout } from "node:process";
import { styleText } from "node:util";

type Style =
  | "bold"
  | "dim"
  | "green"
  | "greenBright"
  | "cyan"
  | "yellow"
  | "red"
  | "underline";

export function paint(style: Style | Style[], text: string): string {
  if (process.env.NO_COLOR) return text;
  try {
    return styleText(style, text, {
      validateStream: true,
      stream: stdout,
    });
  } catch {
    return text;
  }
}

export const color = {
  bold: (text: string) => paint("bold", text),
  dim: (text: string) => paint("dim", text),
  accent: (text: string) => paint("greenBright", text),
  cyan: (text: string) => paint("cyan", text),
  yellow: (text: string) => paint("yellow", text),
  red: (text: string) => paint("red", text),
  link: (text: string) => paint(["cyan", "underline"], text),
  title: (text: string) => paint(["bold", "greenBright"], text),
  question: (text: string) =>
    `${paint(["bold", "greenBright"], "?")} ${paint("bold", text)}`,
};

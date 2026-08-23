export function argument(
  argv: string[],
  name: string,
): string | undefined {
  const equals = argv.find((item) => item.startsWith(`${name}=`));
  if (equals) return equals.slice(name.length + 1) || undefined;
  const index = argv.indexOf(name);
  if (index < 0) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith("-")) return undefined;
  return value;
}

export function hasFlag(argv: string[], name: string): boolean {
  return argv.includes(name);
}

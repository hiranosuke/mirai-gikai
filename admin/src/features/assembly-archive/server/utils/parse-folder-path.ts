export function parseFolderPath(path: string): string[] {
  return path.split("/").filter((segment) => segment.trim().length > 0);
}

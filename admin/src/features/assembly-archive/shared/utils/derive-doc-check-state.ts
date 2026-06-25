export function deriveDocCheckState(
  totalFiles: number,
  selectedCount: number
): boolean | "indeterminate" {
  if (totalFiles === 0 || selectedCount === 0) return false;
  if (selectedCount >= totalFiles) return true;
  return "indeterminate";
}

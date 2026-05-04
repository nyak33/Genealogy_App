export function normalizeName(fullName: string): string {
  return fullName.trim().toLowerCase().replace(/\s+/g, " ");
}

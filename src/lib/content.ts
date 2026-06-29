export function cleanText(value: string): string {
  return value.replace(/\u0000/g, "").replace(/[<>]/g, "").trim();
}

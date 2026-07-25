export function toSassPath(filePath: string): string {
  return filePath.replaceAll('\\', '/')
}

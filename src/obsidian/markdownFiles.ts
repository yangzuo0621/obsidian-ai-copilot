export interface FileWithExtension {
  extension: string;
}

export function hasMarkdownExtension(file: FileWithExtension): boolean {
  return file.extension.toLowerCase() === "md";
}

export function isMarkdownPath(path: string): boolean {
  return path.toLowerCase().endsWith(".md");
}

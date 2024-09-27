#!/usr/bin/env -S deno run --allow-read --allow-write=.
import { parseArgs } from "jsr:@std/cli@1.0.5/parse-args";
import { isAbsolute, join, normalize } from "jsr:@std/path@1.0.6";
import { Buffer } from "node:buffer";

type NestedFileMap = { [key: string]: string | NestedFileMap };

export async function embedFiles(inputPaths: string[], language: string) {
  const fileMap: NestedFileMap = { "/": {} };

  for (const inputPath of inputPaths) {
    if ((await Deno.stat(inputPath)).isDirectory) {
      await processDirectory(inputPath, fileMap);
    } else {
      const content = await Deno.readFile(inputPath)
        .then((bytes) => Buffer.from(bytes).toString("base64"));
      setNestedValue(
        fileMap,
        inputPath,
        content,
      );
    }
  }

  const outputFile = `embedded_files.${language}`;
  let content: string;

  switch (language) {
    case "js":
      content = generateJS(fileMap);
      break;
    case "py":
      console.warn("Python is not tested yet !!!");
      content = generatePython(fileMap);
      break;
    default:
      throw new Error(`Unsupported language: ${language}`);
  }

  await Deno.writeTextFile(outputFile, content);
  console.log(`Embedded data written to ${outputFile}`);
}

async function processDirectory(dirPath: string, fileMap: NestedFileMap) {
  for await (const entry of Deno.readDir(dirPath)) {
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory) {
      await processDirectory(fullPath, fileMap);
    } else {
      const content = await Deno.readFile(fullPath).then((bytes) =>
        Buffer.from(bytes).toString("base64")
      );
      setNestedValue(
        fileMap,
        fullPath,
        content,
      );
    }
  }
}

function setNestedValue(obj: NestedFileMap, path: string, value: string) {
  const normalizedPath = normalizePath(path);
  const parts = normalizedPath.split("/").filter((part) => part !== "");

  // Cast is correct, obj["/"] is NestedFileMap
  let current = isAbsolute(path) ? obj["/"] as NestedFileMap : obj;

  // Iterate through all parts of the path except the last one
  for (let i = 0; i < parts.length - 1; i++) {
    // If the current part doesn't exist in the current object, create it as an empty object
    if (!(parts[i] in current)) {
      current[parts[i]] = {};
    }
    // Move to the next level in the nested structure
    current = current[parts[i]] as NestedFileMap;
  }
  current[parts[parts.length - 1]] = value;
}

function normalizePath(path: string): string {
  const normalized = normalize(path);
  // Remove leading slash if path is absolute, otherwise return as-is
  return isAbsolute(normalized) ? normalized.substring(1) : normalized;
}

function generateJS(fileMap: NestedFileMap): string {
  return `
function Base64ToUint8Array(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

const embed = ${JSON.stringify(fileMap, null, 2)};
const get = (value) => Base64ToUint8Array(value);
const getString = (value) => atob(value);

export default {
  files: embed,
  get,
  getString,
}
`;
}

function generatePython(_fileMap: NestedFileMap): string {
  throw new Error("TODO");
}

if (import.meta.main) {
  const args = parseArgs(Deno.args, {
    string: ["lang"],
    boolean: ["help"],
    alias: { lang: "l", help: "h" },
  });

  if (args.help) {
    console.log(
      "Usage: deno run --allow-read --allow-write embed.ts <input_file_or_directory> --lang <js|ts|py>",
    );
    Deno.exit(0);
  }

  const input = args._;
  const language = args.lang as string;

  if (!input || !language) {
    console.error("Error: Both input and language must be specified.");
    console.log("Use --help for usage information.");
    Deno.exit(1);
  }

  if (!["js", "ts", "py"].includes(language)) {
    console.error(
      "Error: Unsupported language. Supported languages are js, ts, and py.",
    );
    Deno.exit(1);
  }

  embedFiles(input as string[], language).catch(console.error);
}

#!/usr/bin/env -S deno run --allow-read --allow-write=.
import { parseArgs } from "jsr:@std/cli/parse-args";
import { walk } from "jsr:@std/fs/walk";
import { Buffer } from "node:buffer";

type FileMap = { [key: string]: string };

export async function embedFiles(inputPaths: string[], language: string) {
  const fileMap: FileMap = {};

  for (const inputPath of inputPaths) {
    if ((await Deno.stat(inputPath)).isDirectory) {
      for await (const entry of walk(inputPath, { includeDirs: false })) {
        const content = await Deno.readFile(entry.path);
        fileMap[inputPath] = Buffer.from(content).toString("base64");
      }
    } else {
      const content = await Deno.readFile(inputPath);
      fileMap[inputPath] = Buffer.from(content).toString("base64");
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

function generateJS(fileMap: FileMap): string {
  return `
import { Buffer } from "node:buffer";
function BufferFromBase64(b64) {
  return Buffer.from(b64, "base64")
}

const encodedFiles = ${JSON.stringify(fileMap, null, 2)};

export const files = {
  get:(name) => new Uint8Array(BufferFromBase64(encodedFiles[name])),
  getString:(name) => BufferFromBase64(encodedFiles[name]).toString(),
}

export function listFiles() {
  return Object.keys(encodedFiles);
}
`;
}

function generatePython(_fileMap: FileMap): string {
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

#!/usr/bin/env -S deno run --allow-read --allow-write=.
/**
# File Embedder

This tool allows you to embed files and directories into scripting languages like JavaScript and Python.

# How it works

The File Embedder works by:

1. Reading input files or directories
2. Converting file contents to base64
3. Generating a nested object structure
4. Creating utility functions for easy access
5. Outputting the result in the chosen language

This approach allows efficient embedding and retrieval
of file contents within scripts.

## Features

- Embed single files or entire directories
- Supports JavaScript and Python output (Python support is experimental)
- The embedded files are fully typed in typescript
- Preserves directory structure in the embedded output
- Provides utility functions to easily access embedded files

## Usage

```bash
deno run --allow-read --allow-writes jsr:@sigma/embed <input_file_or_directory> <input_file2> [...] --lang <js|py>
```

### Options

- `<input_file_or_directory>`: Path to the file or directory you want to embed
- `--lang` or `-l`: Output language (js or py)
- `--help` or `-h`: Show help information

## Output

The tool generates a file named `embedded_files.<lang>` in the current directory. This file contains:

- A nested object structure representing the embedded files and directories
- Utility functions to access the embedded data

### JavaScript Output

For JavaScript, the output file exports an object with:

- `files`: The nested object structure of embedded files
- `get(value)`: A function to get the file content as a Uint8Array
- `getString(value)`: A function to get the file content as a string

## Example

```bash
deno run --allow-read --allow-write jsr:@sigma/embed ./assets --lang js
```

This command will embed all files in the `./assets` directory into a file named `embedded_files.js`.

You can now use it like this:

@example
```js
import $ from "./embedded_files.js";

console.log($.get($.files.assets.file1));
```

# Library

This tool can also be used as a library.

```ts
import { embedFiles } from "jsr:@sigma/embed";

await embedFiles(["./assets"], "js");
```

## License

[MIT License](LICENSE)
@module
*/
import { parseArgs } from "jsr:@std/cli@1.0.5/parse-args";
import { isAbsolute, join, normalize } from "jsr:@std/path@1.0.6";
import { Buffer } from "node:buffer";

type NestedFileMap = { [key: string]: string | NestedFileMap };

/**
 * Embeds files and directories into a single output file.
 * @param {string[]} inputPaths - An array of file or directory paths to embed.
 * @param {string} language - The output language ('js' or 'py').
 * @returns {Promise<void>}
 * @throws {Error} If an unsupported language is specified.
 */
export async function embedFiles(
  inputPaths: string[],
  language: string,
): Promise<void> {
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

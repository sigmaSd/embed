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
deno run --allow-read --allow-write embed.ts <input_file_or_directory> <input_file2> [...] --lang <js|py>
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
deno run --allow-read --allow-write embed.ts ./assets --lang js
```

This command will embed all files in the `./assets` directory into a file named `embedded_files.js`.

You can now use it like this:

```js
import $ from "./embedded_files.js";

console.log($.get($.files.assets.file1));
```

## License

[MIT License](LICENSE)

import { embedFiles } from "./embed.ts";

Deno.test("it works", async () => {
  using tempDir = (() => {
    const path = Deno.makeTempDirSync();
    console.log("tempDir", path);
    return {
      path,
      [Symbol.dispose]() {
        Deno.removeSync(path, { recursive: true });
      },
    };
  })();
  Deno.chdir(tempDir.path);

  const testFilePath1 = "test_file.txt";
  const testContent1 = "Hello, world!";
  const testFilePath2 = Deno.execPath();
  await Deno.writeTextFile(testFilePath1, testContent1);

  await embedFiles([testFilePath1, testFilePath2], "js");

  // spawn a new deno instance that imports the embedded file
  Deno.writeTextFileSync(
    "user_code.js",
    `\
  import $ from "./embedded_files.js";

  function assertArraysEqual(arr1, arr2) {
      if (arr1.length !== arr2.length) {
          throw new Error(\`Arrays have different lengths: \${arr1.length} vs \${arr2.length}\`);
      }

      for (let i = 0; i < arr1.length; i++) {
          if (arr1[i] !== arr2[i]) {
              throw new Error(\`Arrays differ at index \${i}: \${arr1[i]} vs \${arr2[i]}\`);
          }
      }
  }

  assertArraysEqual($.get($.files["${testFilePath1}"]), new TextEncoder().encode("${testContent1}"));
  assertArraysEqual($.get($.files${
      '["/"]' + testFilePath2
        .split("/")
        .map((part) => `["${part}"]`).slice(1).join("")
    }), Deno.readFileSync(Deno.execPath()));`,
  );

  const process = new Deno.Command(Deno.execPath(), {
    args: ["run", "--allow-read", "user_code.js"],
  }).spawn();
  if (!(await process.status).success) {
    throw new Error(
      "test failed, generated file is different then the original",
    );
  }
});

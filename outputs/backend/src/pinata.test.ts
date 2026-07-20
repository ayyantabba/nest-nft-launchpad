import assert from "node:assert/strict";
import test from "node:test";
import { createJsonDirectoryForm, METADATA_DIRECTORY } from "./pinata.js";

test("metadata files share one Pinata directory root", () => {
  const form = createJsonDirectoryForm([
    { filename: "1.json", content: { name: "One" } },
    { filename: "2.json", content: { name: "Two" } },
    { filename: "3.json", content: { name: "Three" } }
  ], "nest-regression-test");

  const files = form.getAll("file") as File[];
  assert.deepEqual(files.map((file) => file.name), [
    `${METADATA_DIRECTORY}/1.json`,
    `${METADATA_DIRECTORY}/2.json`,
    `${METADATA_DIRECTORY}/3.json`
  ]);
  assert.equal(form.getAll("file").length, 3);
  assert.equal(form.get("pinataOptions"), JSON.stringify({ cidVersion: 1 }));
});

test("metadata directory rejects unsafe filenames", () => {
  assert.throws(
    () => createJsonDirectoryForm([{ filename: "../1.json", content: {} }], "unsafe"),
    /INVALID_METADATA_FILENAME/
  );
});

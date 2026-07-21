export const METADATA_DIRECTORY = "metadata";

export type JsonDirectoryItem = {
  filename: string;
  content: unknown;
};

export function createJsonDirectoryForm(items: JsonDirectoryItem[], name: string) {
  const form = new FormData();

  for (const item of items) {
    if (!/^\d+\.json$/.test(item.filename)) throw new Error("INVALID_METADATA_FILENAME");
    const file = new Blob([JSON.stringify(item.content)], { type: "application/json" });
    form.append("file", file, `${METADATA_DIRECTORY}/${item.filename}`);
  }

  form.append("pinataMetadata", JSON.stringify({ name }));
  form.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));
  return form;
}

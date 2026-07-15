const fs = require("node:fs");
const path = require("node:path");
const solc = require("solc");

const root = __dirname;
const sourceDir = path.join(root, "src");
const artifactDir = path.join(root, "artifacts");
const webArtifactDir = path.join(root, "..", "assets", "contracts");

const sources = Object.fromEntries(
  fs.readdirSync(sourceDir)
    .filter((name) => name.endsWith(".sol"))
    .map((name) => [`src/${name}`, { content: fs.readFileSync(path.join(sourceDir, name), "utf8") }])
);

function resolveImport(importPath) {
  const candidates = [
    path.join(root, importPath),
    path.join(root, "node_modules", importPath),
    path.join(sourceDir, importPath)
  ];
  const match = candidates.find((candidate) => fs.existsSync(candidate));
  return match
    ? { contents: fs.readFileSync(match, "utf8") }
    : { error: `Import not found: ${importPath}` };
}

const input = {
  language: "Solidity",
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: "paris",
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object", "metadata"] } }
  }
};

const output = JSON.parse(solc.compile(JSON.stringify(input), { import: resolveImport }));
const errors = (output.errors || []).filter((item) => item.severity === "error");
if (errors.length) {
  console.error(errors.map((item) => item.formattedMessage).join("\n"));
  process.exit(1);
}

fs.mkdirSync(artifactDir, { recursive: true });
fs.mkdirSync(webArtifactDir, { recursive: true });
for (const [sourceName, contracts] of Object.entries(output.contracts || {})) {
  if (!sourceName.startsWith("src/")) continue;
  for (const [contractName, contract] of Object.entries(contracts)) {
    const artifact = {
      contractName,
      sourceName,
      compiler: solc.version(),
      abi: contract.abi,
      bytecode: `0x${contract.evm.bytecode.object}`,
      deployedBytecode: `0x${contract.evm.deployedBytecode.object}`,
      metadata: JSON.parse(contract.metadata)
    };
    fs.writeFileSync(path.join(artifactDir, `${contractName}.json`), `${JSON.stringify(artifact, null, 2)}\n`);
    if (contractName === "RobinhoodNFTFactory") {
      fs.writeFileSync(
        path.join(webArtifactDir, `${contractName}.json`),
        `${JSON.stringify({ contractName, compiler: artifact.compiler, abi: artifact.abi, bytecode: artifact.bytecode }, null, 2)}\n`
      );
    }
  }
}

console.log(`Compiled ${Object.keys(sources).length} Nest contracts with ${solc.version()}.`);

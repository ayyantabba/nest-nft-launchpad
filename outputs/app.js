const NETWORKS = {
  testnet: {
    key: "robinhood-testnet",
    name: "Robinhood Chain Testnet",
    chainId: 46630,
    currency: "ETH",
    rpcUrl: "https://rpc.testnet.chain.robinhood.com",
    explorer: "https://explorer.testnet.chain.robinhood.com",
    faucet: "Configure testnet faucet URL in config/environment.ts",
    openseaState: "OpenSea indexing pending"
  },
  mainnet: {
    key: "robinhood-mainnet",
    name: "Robinhood Chain",
    chainId: 4663,
    currency: "ETH",
    rpcUrl: "https://rpc.mainnet.chain.robinhood.com",
    explorer: "https://robinhoodchain.blockscout.com",
    faucet: "",
    openseaState: "Marketplace availability depends on OpenSea support"
  }
};

const ACTIVE_NETWORK = NETWORKS.testnet;
const WALLETCONNECT_PROJECT_ID = window.NEST_WALLETCONNECT_PROJECT_ID || "63564cf2fc58ce8b1059edd34ac041e0";
const WALLETCONNECT_PROVIDER_URL = "https://esm.sh/@walletconnect/ethereum-provider@2.23.10?bundle";
const VIEM_PROVIDER_URL = "https://esm.sh/viem@2.31.7?bundle";
const PLATFORM_TREASURY = "0xaB81d488395EdebC6632c7546d223439bD8FBdD1";
const FACTORY_ARTIFACT_URL = "./assets/contracts/RobinhoodNFTFactory.json";
const DEFAULT_API_BASE = "https://nest-nft-launchpad-production.up.railway.app/v1";
const API_BASE = window.NEST_API_URL || localStorage.getItem("nestApiUrl") || DEFAULT_API_BASE;
const API_ORIGIN = API_BASE.replace(/\/v1\/?$/, "");
let activeWalletProvider = null;
let walletConnectProvider = null;
const observedWalletProviders = new WeakSet();

async function apiRequest(path, options = {}) {
  const token = state?.authToken || localStorage.getItem("nestAuthToken");
  const headers = { ...(options.body instanceof FormData ? {} : { "content-type": "application/json" }), ...(options.headers || {}) };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `API request failed (${response.status})`);
  return body;
}

const ARTWORK = [
  "linear-gradient(135deg, #f3f5ef 0%, #dbe4cf 36%, #101311 100%)",
  "radial-gradient(circle at 28% 22%, rgba(199,240,0,.5), transparent 18%), linear-gradient(145deg, #ffffff, #d9ddcf 46%, #171b18)",
  "linear-gradient(120deg, #ffffff 0 22%, #c7f000 22% 29%, #101311 29% 30%, #eef3e8 30% 100%)",
  "conic-gradient(from 180deg, #fff, #eaf7b5, #c7f000, #171b18, #fff)",
  "linear-gradient(155deg, #f3f5ef, #eaf7b5 38%, #fff 39%, #101311 100%)",
  "radial-gradient(circle at 64% 38%, #c7f000, transparent 22%), linear-gradient(135deg, #fff, #eef2e8 52%, #171b18)"
];

const openseaCollections = [
  {
    id: "depresso-catz",
    name: "Depresso Catz",
    creator: "OpenSea marketplace",
    description: "Robinhood Chain NFT collection shown in OpenSea collection rankings.",
    floor: "< 0.01 ETH",
    change: "0%",
    changeType: "flat",
    status: "Listed on OpenSea",
    openseaUrl: openseaSearchUrl("Depresso Catz"),
    image: "./assets/opensea/depresso-catz.png",
    art: 1
  },
  {
    id: "worm",
    name: "worm",
    creator: "OpenSea marketplace",
    description: "Robinhood Chain NFT collection shown in OpenSea collection rankings.",
    floor: "< 0.01 ETH",
    change: "0%",
    changeType: "flat",
    status: "Listed on OpenSea",
    openseaUrl: openseaSearchUrl("worm"),
    image: "./assets/opensea/worm.png",
    art: 2
  },
  {
    id: "rh-ape-cartel",
    name: "RH Ape Cartel",
    creator: "OpenSea marketplace",
    description: "Robinhood Chain NFT collection shown in OpenSea collection rankings.",
    floor: "0.03 ETH",
    change: "+17.4%",
    changeType: "up",
    status: "Listed on OpenSea",
    openseaUrl: openseaSearchUrl("RH Ape Cartel"),
    image: "./assets/opensea/rh-ape-cartel.png",
    art: 3
  },
  {
    id: "miniz-frogs-on-robinhood",
    name: "miniz frogs on robinhood",
    creator: "OpenSea marketplace",
    description: "Robinhood Chain NFT collection shown in OpenSea collection rankings.",
    floor: "< 0.01 ETH",
    change: "+171.4%",
    changeType: "up",
    status: "Listed on OpenSea",
    openseaUrl: openseaSearchUrl("miniz frogs on robinhood"),
    image: "./assets/opensea/miniz-frogs-on-robinhood.png",
    art: 4
  },
  {
    id: "nodez-hood",
    name: "NODEZ_Hood",
    creator: "OpenSea marketplace",
    description: "Robinhood Chain NFT collection shown in OpenSea collection rankings.",
    floor: "< 0.01 ETH",
    change: "0%",
    changeType: "flat",
    status: "Listed on OpenSea",
    openseaUrl: openseaSearchUrl("NODEZ_Hood"),
    image: "./assets/opensea/nodez-hood.png",
    art: 5
  },
  {
    id: "robinhood-punks",
    name: "Robinhood Punks",
    creator: "OpenSea marketplace",
    description: "Verified Robinhood Chain NFT collection shown in OpenSea collection rankings.",
    floor: "< 0.01 ETH",
    change: "-11.3%",
    changeType: "down",
    status: "OpenSea verified",
    verified: true,
    openseaUrl: openseaSearchUrl("Robinhood Punks"),
    image: "./assets/opensea/robinhood-punks.png",
    art: 0
  },
  {
    id: "stupid-elves",
    name: "STUPID ELVES",
    creator: "OpenSea marketplace",
    description: "Robinhood Chain NFT collection shown in OpenSea collection rankings.",
    floor: "< 0.01 ETH",
    change: "+135%",
    changeType: "up",
    status: "Listed on OpenSea",
    openseaUrl: openseaSearchUrl("STUPID ELVES"),
    image: "./assets/opensea/stupid-elves.png",
    art: 1
  },
  {
    id: "gremlin-cartel",
    name: "Gremlin Cartel",
    creator: "OpenSea marketplace",
    description: "Verified Robinhood Chain NFT collection shown in OpenSea collection rankings.",
    floor: "0.05 ETH",
    change: "-17.2%",
    changeType: "down",
    status: "OpenSea verified",
    verified: true,
    openseaUrl: openseaSearchUrl("Gremlin Cartel"),
    image: "./assets/opensea/gremlin-cartel.png",
    art: 2
  },
  {
    id: "roodo",
    name: "ROODO",
    creator: "OpenSea marketplace",
    description: "Robinhood Chain NFT collection shown in OpenSea collection rankings.",
    floor: "< 0.01 ETH",
    change: "0%",
    changeType: "flat",
    status: "Listed on OpenSea",
    openseaUrl: openseaSearchUrl("ROODO"),
    image: "./assets/opensea/roodo.png",
    art: 3
  },
  {
    id: "hoodcup",
    name: "HoodCup",
    creator: "OpenSea marketplace",
    description: "Robinhood Chain NFT collection shown in OpenSea collection rankings.",
    floor: "< 0.01 ETH",
    change: "0%",
    changeType: "flat",
    status: "Listed on OpenSea",
    openseaUrl: openseaSearchUrl("HoodCup"),
    image: "./assets/opensea/hoodcup.png",
    art: 4
  },
  {
    id: "de4-creo",
    name: "DE4 Creo",
    creator: "OpenSea marketplace",
    description: "Robinhood Chain NFT collection shown in OpenSea collection rankings.",
    floor: "< 0.01 ETH",
    change: "0%",
    changeType: "flat",
    status: "Listed on OpenSea",
    openseaUrl: openseaSearchUrl("DE4 Creo"),
    image: "./assets/opensea/de4-creo.png",
    art: 5
  }
];

const OPENSEA_SOURCE = {
  source: "OpenSea marketplace",
  chain: "Robinhood Chain",
  status: "Seeded from OpenSea collection ranking screenshot",
  checkedAt: "2026-07-11",
  docsUrl: "https://docs.opensea.io/reference/api-overview",
  chainEndpoint: "https://docs.opensea.io/reference/get_chains.md",
  note: "OpenSea data requires an API key and a supported-chain slug before collection, listing, floor, and activity data can be shown."
};

let platformCollections = [];

const integrationActivity = [
  ["Indexer", "CollectionCreated event queued", "Waiting for real RPC polling"],
  ["Storage", "Metadata manifest schema ready", "IPFS provider required"],
  ["Marketplace", "OpenSea API adapter configured", "API key and chain slug required"],
  ["Security", "Mainnet deployment guard required", "Production flag only"]
];

let state = {
  route: location.hash.replace("#", "") || "/",
  wallet: "disconnected",
  walletPickerOpen: false,
  walletProviderName: "",
  readiness: "Not checked",
  deploymentState: "Awaiting wallet confirmation",
  mintState: "Connect wallet and read chain state before minting",
  launchStep: 1,
  backend: "checking",
  backendMessage: "Connecting to Nest API",
  factoryDeployment: {
    status: "Not deployed",
    txHash: "",
    contractAddress: localStorage.getItem("nestFactoryTestnetAddress") || ""
  },
  authToken: localStorage.getItem("nestAuthToken") || "",
  walletAddress: localStorage.getItem("nestWalletAddress") || "",
  collectionId: localStorage.getItem("nestDraftCollectionId") || "",
  notice: "",
  launch: {
    name: "Market Hours",
    symbol: "MRKT",
    description: "A Robinhood Chain NFT collection for onchain art collectors.",
    creatorName: "Haven Studio",
    creatorWallet: "0xA19f23db9042c36Bf8e2E9353b90a1Ce82D2B8E2",
    website: "https://example.com",
    x: "https://x.com/example",
    social: "https://discord.gg/example",
    supply: 250,
    price: "0.018",
    maxWallet: 3,
    maxTx: 2,
    royaltyBps: 500,
    payout: "0xA19f23db9042c36Bf8e2E9353b90a1Ce82D2B8E2",
    owner: "0xA19f23db9042c36Bf8e2E9353b90a1Ce82D2B8E2"
  }
};

window.addEventListener("hashchange", () => {
  state.route = location.hash.replace("#", "") || "/";
  render();
});

function artStyle(index, prop = "--art") {
  return `${prop}: ${ARTWORK[index % ARTWORK.length]}`;
}

function collectionArtStyle(collection, prop = "--art") {
  if (collection.image) return `${prop}: url('${collection.image}')`;
  return artStyle(collection.art || 0, prop);
}

function ipfsUrl(uri) {
  if (!uri) return "";
  return uri.startsWith("ipfs://") ? `https://ipfs.io/ipfs/${uri.slice(7)}` : uri;
}

function platformArtStyle(collection, prop = "--art") {
  if (collection.image) return `${prop}: url('${collection.image}')`;
  return artStyle(collection.art || 0, prop);
}

function openseaSearchUrl(query) {
  return `https://opensea.io/search?query=${encodeURIComponent(query)}`;
}

function explorerAddress(address) {
  return `${ACTIVE_NETWORK.explorer}/address/${address}`;
}

function explorerTx(hash) {
  return `${ACTIVE_NETWORK.explorer}/tx/${hash}`;
}

function nav(path, label) {
  return `<a class="${state.route === path ? "active" : ""}" href="#${path}">${label}</a>`;
}

function walletPicker() {
  if (!state.walletPickerOpen) return "";
  return `<div class="wallet-backdrop" onclick="closeWalletPicker()">
    <section class="wallet-dialog" role="dialog" aria-modal="true" aria-labelledby="wallet-title" onclick="event.stopPropagation()">
      <button class="wallet-close" type="button" aria-label="Close wallet selection" onclick="closeWalletPicker()">&times;</button>
      <div class="kicker">Secure connection</div>
      <h2 id="wallet-title">Choose a wallet</h2>
      <p>Connect directly through a browser extension or open WalletConnect for mobile and desktop wallets.</p>
      <div class="wallet-options">
        <button type="button" class="wallet-option" onclick="connectWallet('injected')">
          <strong>Browser wallet</strong><span>MetaMask, Phantom, Coinbase Wallet</span>
        </button>
        <button type="button" class="wallet-option" onclick="connectWallet('walletconnect')">
          <strong>WalletConnect</strong><span>QR code and mobile deep links</span>
        </button>
      </div>
      <p class="wallet-security">Nest only requests an address and a login signature. Private keys never leave your wallet.</p>
    </section>
  </div>`;
}

function shell(content) {
  return `
    <div class="shell">
      <header class="topbar">
        <a class="brand" href="#/"><span class="mark">N</span><span>Nest</span></a>
        <nav class="nav">
          ${nav("/", "Home")}
          ${nav("/launch", "Create")}
          ${nav("/explore", "Explore")}
          ${nav("/mint", "Mint")}
          ${nav("/dashboard", "Dashboard")}
          ${nav("/admin", "Admin")}
        </nav>
        <div class="wallet">
          <span class="backend-status ${state.backend}">${state.backend === "online" ? "API connected" : state.backend === "offline" ? "Demo mode" : "Checking API"}</span>
          <span class="wallet-address">${state.walletAddress ? `${state.walletAddress.slice(0,6)}...${state.walletAddress.slice(-4)}` : "Wallet disconnected"}</span>
          ${state.walletAddress
            ? `<button class="btn small" onclick="disconnectWallet()">Disconnect</button>`
            : `<button class="btn small primary" onclick="openWalletPicker()">Connect wallet</button>`}
        </div>
      </header>
      ${content}
      <footer class="footer">
        <span>Nest is the permissionless NFT launchpad for Robinhood Chain.</span>
        <span>This is an independent application built on Robinhood Chain and is not affiliated with or endorsed by Robinhood Markets, Inc. Marketplace availability and royalty enforcement depend on third-party platforms.</span>
      </footer>
      ${walletPicker()}
    </div>
  `;
}

function homePage() {
  return shell(`
    <main class="page">
      <section class="hero">
        <div class="hero-copy">
          <div class="kicker">NFT infrastructure for Robinhood Chain</div>
          <h1>Turn any artwork into an onchain collection.</h1>
          <p>Upload your files, generate permanent metadata, deploy on Robinhood Chain, and open your mint to the community.</p>
          <div class="actions">
            <a class="btn primary" href="#/launch">Launch a collection</a>
            <a class="btn ghost" href="#/mint">Explore live mints</a>
          </div>
          <div class="hero-facts"><span><strong>95%</strong> creator share</span><span><strong>ERC-721</strong> contracts</span><span><strong>IPFS</strong> metadata</span></div>
          <p class="support-line">Creator pays network gas in ETH. Nest fee: 5% of primary mint revenue.</p>
        </div>
        <div class="model-stage" onmousemove="tiltModel(event)" onmouseleave="resetModel()">
          <div class="lime-mark"></div>
          <div class="model-fallback"></div>
          <model-viewer id="heroModel" src="./cyberpunk_card.glb" camera-controls auto-rotate auto-rotate-delay="0" rotation-per-second="8deg" shadow-intensity=".34" exposure="1.04" environment-image="neutral" camera-orbit="18deg 70deg 112%" min-camera-orbit="auto auto 76%" max-camera-orbit="auto auto 136%" reveal="auto" loading="eager" alt="Floating cyberpunk NFT card"></model-viewer>
          <div class="model-loading">Loading 3D card</div>
        </div>
      </section>
      ${tickerSection()}
      ${liveMintsSection()}
      ${processSection()}
      ${chainSection()}
      ${economicsSection()}
      ${explorePreviewSection()}
      <section class="section final-cta"><div><div class="kicker">Ready for testnet</div><h2>Build the mint path before the campaign page.</h2><p>Artwork to IPFS, metadata to IPFS, wallet transaction, Robinhood Chain Testnet contract, public mint, explorer verification, then OpenSea-compatible indexing.</p></div><a class="btn primary" href="#/launch">Start creation flow</a></section>
    </main>
  `);
}

function tickerSection() {
  return `<section class="ticker"><span>Nest mints</span><strong>Network</strong> ${ACTIVE_NETWORK.name}<strong>Chain ID</strong> ${ACTIVE_NETWORK.chainId}<strong>Gas token</strong> ETH<strong>Live Nest drops</strong> ${platformCollections.length}<strong>OpenSea discovery</strong> ${openseaCollections.length} collections</section>`;
}

function liveMintsSection() {
  return `<section class="section"><div class="section-head"><div><div class="kicker">Upcoming Nest mints</div><h2>Real launches from the Nest database.</h2></div><p>Only collections prepared or deployed through Nest appear here. Mint availability follows database and onchain deployment status.</p></div>${platformCollections.length ? `<div class="mint-list">${platformCollections.map(platformRow).join("")}</div>` : platformEmptyState()}</section>`;
}

function platformEmptyState() {
  const copy = state.backend === "online"
    ? "No creator has published an upcoming or live Nest mint yet. The first database-backed launch will appear here automatically."
    : "Nest could not reach the collection database. Upcoming mints will return automatically when the API reconnects.";
  return `<article class="panel opensea-empty"><div><span class="state-label">Database-backed mints</span><h3>No upcoming mints available</h3><p>${copy}</p></div><div class="actions"><a class="btn primary" href="#/launch">Launch a collection</a><button class="btn ghost" type="button" onclick="checkBackend()">Refresh mints</button></div></article>`;
}

function platformRow(c) {
  const price = c.price === "Free" ? "Free" : `${c.price} ETH`;
  const progress = Math.round(c.minted / c.supply * 100);
  const contractLink = c.contractAddress ? `<a href="${explorerAddress(c.contractAddress)}" target="_blank" rel="noopener noreferrer">View contract</a>` : `<span>Contract pending</span>`;
  return `<article class="collection-row"><a class="row-art" style="${platformArtStyle(c)}" href="#/mint/${c.id}"></a><div><span class="state-label">${c.status}</span><h3>${c.name}</h3><p>${c.description}</p><div class="row-meta"><span>${c.creator}</span><span>${price}</span><span>${c.minted}/${c.supply} minted</span><span>${c.endsIn}</span></div><div class="progress"><span style="width:${progress}%"></span></div></div><div class="row-links"><a href="#/mint/${c.id}">Open mint page</a>${contractLink}</div></article>`;
}

function collectionRow(c) {
  return `<article class="collection-row"><a class="row-art" style="${collectionArtStyle(c)}" href="#/collection/${c.id}"></a><div><span class="state-label">${c.verified ? "OpenSea verified" : "OpenSea"}</span><h3>${c.name}</h3><p>${c.description}</p><div class="row-meta"><span>Floor ${c.floor}</span><span class="metric-${c.changeType}">${c.change} 1d</span><span>${c.status}</span></div></div><div class="row-links"><a href="${c.openseaUrl || "https://opensea.io"}" target="_blank" rel="noopener noreferrer">View on OpenSea</a><span>Robinhood Chain</span></div></article>`;
}

function openseaEmptyState(title, copy) {
  return `<article class="panel opensea-empty"><div><span class="state-label">OpenSea data</span><h3>${title}</h3><p>${copy}</p></div><div class="technical-table"><div><span>Source</span><strong>${OPENSEA_SOURCE.source}</strong></div><div><span>Chain</span><strong>${OPENSEA_SOURCE.chain}</strong></div><div><span>Last checked</span><strong>${OPENSEA_SOURCE.checkedAt}</strong></div><div><span>Status</span><strong>${OPENSEA_SOURCE.status}</strong></div><div><span>Requirement</span><strong>${OPENSEA_SOURCE.note}</strong></div></div><div class="actions"><a class="btn primary" href="https://opensea.io" target="_blank" rel="noopener noreferrer">Open OpenSea</a><a class="btn ghost" href="${OPENSEA_SOURCE.docsUrl}" target="_blank" rel="noopener noreferrer">API docs</a></div></article>`;
}

function processSection() {
  const steps = [
    ["01", "Upload artwork"],
    ["02", "Create metadata"],
    ["03", "Configure mint"],
    ["04", "Deploy on Robinhood Chain"],
    ["05", "Share the mint page"],
    ["06", "Trade after mint"]
  ];
  return `<section class="section"><div class="section-head"><div><div class="kicker">Launch process</div><h2>From file to verified contract.</h2></div></div><div class="step-list">${steps.map(([n,t])=>`<div class="step"><span>${n}</span><h3>${t}</h3></div>`).join("")}</div></section>`;
}

function chainSection() {
  return `<section class="section editorial-split"><div><div class="kicker">Robinhood Chain</div><h2>Creator-owned ERC-721 contracts on an EVM network.</h2><p>Deploy standard ERC-721 metadata contracts, pay gas in ETH, verify bytecode on the public explorer, and expose metadata for OpenSea indexing when marketplace support is available.</p></div><div class="technical-table"><div><span>Network</span><strong>${ACTIVE_NETWORK.name}</strong></div><div><span>Chain ID</span><strong>${ACTIVE_NETWORK.chainId}</stron…5544 tokens truncated…>Testnet setup</span><h3>Deploy Nest factory</h3><p>This one-time transaction creates the factory used by all Nest testnet collections. The connected wallet becomes factory owner.</p>${deployRow("Network", `${NETWORKS.testnet.name} / ${NETWORKS.testnet.chainId}`)}${deployRow("Owner", state.walletAddress || "Connect platform owner wallet")}${deployRow("Treasury", PLATFORM_TREASURY)}${deployRow("Primary fee", "5% / 500 bps")}${deployRow("Factory version", "1.0.0-testnet")}${deployRow("Status", factory.status)}${deployRow("Transaction", txRow)}${deployRow("Contract", addressRow)}<div class="actions"><button class="btn primary" type="button" onclick="deployTestnetFactory()" ${factory.contractAddress ? "disabled" : ""}>${factory.contractAddress ? "Factory deployed" : "Deploy testnet factory"}</button><button class="btn ghost" type="button" onclick="switchNetwork()">Switch to testnet</button></div><p class="warning">Use the platform owner wallet. Never paste a seed phrase or private key into Nest, Railway, or GitHub.</p></div><div class="panel"><h3>After deployment</h3><table class="table"><tr><th>Step</th><th>Result</th></tr><tr><td>Explorer confirmation</td><td>Factory bytecode and constructor transaction visible</td></tr><tr><td>Railway variable</td><td>Add contract as FACTORY_TESTNET_ADDRESS</td></tr><tr><td>Backend deployment API</td><td>Prepare creator-signed collection calls</td></tr><tr><td>Indexer</td><td>Track CollectionCreated and Minted events</td></tr></table></div></section><div class="panel"><p>Admin access must be read from connected-wallet contract ownership or explicit authorization. This interface must not rely on a frontend-only role switcher.</p><table class="table"><tr><th>Function</th><th>Authority</th></tr><tr><td>View all factory deployments</td><td>Public indexed data</td></tr><tr><td>Feature/unfeature in app database</td><td>Server-side admin auth</td></tr><tr><td>Hide malicious content from discovery</td><td>Presentation only, does not delete blockchain data</td></tr><tr><td>Pause factory deployment</td><td>Factory owner</td></tr><tr><td>Manage Nest treasury</td><td>Contract permissions</td></tr><tr><td>Withdraw Nest revenue</td><td>Treasury role</td></tr></table></div></main>`);
}

function activityList() {
  return integrationActivity.map((a,i)=>`<div class="activity-item"><div class="thumb" style="${artStyle(i)}"></div><div><strong>${a[1]}</strong><div>${a[0]}</div></div><span>${a[2]}</span></div>`).join("");
}

function setLaunch(key, value) { state.launch[key] = value; }
function setStep(step) { state.launchStep = step; render(); }
async function checkBackend() {
  try {
    const response = await fetch(`${API_ORIGIN}/health`, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error("Nest API unavailable");
    state.backend = "online";
    state.backendMessage = "Nest API and database connected";
    await loadBackendCollections();
  } catch (error) {
    state.backend = "offline";
    state.backendMessage = "Backend offline; upcoming mints are temporarily unavailable";
    platformCollections = [];
  }
  render();
}

async function loadBackendCollections() {
  const result = await apiRequest("/collections?status=UPCOMING&take=24");
  platformCollections = [];
  if (!Array.isArray(result.items) || !result.items.length) return;
  platformCollections = result.items.map((c, index) => ({
    id: c.id,
    contractAddress: c.contractAddress || c.deployments?.[0]?.contractAddress || "",
    name: c.name,
    creator: c.creatorName || "Nest creator",
    creatorAddress: c.creatorWallet,
    description: c.description,
    minted: c.mintedSupply || 0,
    supply: c.maxSupply,
    price: weiToEth(c.mintPriceWei),
    maxWallet: c.maxPerWallet,
    status: collectionStatusLabel(c.status),
    canMint: c.status === "LIVE" && Boolean(c.contractAddress || c.deployments?.[0]?.contractAddress),
    chainName: c.chainName,
    endsIn: mintSchedule(c),
    deployedAt: "Nest deployment",
    metadataCid: c.metadataBaseUri || "Metadata pending",
    image: ipfsUrl(c.assets?.[0]?.ipfsUri || c.metadataItems?.[0]?.imageUri),
    art: index % ARTWORK.length
  }));
}

function collectionStatusLabel(status) {
  return ({ STORAGE_READY: "Artwork ready", READY_TO_DEPLOY: "Upcoming mint", DEPLOYING: "Deployment pending", LIVE: "Live mint" })[status] || status;
}

function mintSchedule(collection) {
  const now = Date.now();
  const starts = collection.mintStartAt ? new Date(collection.mintStartAt) : null;
  const ends = collection.mintEndAt ? new Date(collection.mintEndAt) : null;
  if (starts && starts.getTime() > now) return `Starts ${starts.toLocaleString()}`;
  if (ends) return `Ends ${ends.toLocaleString()}`;
  return collection.status === "LIVE" ? "Open mint" : "Schedule pending";
}

function ethToWei(value) {
  const [whole = "0", decimal = ""] = String(value || "0").split(".");
  return (BigInt(whole || "0") * 10n ** 18n + BigInt((decimal + "0".repeat(18)).slice(0, 18))).toString();
}

function weiToEth(value) {
  if (!value) return "0";
  const padded = String(value).padStart(19, "0");
  const whole = padded.slice(0, -18) || "0";
  const fraction = padded.slice(-18).replace(/0+$/, "").slice(0, 4);
  return fraction ? `${whole}.${fraction}` : whole;
}

function openWalletPicker() { state.walletPickerOpen = true; render(); }
function closeWalletPicker() { state.walletPickerOpen = false; render(); }

function resetWalletSession(message = "Wallet disconnected.") {
  state.wallet = "disconnected";
  state.walletAddress = "";
  state.walletProviderName = "";
  state.authToken = "";
  localStorage.removeItem("nestWalletAddress");
  localStorage.removeItem("nestAuthToken");
  state.notice = message;
}

function observeWalletProvider(provider) {
  if (!provider?.on || observedWalletProviders.has(provider)) return;
  observedWalletProviders.add(provider);
  provider.on("accountsChanged", (accounts) => {
    const walletAddress = accounts?.[0] || "";
    state.walletAddress = walletAddress;
    state.authToken = "";
    localStorage.removeItem("nestAuthToken");
    if (walletAddress) localStorage.setItem("nestWalletAddress", walletAddress);
    else localStorage.removeItem("nestWalletAddress");
    state.notice = walletAddress ? "Wallet account changed. Sign in again to continue." : "Wallet disconnected.";
    render();
  });
  provider.on("disconnect", () => { resetWalletSession(); render(); });
  provider.on("chainChanged", () => render());
}

async function getWalletConnectProvider() {
  if (walletConnectProvider) return walletConnectProvider;
  const walletConnectModule = await import(WALLETCONNECT_PROVIDER_URL);
  const EthereumProvider = walletConnectModule.default || walletConnectModule.EthereumProvider;
  if (!EthereumProvider?.init) throw new Error("WalletConnect could not be initialized.");
  walletConnectProvider = await EthereumProvider.init({
    projectId: WALLETCONNECT_PROJECT_ID,
    chains: [NETWORKS.testnet.chainId],
    optionalChains: [NETWORKS.mainnet.chainId],
    showQrModal: true,
    rpcMap: {
      [NETWORKS.testnet.chainId]: NETWORKS.testnet.rpcUrl,
      [NETWORKS.mainnet.chainId]: NETWORKS.mainnet.rpcUrl
    },
    methods: ["eth_sendTransaction", "personal_sign", "eth_signTypedData_v4", "wallet_switchEthereumChain", "wallet_addEthereumChain"],
    events: ["accountsChanged", "chainChanged", "disconnect"],
    metadata: {
      name: "Nest",
      description: "NFT launch infrastructure for Robinhood Chain",
      url: location.origin,
      icons: []
    }
  });
  observeWalletProvider(walletConnectProvider);
  return walletConnectProvider;
}

async function authenticateWallet(provider, walletAddress) {
  if (state.backend !== "online") {
    state.notice = "Wallet connected. Backend is offline, so launch drafts remain local for now.";
    return;
  }
  const challenge = await apiRequest("/auth/nonce", { method: "POST", body: JSON.stringify({ walletAddress }) });
  const signature = await provider.request({ method: "personal_sign", params: [challenge.message, walletAddress] });
  const verified = await apiRequest("/auth/verify", { method: "POST", body: JSON.stringify({ sessionId: challenge.sessionId, message: challenge.message, signature }) });
  state.authToken = verified.token;
  localStorage.setItem("nestAuthToken", verified.token);
  state.notice = "Wallet connected and authenticated with Nest.";
}

async function connectWallet(mode = "injected") {
  state.walletPickerOpen = false;
  state.notice = mode === "walletconnect" ? "Opening WalletConnect..." : "Opening browser wallet...";
  render();
  try {
    let provider;
    let accounts;
    if (mode === "walletconnect") {
      provider = await getWalletConnectProvider();
      await provider.connect();
      accounts = provider.accounts?.length ? provider.accounts : await provider.request({ method: "eth_accounts" });
      state.walletProviderName = "WalletConnect";
    } else {
      if (!window.ethereum) throw new Error("No browser wallet detected. Use WalletConnect or install a compatible wallet.");
      provider = window.ethereum;
      observeWalletProvider(provider);
      accounts = await provider.request({ method: "eth_requestAccounts" });
      state.walletProviderName = "Browser wallet";
    }
    const walletAddress = accounts?.[0];
    if (!walletAddress) throw new Error("The wallet did not return an account.");
    activeWalletProvider = provider;
    state.wallet = "connected";
    state.walletAddress = walletAddress;
    localStorage.setItem("nestWalletAddress", walletAddress);
    await authenticateWallet(provider, walletAddress);
  } catch (error) {
    state.notice = `Wallet connection failed: ${error.message}`;
  }
  render();
}

async function disconnectWallet() {
  try {
    if (activeWalletProvider === walletConnectProvider && walletConnectProvider?.disconnect) {
      await walletConnectProvider.disconnect();
    }
  } catch {}
  activeWalletProvider = null;
  resetWalletSession();
  render();
}

async function waitForTransactionReceipt(provider, txHash, attempts = 60) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const receipt = await provider.request({ method: "eth_getTransactionReceipt", params: [txHash] });
    if (receipt) return receipt;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error("Transaction is still pending. Use the explorer link to continue tracking it.");
}

async function ensureTestnetNetwork(provider) {
  const chainId = `0x${NETWORKS.testnet.chainId.toString(16)}`;
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
  } catch (error) {
    if (error.code !== 4902 && !error.message?.includes("Unrecognized chain")) throw error;
    await provider.request({ method: "wallet_addEthereumChain", params: [{
      chainId,
      chainName: NETWORKS.testnet.name,
      nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
      rpcUrls: [NETWORKS.testnet.rpcUrl],
      blockExplorerUrls: [NETWORKS.testnet.explorer]
    }] });
  }
}

async function deployTestnetFactory() {
  if (!state.walletAddress || !activeWalletProvider) {
    state.notice = "Connect the platform owner wallet before deploying the factory.";
    openWalletPicker();
    return;
  }
  state.factoryDeployment.status = "Preparing contract bytecode";
  render();
  try {
    await ensureTestnetNetwork(activeWalletProvider);
    const [artifactResponse, viem] = await Promise.all([
      fetch(FACTORY_ARTIFACT_URL, { cache: "no-store" }),
      import(VIEM_PROVIDER_URL)
    ]);
    if (!artifactResponse.ok) throw new Error("Factory artifact could not be loaded.");
    const artifact = await artifactResponse.json();
    const data = viem.encodeDeployData({
      abi: artifact.abi,
      bytecode: artifact.bytecode,
      args: [state.walletAddress, PLATFORM_TREASURY, 500, "1.0.0-testnet"]
    });
    const gas = await activeWalletProvider.request({
      method: "eth_estimateGas",
      params: [{ from: state.walletAddress, data }]
    });
    state.factoryDeployment.status = "Waiting for wallet confirmation";
    render();
    const txHash = await activeWalletProvider.request({
      method: "eth_sendTransaction",
      params: [{ from: state.walletAddress, data, gas }]
    });
    state.factoryDeployment.txHash = txHash;
    state.factoryDeployment.status = "Pending testnet confirmation";
    render();
    const receipt = await waitForTransactionReceipt(activeWalletProvider, txHash);
    if (receipt.status !== "0x1" || !receipt.contractAddress) throw new Error("Factory deployment transaction failed.");
    state.factoryDeployment.contractAddress = receipt.contractAddress;
    state.factoryDeployment.status = "Confirmed on Robinhood Chain Testnet";
    localStorage.setItem("nestFactoryTestnetAddress", receipt.contractAddress);
    state.notice = "Factory deployed. Add the confirmed address to Railway as FACTORY_TESTNET_ADDRESS.";
  } catch (error) {
    state.factoryDeployment.status = `Failed: ${error.message}`;
  }
  render();
}

function draftPayload() {
  const wallet = state.walletAddress || state.launch.creatorWallet;
  return {
    name: state.launch.name,
    symbol: state.launch.symbol,
    description: state.launch.description,
    chainId: ACTIVE_NETWORK.chainId,
    chainName: ACTIVE_NETWORK.name,
    mintCurrency: ACTIVE_NETWORK.currency,
    mintPriceWei: ethToWei(state.launch.price),
    maxSupply: Number(state.launch.supply),
    maxPerWallet: Number(state.launch.maxWallet),
    royaltyBps: Number(state.launch.royaltyBps),
    creatorPayoutWallet: state.launch.payout || wallet,
    websiteUrl: state.launch.website || undefined,
    socialUrl: state.launch.social || undefined
  };
}

async function saveDraft(silent = false) {
  if (state.backend !== "online" || !state.authToken) {
    localStorage.setItem("nestLaunchDraft", JSON.stringify(state.launch));
    if (!silent) { state.notice = "Draft saved in this browser. Connect wallet and backend to save it to Nest."; render(); }
    return false;
  }
  try {
    const draft = await apiRequest(state.collectionId ? `/collections/${state.collectionId}` : "/collections", {
      method: state.collectionId ? "PATCH" : "POST",
      body: JSON.stringify(draftPayload())
    });
    state.collectionId = draft.id;
    localStorage.setItem("nestDraftCollectionId", draft.id);
    state.notice = "Draft saved securely to Nest.";
    if (!silent) render();
    return true;
  } catch (error) {
    state.notice = `Draft save failed: ${error.message}`;
    if (!silent) render();
    return false;
  }
}

async function continueLaunch() {
  await saveDraft(true);
  setStep(Math.min(state.launchStep + 1, 7));
}

async function uploadArtwork(files) {
  if (!files?.length) return;
  if (!state.collectionId) await saveDraft(true);
  if (state.backend !== "online" || !state.authToken || !state.collectionId) {
    state.notice = `${files.length} file(s) selected. Connect the backend and wallet to upload to IPFS.`;
    render();
    return;
  }
  try {
    const form = new FormData();
    form.append("collectionId", state.collectionId);
    [...files].forEach((file) => form.append("file", file));
    const result = await apiRequest("/storage/artwork", { method: "POST", body: form });
    state.notice = `${result.assets.length} artwork file(s) uploaded and pinned to IPFS.`;
  } catch (error) {
    state.notice = `Artwork upload failed: ${error.message}`;
  }
  render();
}
function runReadiness() { state.readiness = "Requires live Wagmi/Viem check"; render(); }
async function addNetwork() {
  try {
    if (!activeWalletProvider) throw new Error("Connect a wallet first.");
    await activeWalletProvider.request({ method: "wallet_addEthereumChain", params: [{
      chainId: `0x${ACTIVE_NETWORK.chainId.toString(16)}`,
      chainName: ACTIVE_NETWORK.name,
      nativeCurrency: { name: ACTIVE_NETWORK.currency, symbol: ACTIVE_NETWORK.currency, decimals: 18 },
      rpcUrls: [ACTIVE_NETWORK.rpcUrl],
      blockExplorerUrls: [ACTIVE_NETWORK.explorer]
    }] });
    state.deploymentState = `${ACTIVE_NETWORK.name} added to the connected wallet.`;
  } catch (error) {
    state.deploymentState = `Network setup failed: ${error.message}`;
  }
  render();
}
async function switchNetwork() {
  try {
    if (!activeWalletProvider) throw new Error("Connect a wallet first.");
    await activeWalletProvider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: `0x${ACTIVE_NETWORK.chainId.toString(16)}` }] });
    state.deploymentState = `Connected to ${ACTIVE_NETWORK.name}.`;
  } catch (error) {
    if (error.code === 4902 || error.message?.includes("Unrecognized chain")) return addNetwork();
    state.deploymentState = `Network switch failed: ${error.message}`;
    render();
  }
}
function showDeployBlocked() { state.deploymentState = "No transaction sent in this static preview. Wire Wagmi + Viem simulation before enabling deployment."; render(); }
function showMintBlocked() { state.mintState = "No mint transaction sent in this static preview. Read contract state and simulate mint before enabling."; render(); }
function tiltModel(event) {
  const model = document.getElementById("heroModel");
  if (!model) return;
  const rect = event.currentTarget.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width - .5) * 10;
  const y = ((event.clientY - rect.top) / rect.height - .5) * -6;
  model.style.transform = `rotateY(${x}deg) rotateX(${y}deg)`;
}
function resetModel() {
  const model = document.getElementById("heroModel");
  if (model) model.style.transform = "";
}

function animateCounters(root = document) {
  const counters = [...root.querySelectorAll("[data-count-to]")];
  if (!counters.length) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const run = (section) => {
    const sectionCounters = [...section.querySelectorAll("[data-count-to]")];
    sectionCounters.forEach((counter) => {
      if (counter.dataset.counted === "true") return;
      counter.dataset.counted = "true";
      const target = Number(counter.dataset.countTo || 0);
      if (reduceMotion) {
        counter.textContent = String(target);
        return;
      }
      const duration = 1200;
      const start = performance.now();
      const tick = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        counter.textContent = String(Math.round(target * eased));
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  };

  const sections = [...root.querySelectorAll("[data-counter-section]")];
  if (!("IntersectionObserver" in window)) {
    sections.forEach(run);
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      run(entry.target);
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.35 });

  sections.forEach((section) => observer.observe(section));
}

function render() {
  const route = state.route;
  let html;
  if (route === "/") html = homePage();
  else if (route === "/launch") html = launchPage();
  else if (route === "/mint") html = mintPage();
  else if (route.startsWith("/mint/")) html = mintCollectionPage(route.split("/").pop());
  else if (route === "/explore") html = explorePage();
  else if (route === "/dashboard") html = dashboardPage();
  else if (route === "/admin") html = adminPage();
  else if (route.startsWith("/collection/")) html = collectionPage(route.split("/").pop());
  else html = homePage();
  document.getElementById("app").innerHTML = html;
  animateCounters(document);
}

const localDraft = localStorage.getItem("nestLaunchDraft");
if (localDraft) {
  try { state.launch = { ...state.launch, ...JSON.parse(localDraft) }; } catch {}
}
render();
checkBackend();


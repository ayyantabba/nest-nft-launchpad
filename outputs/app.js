const NETWORKS = {
  testnet: {
    key: "robinhood-testnet",
    name: "Robinhood Chain Testnet",
    chainId: 46630,
    currency: "ETH",
    rpcUrl: "https://rpc.testnet.chain.robinhood.com",
    explorer: "https://explorer.testnet.chain.robinhood.com",
    faucet: "https://faucet.testnet.chain.robinhood.com/",
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

const RUNTIME_CONFIG = window.NEST_RUNTIME_CONFIG || {};
const REQUESTED_NETWORK = RUNTIME_CONFIG.network === "mainnet" ? "mainnet" : "testnet";
const MAINNET_DEPLOYMENT_CONFIRMED = RUNTIME_CONFIG.confirmMainnetDeployment === true;
const ACTIVE_NETWORK_KEY = REQUESTED_NETWORK === "mainnet" && MAINNET_DEPLOYMENT_CONFIRMED ? "mainnet" : "testnet";
const ACTIVE_NETWORK = NETWORKS[ACTIVE_NETWORK_KEY];
const SECONDARY_NETWORK = NETWORKS[ACTIVE_NETWORK_KEY === "mainnet" ? "testnet" : "mainnet"];
const ACTIVE_FACTORY_STORAGE_KEY = ACTIVE_NETWORK_KEY === "mainnet" ? "nestFactoryMainnetAddress" : "nestFactoryTestnetAddress";
const ACTIVE_FACTORY_VERSION = ACTIVE_NETWORK_KEY === "mainnet" ? "1.0.0" : "1.0.0-testnet";
const WALLETCONNECT_PROJECT_ID = window.NEST_WALLETCONNECT_PROJECT_ID || "63564cf2fc58ce8b1059edd34ac041e0";
const WALLETCONNECT_PROVIDER_URL = "https://esm.sh/@walletconnect/ethereum-provider@2.23.10?bundle";
const VIEM_PROVIDER_URL = "https://esm.sh/viem@2.31.7?bundle";
const PLATFORM_TREASURY = "0xaB81d488395EdebC6632c7546d223439bD8FBdD1";
const FACTORY_ARTIFACT_URL = "./assets/contracts/RobinhoodNFTFactory.json";
const OPENSEA_CHAIN_SLUG = "robinhood";
const COLLECTION_MINT_ABI = [{ type: "function", name: "mint", stateMutability: "payable", inputs: [{ name: "quantity", type: "uint256" }], outputs: [] }];
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
    contractAddress: localStorage.getItem(ACTIVE_FACTORY_STORAGE_KEY) || ""
  },
  authToken: localStorage.getItem("nestAuthToken") || "",
  walletAddress: localStorage.getItem("nestWalletAddress") || "",
  collectionId: localStorage.getItem("nestDraftCollectionId") || "",
  notice: "",
  artworkAssets: [],
  metadataBaseUri: "",
  contractUri: "",
  buyerNfts: [],
  lastMint: null,
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

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
}

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

function openseaAssetUrl(contractAddress, tokenId) {
  return "https://opensea.io/assets/" + OPENSEA_CHAIN_SLUG + "/" + contractAddress + "/" + tokenId;
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
        <a class="brand" href="#/" aria-label="Nest home">nest</a>
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
          <p class="model-credit">3D model by <a href="https://sketchfab.com/rodrigobento" target="_blank" rel="noopener noreferrer">Rodrigo Bento</a>. Owner royalties apply.</p>
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
  return `<section class="section editorial-split"><div><div class="kicker">Robinhood Chain</div><h2>Creator-owned ERC-721 contracts on an EVM network.</h2><p>Deploy standard ERC-721 metadata contracts, pay gas in ETH, verify bytecode on the public explorer, and expose metadata for OpenSea indexing when marketplace support is available.</p></div><div class="technical-table"><div><span>Network</span><strong>${ACTIVE_NETWORK.name}</strong></div><div><span>Chain ID</span><strong>${ACTIVE_NETWORK.chainId}</strong></div><div><span>RPC</span><strong>${ACTIVE_NETWORK.rpcUrl}</strong></div><div><span>Explorer</span><strong>${ACTIVE_NETWORK.explorer}</strong></div><div><span>Standard</span><strong>ERC-721 + ERC-2981 signaling</strong></div></div></section>`;
}

function economicsSection() {
  return `<section class="section economics" data-counter-section><div><div class="kicker">Creator economics</div><h2>Primary revenue is accounted onchain.</h2><p>The 5% Nest fee applies to primary mint revenue. Gas is paid separately by the transaction initiator. ERC-2981 royalties are signaled onchain, but secondary marketplaces may choose whether to enforce royalties.</p></div><div class="split-diagram"><div><strong><span class="count-number" data-count-to="95">0</span>%</strong><span>Creator</span></div><div><strong><span class="count-number" data-count-to="5">0</span>%</strong><span>Nest</span></div></div></section>`;
}

function explorePreviewSection() {
  return `<section class="section"><div class="section-head"><div><div class="kicker">Explore collections</div><h2>Robinhood collections trading on OpenSea.</h2></div><p>Floor and one-day movement are seeded from the visible OpenSea ranking list. Live floor, volume, listing, and activity sync belongs in the server OpenSea adapter.</p></div>${openseaCollections.length ? `<div class="grid gallery-grid">${openseaCollections.map(card).join("")}</div>` : openseaEmptyState("OpenSea discovery is waiting for indexed data", "No real Robinhood Chain NFT collection records were found publicly, so the app is no longer displaying sample collections.")}</section>`;
}

function card(c) {
  return `<article class="card market-card opensea-card"><div class="opensea-card-head"><a class="collection-avatar opensea-art" style="${collectionArtStyle(c)}" href="#/collection/${c.id}" aria-label="${c.name}"></a><div><span class="state-label">${c.verified ? "OpenSea verified" : "OpenSea"}</span><h3>${c.name}</h3><p>${c.status}</p></div></div><div class="card-metrics"><div><span>Floor</span><strong>${c.floor}</strong></div><div><span>1d</span><strong class="metric-${c.changeType}">${c.change}</strong></div></div><div class="opensea-card-actions"><a class="market-link" href="#/collection/${c.id}">Details</a><a class="market-link" href="${c.openseaUrl}" target="_blank" rel="noopener noreferrer">OpenSea</a></div></article>`;
}

function launchPage() {
  const steps = ["Identity", "Artwork", "Metadata", "Configuration", "Storage", "Contract preview", "Deploy"];
  return shell(`<main class="page app-layout"><aside class="side panel">${steps.map((s,i)=>`<button class="${state.launchStep === i + 1 ? "active" : ""}" onclick="setStep(${i+1})">${String(i+1).padStart(2,"0")} ${s}</button>`).join("")}</aside><section>${state.notice ? `<div class="notice ${state.notice.toLowerCase().includes("failed") ? "error" : "success"}">${state.notice}</div>` : ""}${launchStep()}</section></main>`);
}

function launchStep() {
  const n = state.launchStep;
  if (n === 1) return stepIdentity();
  if (n === 2) return stepArtwork();
  if (n === 3) return stepMetadata();
  if (n === 4) return stepConfiguration();
  if (n === 5) return stepStorage();
  if (n === 6) return stepContractPreview();
  return stepDeploy();
}

function stepFrame(kicker, title, body, next = true) {
  return `<div class="section-head"><div><div class="kicker">${kicker}</div><h2>${title}</h2></div></div>${body}<div class="flow-actions"><button class="btn ghost" onclick="saveDraft()">Save draft</button>${state.launchStep > 1 ? `<button class="btn ghost" onclick="setStep(${state.launchStep - 1})">Back</button>` : ""}${next ? `<button class="btn primary" onclick="continueLaunch()">Continue</button>` : ""}</div>`;
}

function field(label, key, type = "text", cls = "") {
  const value = state.launch[key] ?? "";
  if (type === "textarea") return `<div class="field ${cls}"><label>${label}</label><textarea oninput="setLaunch('${key}', this.value)">${value}</textarea></div>`;
  return `<div class="field ${cls}"><label>${label}</label><input type="${type}" value="${value}" oninput="setLaunch('${key}', this.value)" /></div>`;
}

function stepIdentity() {
  return stepFrame("Step 01", "Collection identity", `<div class="panel form-grid">${field("Collection name","name")}${field("Symbol","symbol")}${field("Description","description","textarea","full")}${field("Creator display name","creatorName")}${field("Creator wallet","creatorWallet")}${field("Website","website")}${field("X account","x")}${field("Telegram or Discord","social")}<div class="field"><label>Collection avatar</label><input type="file" accept="image/png,image/jpeg,image/webp,image/gif"></div><div class="field"><label>Collection banner</label><input type="file" accept="image/png,image/jpeg,image/webp,image/gif"></div></div>`);
}

function artworkPreviewGrid() {
  if (!state.artworkAssets.length) return `<div class="artwork-empty">Selected artwork previews will appear here.</div>`;
  return `<div class="artwork-previews">${state.artworkAssets.map((asset) => `<article class="artwork-preview">${asset.kind === "image" ? `<img src="${asset.previewUrl}" alt="${escapeHtml(asset.name)}">` : asset.kind === "video" ? `<video src="${asset.previewUrl}" muted playsinline controls></video>` : `<div class="asset-file">3D</div>`}<div><strong>${escapeHtml(asset.name)}</strong><span>${asset.status}</span></div></article>`).join("")}</div>`;
}

function stepArtwork() {
  return stepFrame("Step 02", "Artwork", `<div class="grid cols-2"><div class="panel upload-zone"><div><h3>Upload artwork</h3><p class="artist-rec"><a href="https://frontman-plays.xyz" target="_blank" rel="noopener noreferrer">Don’t have your artwork? Hire our top artist</a></p><p>PNG, JPEG, WEBP, GIF, MP4 and GLB up to 25 MB each. Files preview instantly before IPFS upload.</p><label class="upload-control"><span>Choose artwork</span><input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,model/gltf-binary,.glb" onchange="uploadArtwork(this.files)"></label>${artworkPreviewGrid()}</div></div><div class="panel"><h3>Edition types</h3><table class="table"><tr><th>Type</th><th>Status</th></tr><tr><td>Single edition</td><td>Ready</td></tr><tr><td>Open edition</td><td>Ready</td></tr><tr><td>Repeated artwork</td><td>Ready</td></tr><tr><td>Unique files</td><td>Ready</td></tr><tr><td>ZIP bulk upload</td><td>Backend connected</td></tr></table></div></div>`);
}

function stepMetadata() {
  const pinned = state.artworkAssets.filter((asset) => asset.ipfsUri);
  return stepFrame("Step 03", "Metadata", `<div class="grid cols-2"><div class="panel form-grid">${field("Automatic NFT name pattern","name")}${field("Collection description","description","textarea","full")}<div class="field"><label>Trait type</label><input id="metadataTraitType" value="Background"></div><div class="field"><label>Trait value</label><input id="metadataTraitValue" value="Default"></div><div class="field full"><label>Artwork source</label><strong>${pinned.length ? pinned.length + " IPFS asset(s) ready" : "Upload and pin artwork first"}</strong></div><button class="btn primary full" onclick="generateMetadata()" ${pinned.length ? "" : "disabled"}>Generate and pin metadata</button></div><div class="panel"><h3>Standards-compatible JSON</h3><pre class="code">${metadataJson()}</pre><div class="stat-row"><span>Metadata base URI</span><strong>${state.metadataBaseUri || "Not generated"}</strong></div><div class="stat-row"><span>Contract URI</span><strong>${state.contractUri || "Not generated"}</strong></div></div></div>`);
}

function metadataJson() {
  const firstImage = state.artworkAssets.find((asset) => asset.ipfsUri)?.ipfsUri || "ipfs://IMAGE_CID";
  return JSON.stringify({ name: state.launch.name + " #1", description: state.launch.description, image: firstImage, external_url: state.launch.website, attributes: [{ trait_type: "Background", value: "Default" }] }, null, 2);
}

function stepConfiguration() {
  return stepFrame("Step 04", "Collection configuration", `<div class="panel form-grid">${field("Total supply","supply","number")}${field("Mint price in ETH","price")}${field("Maximum mint per wallet","maxWallet","number")}${field("Maximum mint per transaction","maxTx","number")}<div class="field"><label>Mint start time</label><input type="datetime-local"></div><div class="field"><label>Optional mint end time</label><input type="datetime-local"></div><div class="field"><label>Public mint enabled</label><select><option>Enabled</option><option>Disabled</option></select></div><div class="field"><label>Allowlist phase</label><select><option>Disabled</option><option>Enabled</option></select></div><div class="field"><label>Allowlist mint price</label><input value="0.012"></div><div class="field"><label>Allowlist wallet limits</label><input value="1"></div><div class="field"><label>Reveal</label><select><option>Immediate reveal</option><option>Delayed reveal</option></select></div>${field("Creator payout wallet","payout")}${field("Contract owner wallet","owner")}<div class="field"><label>Secondary royalty percentage</label><input value="5"></div><div class="field full"><strong>Mandatory Nest fee: 5% of primary mint revenue</strong></div></div>`);
}

function stepStorage() {
  const pinnedCount = state.artworkAssets.filter((asset) => asset.ipfsUri).length;
  return stepFrame("Step 05", "Storage verification", `<div class="panel"><p>Artwork and metadata are uploaded through Nest's server-side Pinata integration. Credentials never enter the browser.</p><table class="table"><tr><th>Requirement</th><th>Status</th></tr><tr><td>Artwork pinned</td><td>${pinnedCount ? pinnedCount + " verified asset(s)" : "Required"}</td></tr><tr><td>Metadata directory</td><td>${state.metadataBaseUri || "Required"}</td></tr><tr><td>Contract metadata</td><td>${state.contractUri || "Required"}</td></tr><tr><td>Ready for deployment</td><td>${pinnedCount && state.metadataBaseUri && state.contractUri ? "Ready" : "Incomplete"}</td></tr></table></div>`);
}

function stepContractPreview() {
  return stepFrame("Step 06", "Contract preview", `<div class="panel technical-table"><div><span>Network</span><strong>${ACTIVE_NETWORK.name}</strong></div><div><span>Chain ID</span><strong>${ACTIVE_NETWORK.chainId}</strong></div><div><span>Contract type</span><strong>RobinhoodNFTCollection ERC-721</strong></div><div><span>Collection owner</span><strong>${state.launch.owner}</strong></div><div><span>Creator payout wallet</span><strong>${state.launch.payout}</strong></div><div><span>Supply</span><strong>${state.launch.supply}</strong></div><div><span>Mint price</span><strong>${state.launch.price} ETH</strong></div><div><span>Nest fee</span><strong>5% of primary mint revenue</strong></div><div><span>Metadata base URI</span><strong>ipfs://METADATA_CID/</strong></div><div><span>Estimated gas</span><strong>Requires Viem simulation</strong></div><div><span>Wallet balance</span><strong>Requires connected wallet read</strong></div></div>`);
}

function stepDeploy() {
  const deploySettings = [
    ["Wallet connected", state.readiness, "Creator wallet must connect before Nest can prepare a deploy transaction."],
    ["Correct Robinhood Chain network", state.readiness, `Wallet chain ID must match ${ACTIVE_NETWORK.chainId} before deployment.`],
    ["Valid connected address", state.readiness, "Nest stores this address as deployer, owner, and session identity unless changed."],
    ["Enough ETH for gas", state.readiness, "Creator pays network gas separately from mint revenue and Nest fees."],
    ["Artwork uploaded to IPFS", state.readiness, "Images must be pinned before contract metadata can point to permanent URIs."],
    ["Metadata verified", state.readiness, "Token JSON, image links, and contractURI should resolve before deployment."],
    ["Collection settings valid", state.readiness, "Supply, price, wallet limits, payout wallet, and royalty values must be final."]
  ];
  return stepFrame("Step 07", "Deploy", `<div class="grid cols-2"><div class="panel"><h3>Deploy settings</h3><table class="table deploy-docs-table"><tr><th>Setting</th><th>Status</th><th>Docs</th></tr>${deploySettings.map(([setting,status,docs])=>`<tr><td>${setting}</td><td>${status}</td><td>${docs}</td></tr>`).join("")}</table><button class="btn primary" onclick="runReadiness()">Run readiness check</button><button class="btn ghost" onclick="addNetwork()">Add Robinhood Chain</button><button class="btn ghost" onclick="switchNetwork()">Switch Network</button></div><div class="panel"><h3>Transaction states</h3>${txStates()}<p class="warning">Smart-contract deployment is permanent. Review supply, mint price, payout wallet, metadata, ownership, and Nest fee before confirming.</p><button class="btn primary" onclick="deployCollection()">Prepare wallet transaction</button><p>${state.deploymentState}</p></div></div>`, false);
}

function txStates() {
  return `<ol class="state-list">${["Awaiting wallet confirmation","Transaction submitted","Pending confirmation","Contract created","Waiting for indexer","Metadata verified","OpenSea discovery pending","Launch complete","Failed","Replaced","Dropped"].map(s=>`<li>${s}</li>`).join("")}</ol>`;
}

function mintPage() {
  const featured = platformCollections[0];
  if (!featured) return shell(`<main class="page"><section class="section-head"><div><div class="kicker">Nest mint desk</div><h2>Upcoming and live mints.</h2></div><p>This page reads directly from the Nest collection database.</p></section><section class="section">${platformEmptyState()}</section></main>`);
  return shell(`<main class="page"><section class="section-head"><div><div class="kicker">Nest mint desk</div><h2>Mint collections deployed on Nest.</h2></div><p>Only Nest-created collections appear in this section. OpenSea collections stay in Explore as external marketplace discovery.</p></section><section class="mint-layout"><div><div class="drop-art" style="${platformArtStyle(featured)}"></div><div class="section grid gallery-grid">${platformCollections.map(platformCard).join("")}</div></div>${mintModule(featured)}</section></main>`);
}

function mintCollectionPage(id) {
  const c = platformCollections.find((item) => item.id.toLowerCase() === id.toLowerCase());
  if (!c) return shell(`<main class="page"><section class="section">${platformEmptyState()}</section></main>`);
  return shell(`<main class="page mint-layout"><section><div class="drop-art" style="${platformArtStyle(c)}"></div><div class="section grid cols-3">${[0,1,2,3,4,5].map(i=>`<div class="nft-art thumb-large" style="${c.image ? platformArtStyle(c) : artStyle(c.art + i)}"></div>`).join("")}</div></section>${mintModule(c)}</main>`);
}

function platformCard(c) {
  const price = c.price === "Free" ? "Free" : `${c.price} ETH`;
  const progress = Math.round(c.minted / c.supply * 100);
  return `<article class="card market-card"><a href="#/mint/${c.id}"><div class="nft-art" style="${platformArtStyle(c)}"></div></a><div class="card-body"><span class="state-label">${c.status}</span><h3>${c.name}</h3><p>${c.creator}</p><div class="progress"><span style="width:${progress}%"></span></div><div class="card-metrics"><div><span>Minted</span><strong>${c.minted}/${c.supply}</strong></div><div><span>Price</span><strong>${price}</strong></div></div><a class="market-link" href="#/mint/${c.id}">${c.canMint ? "Mint collection" : "View upcoming drop"}</a></div></article>`;
}

function mintModule(c) {
  const price = c.price === "Free" ? "Free" : c.price + " ETH";
  const progress = Math.round(c.minted / c.supply * 100);
  const contract = c.contractAddress ? '<a href="' + explorerAddress(c.contractAddress) + '" target="_blank" rel="noopener noreferrer">' + c.contractAddress + "</a>" : "Pending deployment";
  const lastMint = state.lastMint?.collectionId === c.id ? state.lastMint : null;
  const marketplace = ACTIVE_NETWORK_KEY === "mainnet" && c.contractAddress ? '<a class="btn ghost block" href="' + (lastMint?.tokenIds?.[0] ? openseaAssetUrl(c.contractAddress, lastMint.tokenIds[0]) : openseaSearchUrl(c.name)) + '" target="_blank" rel="noopener noreferrer">View on OpenSea</a>' : "";
  return `<aside class="panel mint-module"><span class="state-label">${c.status}</span><h1>${c.name}</h1><p>${c.description}</p>${deployRow("Creator", c.creator + " / " + c.creatorAddress)}${deployRow("Network", c.chainName)}${deployRow("Contract", contract)}${deployRow("Mint price", price)}${deployRow("Supply", c.minted + "/" + c.supply)}${deployRow("Max per wallet", c.maxWallet)}${deployRow("Schedule", c.endsIn)}<div class="progress"><span style="width:${progress}%"></span></div><div class="field"><label>Quantity</label><input id="mint-quantity-${c.id}" type="number" min="1" max="${Math.min(c.maxWallet, c.maxTx || c.maxWallet)}" value="1" ${c.canMint ? "" : "disabled"}></div><button class="btn primary block" onclick="mintCollection('${c.id}')" ${c.canMint ? "" : "disabled"}>${c.canMint ? "Mint NFT" : "Mint not live yet"}</button><p id="mintStatus">${c.canMint ? state.mintState : "This collection is upcoming. Minting opens after its deployment is confirmed."}</p>${lastMint ? '<div class="notice success">Mint confirmed. Token IDs: ' + lastMint.tokenIds.join(", ") + ' <a href="' + explorerTx(lastMint.txHash) + '" target="_blank" rel="noopener noreferrer">View transaction</a></div>' : ""}${marketplace}<div class="divider"></div><h3>Primary revenue split</h3><p>Creator receives 95%. Nest receives 5% from primary mint revenue. Gas is paid separately by the buyer.</p></aside>`;
}

function platformActivity(c) {
  if (!c.activity?.length) return '<div class="activity-item"><div><strong>No confirmed mints yet</strong><div>Onchain activity appears after the first buyer mint.</div></div></div>';
  return c.activity.map((item) => { const tokens = Array.isArray(item.tokenIds) ? item.tokenIds.join(", ") : "Pending"; return '<div class="activity-item"><div class="thumb" style="' + platformArtStyle(c) + '"></div><div><strong>Token ' + tokens + " minted</strong><div>" + item.minterWallet.slice(0, 6) + "..." + item.minterWallet.slice(-4) + "</div></div><span>" + new Date(item.confirmedAt || item.createdAt).toLocaleString() + "</span></div>"; }).join("");
}

function collectionPage(address) {
  const c = openseaCollections.find((item) => item.id.toLowerCase() === address.toLowerCase());
  if (!c) {
    return shell(`<main class="page"><section class="section">${openseaEmptyState("Collection not available from OpenSea", "This route only renders live OpenSea-backed Robinhood Chain collection records. Add an OpenSea API key and supported chain slug, then hydrate this page from the collection or contract endpoint.")}</section></main>`);
  }
  return shell(`<main class="page mint-layout market-detail-layout"><section class="panel market-detail-panel"><div class="market-detail-identity"><div class="collection-avatar hero-avatar opensea-art" style="${collectionArtStyle(c)}"></div><div><span class="state-label">${c.verified ? "OpenSea verified" : "OpenSea Robinhood Chain"}</span><h1>${c.name}</h1><p>${c.description}</p></div></div><div class="section grid cols-3 market-samples">${[0,1,2,3,4,5].map(i=>`<div class="nft-art thumb-large" style="${artStyle((c.art || 0) + i)}"></div>`).join("")}</div></section><aside class="panel mint-module"><span class="state-label">Marketplace data</span><h2>${c.name}</h2><p>OpenSea discovery record for Robinhood Chain.</p>${deployRow("Source", c.creator || "OpenSea marketplace")}${deployRow("Floor", c.floor)}${deployRow("1d movement", `<span class="metric-${c.changeType}">${c.change}</span>`)}${deployRow("Status", c.status)}${deployRow("OpenSea", c.openseaUrl ? `<a href="${c.openseaUrl}" target="_blank" rel="noopener noreferrer">Open collection search</a>` : "OpenSea URL unavailable")}${deployRow("Contract", c.contractAddress ? `<a href="${explorerAddress(c.contractAddress)}" target="_blank" rel="noopener noreferrer">${c.contractAddress}</a>` : "Pending API hydration")}<div class="divider"></div><h3>Recent market activity</h3>${activityList()}<h3>Disclosures</h3><p>Thumbnails are shown at avatar size because the current source is the OpenSea ranking screenshot. Live API images should replace these when connected.</p></aside></main>`);
}

function deployRow(a,b) {
  return `<div class="stat-row"><span>${a}</span><strong>${b}</strong></div>`;
}

function explorePage() {
  return shell(`<main class="page explore-layout"><aside class="panel filters"><h3>Filters</h3>${["NFTs / collections","floor price","1d movement","verified","recent activity","Robinhood Chain"].map(x=>`<label><span>${x}</span><select><option>Any</option></select></label>`).join("")}<p class="hint">Current records are seeded from OpenSea ranking visibility. Filters become live when the OpenSea API adapter returns collection rows.</p></aside><section><div class="section-head"><div><div class="kicker">Robinhood Chain discovery</div><h2>Explore OpenSea collections</h2></div></div><div class="actions">${["OpenSea ranked","Verified","Floor under 0.01","Positive 1d","Recently active"].map(x=>`<button class="btn small">${x}</button>`).join("")}</div>${openseaCollections.length ? `<div class="grid gallery-grid">${openseaCollections.map(card).join("")}</div>` : openseaEmptyState("No OpenSea collections loaded", "The discovery page is now wired for real OpenSea data only. Once Robinhood Chain appears in the supported chains response and the API key is configured, collections will render here.")}</section></main>`);
}

function dashboardPage() {
  const collectionRows = platformCollections.map(c=>`<tr><td><div class="mini-art" style="${platformArtStyle(c)}"></div></td><td>${c.name}</td><td>${c.minted}/${c.supply}</td><td>${c.price === "Free" ? "Free" : c.price + " ETH"}</td><td><a href="#/mint/${c.id}">Mint page</a></td></tr>`).join("");
  const ownedRows = state.buyerNfts.map((item) => { const image = ipfsUrl(item.metadata?.imageUri || item.collection?.metadataItems?.[0]?.imageUri || ""); const marketLink = ACTIVE_NETWORK_KEY === "mainnet" && item.collection?.contractAddress ? openseaAssetUrl(item.collection.contractAddress, item.tokenId) : explorerAddress(item.collection?.contractAddress || ""); return `<article class="card market-card"><div class="nft-art" style="--art: url('${image}')"></div><div class="card-body"><span class="state-label">Owned by connected wallet</span><h3>${item.collection.name} #${item.tokenId}</h3><p>Mint transaction: ${item.mintTxHash.slice(0,10)}...</p><a class="market-link" href="${marketLink}" target="_blank" rel="noopener noreferrer">${ACTIVE_NETWORK_KEY === "mainnet" ? "View on OpenSea" : "View contract"}</a></div></article>`; }).join("");
  return shell(`<main class="page"><div class="section-head"><div><div class="kicker">Creator dashboard</div><h2>Manage Nest-deployed collections.</h2></div></div><div class="stats">${["Nest collections","Live collections","Total minted","Primary volume","Creator accrued","Nest fees","Withdrawable","Unique minters"].map((x,i)=>`<div class="stat"><span>${x}</span><strong>${dashboardStat(i)}</strong></div>`).join("")}</div><div class="section grid cols-2"><div class="panel"><h3>Collections deployed on Nest</h3><table class="table"><tr><th>Artwork</th><th>Name</th><th>Minted</th><th>Price</th><th>Link</th></tr>${collectionRows}</table></div><div class="panel"><h3>Creator actions</h3><table class="table"><tr><td>Open mint page</td><td>Public buyer-facing route</td></tr><tr><td>View contract</td><td>Robinhood Chain explorer</td></tr><tr><td>Revenue split</td><td>95% creator / 5% Nest</td></tr><tr><td>OpenSea handoff</td><td>Available after confirmed mainnet mint</td></tr></table></div></div><section class="section"><div class="section-head"><div><div class="kicker">Collector wallet</div><h2>Your minted NFTs</h2></div><p>Ownership is written only after Nest verifies the onchain mint receipt.</p></div>${ownedRows ? '<div class="grid gallery-grid">' + ownedRows + "</div>" : '<div class="panel empty-state"><h3>No confirmed Nest mints in this wallet</h3><p>Minted tokens will appear here with their token ID and marketplace link.</p></div>'}</section></main>`);
}

function dashboardStat(index) {
  const totalMinted = platformCollections.reduce((sum, item) => sum + item.minted, 0);
  const live = platformCollections.filter((item) => item.status !== "Ended").length;
  return [platformCollections.length, live, totalMinted, "Onchain read", "Onchain read", "Onchain read", "Contract read", "Indexer sync"][index];
}

function adminPage() {
  const factory = state.factoryDeployment;
  const addressRow = factory.contractAddress
    ? `<a href="${explorerAddress(factory.contractAddress)}" target="_blank" rel="noopener noreferrer">${factory.contractAddress}</a>`
    : "Created after wallet confirmation";
  const txRow = factory.txHash
    ? `<a href="${explorerTx(factory.txHash)}" target="_blank" rel="noopener noreferrer">${factory.txHash}</a>`
    : "No transaction submitted";
  return shell(`<main class="page"><div class="section-head"><div><div class="kicker">Nest admin</div><h2>Contract-authorized controls only.</h2></div></div><section class="section grid cols-2"><div class="panel"><span class="state-label">${ACTIVE_NETWORK_KEY === "mainnet" ? "Mainnet production" : "Testnet verification"}</span><h3>Deploy Nest factory</h3><p>This one-time transaction creates the factory used by all Nest collections on the active network. The connected wallet becomes factory owner.</p>${deployRow("Network", `${ACTIVE_NETWORK.name} / ${ACTIVE_NETWORK.chainId}`)}${deployRow("Runtime guard", ACTIVE_NETWORK_KEY === "mainnet" ? "Mainnet explicitly confirmed" : "Mainnet locked")}${deployRow("Owner", state.walletAddress || "Connect platform owner wallet")}${deployRow("Treasury", PLATFORM_TREASURY)}${deployRow("Primary fee", "5% / 500 bps")}${deployRow("Factory version", ACTIVE_FACTORY_VERSION)}${deployRow("Status", factory.status)}${deployRow("Transaction", txRow)}${deployRow("Contract", addressRow)}<div class="actions"><button class="btn primary" type="button" onclick="deployNetworkFactory()" ${factory.contractAddress ? "disabled" : ""}>${factory.contractAddress ? "Factory deployed" : `Deploy ${ACTIVE_NETWORK_KEY} factory`}</button><button class="btn ghost" type="button" onclick="switchNetwork()">Switch to ${ACTIVE_NETWORK_KEY}</button>${ACTIVE_NETWORK.faucet ? `<a class="btn ghost" href="${ACTIVE_NETWORK.faucet}" target="_blank" rel="noopener noreferrer">Get testnet ETH</a>` : ""}</div><p class="warning">Use the platform owner wallet. Never paste a seed phrase or private key into Nest, Railway, or GitHub.</p></div><div class="panel"><h3>After deployment</h3><table class="table"><tr><th>Step</th><th>Result</th></tr><tr><td>Explorer confirmation</td><td>Factory bytecode and constructor transaction visible</td></tr><tr><td>Railway variable</td><td>Add contract as ${ACTIVE_NETWORK_KEY === "mainnet" ? "FACTORY_MAINNET_ADDRESS" : "FACTORY_TESTNET_ADDRESS"}</td></tr><tr><td>Backend deployment API</td><td>Prepare creator-signed collection calls</td></tr><tr><td>Indexer</td><td>Track CollectionCreated and Minted events</td></tr></table></div></section><div class="panel"><p>Admin access must be read from connected-wallet contract ownership or explicit authorization. This interface must not rely on a frontend-only role switcher.</p><table class="table"><tr><th>Function</th><th>Authority</th></tr><tr><td>View all factory deployments</td><td>Public indexed data</td></tr><tr><td>Feature/unfeature in app database</td><td>Server-side admin auth</td></tr><tr><td>Hide malicious content from discovery</td><td>Presentation only, does not delete blockchain data</td></tr><tr><td>Pause factory deployment</td><td>Factory owner</td></tr><tr><td>Manage Nest treasury</td><td>Contract permissions</td></tr><tr><td>Withdraw Nest revenue</td><td>Treasury role</td></tr></table></div></main>`);
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
    await loadDraftCollection();
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
    id: c.id, contractAddress: c.contractAddress || c.deployments?.[0]?.contractAddress || "", name: c.name,
    creator: c.creatorName || "Nest creator", creatorAddress: c.creatorWallet, description: c.description,
    minted: c.mintedSupply || 0, supply: c.maxSupply, price: weiToEth(c.mintPriceWei), mintPriceWei: c.mintPriceWei,
    maxWallet: c.maxPerWallet, maxTx: c.maxPerTransaction || c.maxPerWallet, chainId: c.chainId,
    status: collectionStatusLabel(c.status), canMint: c.status === "LIVE" && Boolean(c.contractAddress || c.deployments?.[0]?.contractAddress),
    chainName: c.chainName, endsIn: mintSchedule(c), deployedAt: "Nest deployment", metadataCid: c.metadataBaseUri || "Metadata pending",
    metadataBaseUri: c.metadataBaseUri || "", contractUri: c.contractUri || "", txHash: c.txHash || c.deployments?.[0]?.txHash || "",
    activity: [], image: ipfsUrl(c.assets?.[0]?.ipfsUri || c.metadataItems?.[0]?.imageUri), art: index % ARTWORK.length
  }));
  await Promise.all(platformCollections.map(async (collection) => {
    try { const activity = await apiRequest("/collections/" + collection.id + "/activity"); collection.activity = activity.items || []; } catch { collection.activity = []; }
  }));
  await loadBuyerNfts();
}

async function loadBuyerNfts() {
  if (!state.walletAddress || state.backend !== "online") { state.buyerNfts = []; return; }
  try { const result = await apiRequest("/wallet/" + state.walletAddress + "/nfts"); state.buyerNfts = result.items || []; }
  catch { state.buyerNfts = []; }
}

async function loadDraftCollection() {
  if (!state.collectionId || state.backend !== "online") return;
  try {
    const collection = await apiRequest("/collections/" + state.collectionId);
    state.metadataBaseUri = collection.metadataBaseUri || "";
    state.contractUri = collection.contractUri || "";
    if (!state.artworkAssets.length && Array.isArray(collection.assets)) {
      state.artworkAssets = collection.assets.filter((asset) => asset.ipfsUri).map((asset) => ({ name: asset.originalFilename, kind: asset.mimeType.startsWith("image/") ? "image" : asset.mimeType.startsWith("video/") ? "video" : "model", previewUrl: ipfsUrl(asset.ipfsUri), ipfsUri: asset.ipfsUri, status: "Pinned to IPFS" }));
    }
  } catch {}
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
    chains: [ACTIVE_NETWORK.chainId],
    optionalChains: [SECONDARY_NETWORK.chainId],
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
  await loadDraftCollection();
  await loadBuyerNfts();
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
    const placeholderWallet = "0xA19f23db9042c36Bf8e2E9353b90a1Ce82D2B8E2";
    ["creatorWallet", "payout", "owner"].forEach((key) => { if (!state.launch[key] || state.launch[key] === placeholderWallet) state.launch[key] = walletAddress; });
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

async function ensureActiveNetwork(provider) {
  const chainId = `0x${ACTIVE_NETWORK.chainId.toString(16)}`;
  if (provider === walletConnectProvider) {
    const connectedChainId = await provider.request({ method: "eth_chainId" });
    if (Number(connectedChainId) !== ACTIVE_NETWORK.chainId) {
      throw new Error(`Select ${ACTIVE_NETWORK.name} in your wallet and reconnect.`);
    }
    return;
  }
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
  } catch (error) {
    if (error.code !== 4902 && !error.message?.includes("Unrecognized chain")) throw error;
    await provider.request({ method: "wallet_addEthereumChain", params: [{
      chainId,
      chainName: ACTIVE_NETWORK.name,
      nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
      rpcUrls: [ACTIVE_NETWORK.rpcUrl],
      blockExplorerUrls: [ACTIVE_NETWORK.explorer]
    }] });
  }
}

async function deployNetworkFactory() {
  if (!state.walletAddress || !activeWalletProvider) {
    state.notice = "Connect the platform owner wallet before deploying the factory.";
    openWalletPicker();
    return;
  }
  state.factoryDeployment.status = "Preparing contract bytecode";
  render();
  try {
    await ensureActiveNetwork(activeWalletProvider);
    const [artifactResponse, viem] = await Promise.all([
      fetch(FACTORY_ARTIFACT_URL, { cache: "no-store" }),
      import(VIEM_PROVIDER_URL)
    ]);
    if (!artifactResponse.ok) throw new Error("Factory artifact could not be loaded.");
    const artifact = await artifactResponse.json();
    const data = viem.encodeDeployData({
      abi: artifact.abi,
      bytecode: artifact.bytecode,
      args: [state.walletAddress, PLATFORM_TREASURY, 500, ACTIVE_FACTORY_VERSION]
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
    state.factoryDeployment.status = `Pending ${ACTIVE_NETWORK.name} confirmation`;
    render();
    const receipt = await waitForTransactionReceipt(activeWalletProvider, txHash);
    if (receipt.status !== "0x1" || !receipt.contractAddress) throw new Error("Factory deployment transaction failed.");
    state.factoryDeployment.contractAddress = receipt.contractAddress;
    state.factoryDeployment.status = `Confirmed on ${ACTIVE_NETWORK.name}`;
    localStorage.setItem(ACTIVE_FACTORY_STORAGE_KEY, receipt.contractAddress);
    state.notice = `Factory deployed. Add the confirmed address to Railway as ${ACTIVE_NETWORK_KEY === "mainnet" ? "FACTORY_MAINNET_ADDRESS" : "FACTORY_TESTNET_ADDRESS"}.`;
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
    maxPerTransaction: Number(state.launch.maxTx),
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
  const selected = [...(files || [])];
  if (!selected.length) return;
  const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "video/mp4", "model/gltf-binary"]);
  const validFiles = selected.filter((file) => {
    const isGlb = file.name.toLowerCase().endsWith(".glb") && (!file.type || file.type === "application/octet-stream");
    return (allowedTypes.has(file.type) || isGlb) && file.size <= 25 * 1024 * 1024;
  });
  const rejectedCount = selected.length - validFiles.length;
  state.artworkAssets.forEach((asset) => { if (asset.previewUrl) URL.revokeObjectURL(asset.previewUrl); });
  state.artworkAssets = validFiles.map((file) => ({
    file,
    name: file.name,
    kind: file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "model",
    previewUrl: file.type.startsWith("image/") || file.type.startsWith("video/") ? URL.createObjectURL(file) : "",
    status: "Ready to upload"
  }));
  state.notice = rejectedCount ? `${validFiles.length} file(s) ready. ${rejectedCount} file(s) rejected because of type or 25 MB size limit.` : `${validFiles.length} artwork file(s) ready for preview.`;
  render();
  if (!validFiles.length) return;
  if (!state.collectionId) await saveDraft(true);
  if (state.backend !== "online" || !state.authToken || !state.collectionId) {
    state.notice = `${validFiles.length} artwork file(s) previewed locally. Connect and sign the wallet to pin them to IPFS.`;
    render();
    return;
  }
  try {
    state.artworkAssets.forEach((asset) => { asset.status = "Uploading to IPFS"; });
    render();
    const form = new FormData();
    form.append("collectionId", state.collectionId);
    validFiles.forEach((file) => form.append("file", file, file.name));
    const result = await apiRequest("/storage/artwork", { method: "POST", body: form });
    state.artworkAssets = state.artworkAssets.map((asset, index) => ({ ...asset, ipfsUri: result.assets?.[index]?.ipfsUri || "", status: result.assets?.[index]?.ipfsUri ? "Pinned to IPFS" : "Uploaded" }));
    state.notice = `${result.assets?.length || validFiles.length} artwork file(s) uploaded and pinned to IPFS.`;
  } catch (error) {
    state.artworkAssets.forEach((asset) => { asset.status = "Upload failed - retry after reconnecting"; });
    state.notice = `Artwork upload failed: ${error.message}`;
  }
  render();
}

async function generateMetadata() {
  const assets = state.artworkAssets.filter((asset) => asset.ipfsUri);
  if (!assets.length) { state.notice = "Upload artwork to IPFS before generating metadata."; render(); return false; }
  if (!state.collectionId && !(await saveDraft(true))) { state.notice = "Save the collection draft before generating metadata."; render(); return false; }
  const supply = Number(state.launch.supply);
  if (!Number.isInteger(supply) || supply < 1 || supply > 10000) { state.notice = "Supply must be between 1 and 10,000 for this release."; render(); return false; }
  const traitType = document.getElementById("metadataTraitType")?.value || "Background";
  const traitValue = document.getElementById("metadataTraitValue")?.value || "Default";
  state.notice = "Generating and pinning " + supply + " metadata file(s)..."; render();
  try {
    const items = Array.from({ length: supply }, (_, index) => { const tokenId = index + 1; const asset = assets[index % assets.length]; return { tokenId, name: state.launch.name + " #" + tokenId, description: state.launch.description, image: asset.ipfsUri, attributes: [{ trait_type: traitType, value: traitValue }] }; });
    const result = await apiRequest("/storage/metadata", { method: "POST", body: JSON.stringify({ collectionId: state.collectionId, externalUrl: state.launch.website || undefined, items }) });
    state.metadataBaseUri = result.metadataBaseUri; state.contractUri = result.contractUri;
    state.notice = result.count + " metadata file(s) pinned. Collection is ready to deploy."; render(); return true;
  } catch (error) { state.notice = "Metadata generation failed: " + error.message; render(); return false; }
}

async function runReadiness(silent = false) {
  try {
    const checks = [
      [state.backend === "online", "Backend is offline"], [Boolean(state.walletAddress && activeWalletProvider), "Connect a wallet"],
      [Boolean(state.authToken), "Sign the wallet login message"], [Boolean(state.collectionId), "Save the collection draft"],
      [state.artworkAssets.some((asset) => asset.ipfsUri), "Upload artwork to IPFS"],
      [Boolean(state.metadataBaseUri && state.contractUri), "Generate metadata"],
      [/^0x[a-fA-F0-9]{40}$/.test(state.launch.payout || ""), "Enter a valid payout wallet"]
    ];
    const failed = checks.find(([ok]) => !ok); if (failed) throw new Error(failed[1]);
    await ensureActiveNetwork(activeWalletProvider);
    const balanceHex = await activeWalletProvider.request({ method: "eth_getBalance", params: [state.walletAddress, "latest"] });
    if (BigInt(balanceHex) === 0n) throw new Error("Wallet needs ETH for gas");
    state.readiness = "Ready"; state.deploymentState = "All deployment checks passed."; if (!silent) render(); return true;
  } catch (error) { state.readiness = "Action required"; state.deploymentState = error.message; if (!silent) render(); return false; }
}

async function deployCollection() {
  if (!state.walletAddress || !activeWalletProvider) { openWalletPicker(); return; }
  if (!state.metadataBaseUri || !state.contractUri) { const generated = await generateMetadata(); if (!generated) return; }
  if (!(await saveDraft(true)) || !(await runReadiness(true))) { render(); return; }
  try {
    state.deploymentState = "Preparing verified factory transaction"; render();
    const prepared = await apiRequest("/deployments/prepare", { method: "POST", body: JSON.stringify({ collectionId: state.collectionId }) });
    const tx = prepared.transactionRequest;
    state.deploymentState = "Waiting for wallet confirmation"; render();
    const txHash = await activeWalletProvider.request({ method: "eth_sendTransaction", params: [{ from: state.walletAddress, to: tx.to, data: tx.data, value: "0x0", gas: "0x" + BigInt(tx.gas).toString(16) }] });
    state.deploymentState = "Transaction submitted: " + txHash; render();
    await apiRequest("/deployments/record", { method: "POST", body: JSON.stringify({ deploymentId: prepared.deployment.id, txHash }) });
    const receipt = await waitForTransactionReceipt(activeWalletProvider, txHash);
    if (receipt.status !== "0x1") throw new Error("Collection deployment reverted");
    const confirmed = await apiRequest("/deployments/confirm", { method: "POST", body: JSON.stringify({ deploymentId: prepared.deployment.id }) });
    state.deploymentState = "Collection live: " + confirmed.collection.contractAddress;
    state.notice = "Collection deployed and verified on " + ACTIVE_NETWORK.name + ".";
    await loadBackendCollections(); state.route = "/mint/" + state.collectionId; location.hash = state.route; render();
  } catch (error) { state.deploymentState = "Deployment failed: " + error.message; render(); }
}

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
async function mintCollection(collectionId) {
  const collection = platformCollections.find((item) => item.id === collectionId);
  if (!collection?.canMint || !collection.contractAddress) { state.mintState = "Mint is not live."; render(); return; }
  if (!state.walletAddress || !activeWalletProvider) { openWalletPicker(); return; }
  if (!state.authToken) { state.mintState = "Reconnect and sign in before minting."; render(); return; }
  const input = document.getElementById("mint-quantity-" + collectionId);
  const quantity = Number(input?.value || 1);
  const maxQuantity = Math.min(collection.maxWallet, collection.maxTx || collection.maxWallet);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > maxQuantity) { state.mintState = "Choose a quantity between 1 and " + maxQuantity + "."; render(); return; }
  try {
    await ensureActiveNetwork(activeWalletProvider);
    const viem = await import(VIEM_PROVIDER_URL);
    const data = viem.encodeFunctionData({ abi: COLLECTION_MINT_ABI, functionName: "mint", args: [BigInt(quantity)] });
    const totalPaid = BigInt(collection.mintPriceWei) * BigInt(quantity);
    const tx = { from: state.walletAddress, to: collection.contractAddress, data, value: "0x" + totalPaid.toString(16) };
    state.mintState = "Checking gas and contract state..."; render();
    tx.gas = await activeWalletProvider.request({ method: "eth_estimateGas", params: [tx] });
    state.mintState = "Confirm the mint in your wallet."; render();
    const txHash = await activeWalletProvider.request({ method: "eth_sendTransaction", params: [tx] });
    state.mintState = "Mint submitted. Waiting for confirmation..."; render();
    const recorded = await apiRequest("/mints/record", { method: "POST", body: JSON.stringify({ collectionId, quantity, txHash, totalPaidWei: totalPaid.toString() }) });
    const receipt = await waitForTransactionReceipt(activeWalletProvider, txHash);
    if (receipt.status !== "0x1") throw new Error("Mint transaction reverted");
    const confirmed = await apiRequest("/mints/confirm", { method: "POST", body: JSON.stringify({ mintId: recorded.id }) });
    state.lastMint = { collectionId, txHash, tokenIds: confirmed.tokenIds || [] };
    state.mintState = "Mint confirmed and ownership recorded.";
    await loadBackendCollections(); render();
  } catch (error) { state.mintState = "Mint failed: " + error.message; render(); }
}

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

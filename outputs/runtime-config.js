// Keep testnet enabled until the hosted application passes wallet, deploy, mint, and indexing checks.
// Mainnet requires both values below to change together.
window.NEST_RUNTIME_CONFIG = {
  network: "testnet",
  confirmMainnetDeployment: false
};

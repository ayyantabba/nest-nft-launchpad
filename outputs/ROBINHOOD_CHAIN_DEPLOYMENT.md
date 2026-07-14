# Robinhood Chain Deployment

## Testnet

- Network name: Robinhood Chain Testnet
- Chain ID: `46630`
- Currency: `ETH`
- RPC: `https://rpc.testnet.chain.robinhood.com`
- Explorer: `https://explorer.testnet.chain.robinhood.com`

## Mainnet

- Network name: Robinhood Chain
- Chain ID: `4663`
- Currency: `ETH`
- RPC: `https://rpc.mainnet.chain.robinhood.com`
- Explorer: `https://robinhoodchain.blockscout.com`

## Wallet Setup

Use `wallet_addEthereumChain` if the chain is missing and `wallet_switchEthereumChain` if the wallet is on an unsupported network.

Before deployment, validate:

- wallet connected
- correct Robinhood Chain network
- connected address valid
- enough ETH for gas
- artwork and metadata uploaded
- metadata CIDs verified
- collection settings valid

## Deployment Order

1. Run Foundry tests.
2. Deploy locally on Anvil.
3. Deploy to Robinhood Chain Testnet.
4. Verify the contract on the explorer.
5. Mint from a second wallet.
6. Confirm tokenURI and contractURI resolve.
7. Prepare mainnet instructions.

Do not execute mainnet deployment automatically.

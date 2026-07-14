# Security

## Controls

- never store private keys
- never ask users to paste seed phrases
- keep IPFS API credentials server-side
- rate-limit upload and metadata endpoints
- validate file content, MIME type, extension, dimensions, size, and count
- sanitize names and descriptions
- protect against stored XSS
- validate external URLs and block `javascript:` URLs
- use secure headers and a wallet-compatible CSP
- verify connected-wallet ownership with signed nonces
- expire nonces
- protect admin routes server-side
- validate contract addresses and chain ID before transactions
- prevent duplicate deployment submissions with idempotency keys
- do not expose secrets through `NEXT_PUBLIC`
- simulate transactions before sending where supported
- decode contract custom errors

## Mainnet Warning

Smart-contract deployment is permanent. Review supply, mint price, payout wallet, metadata, and ownership before confirming.

## Admin Safety

Admin controls must read authorization from contract ownership or explicit server-side authorization. Hiding a collection from platform discovery does not remove it from the blockchain.

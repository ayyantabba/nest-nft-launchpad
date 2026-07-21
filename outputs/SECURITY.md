# Security

## Controls

- never store private keys
- never ask users to paste seed phrases
- keep IPFS API credentials server-side
- rate-limit upload and metadata endpoints
- validate file content, MIME type, extension, dimensions, size, and count
- sanitize names and descriptions server-side (reject HTML/control characters)
- escape all untrusted strings at frontend render time (`escapeHtml` / `escapeAttr` / `displayText`)
- protect against stored XSS (blocker for production users)
- validate external URLs and block `javascript:` URLs
- use secure headers and CSP on both API (Helmet) and Vercel frontend
- verify connected-wallet ownership with signed nonces
- expire nonces; JWT lifetime 12h; httpOnly `nest_session` cookie + in-memory bearer (not localStorage)
- protect admin routes server-side
- validate contract addresses and chain ID before transactions
- prevent duplicate deployment submissions with idempotency keys
- do not expose secrets through `NEXT_PUBLIC`
- simulate transactions before sending where supported
- decode contract custom errors
- separate accrued vs settled revenue; never treat nestFeeAmountWei as cash received
- attach errorId on API errors for ops correlation

## Mainnet Warning

Smart-contract deployment is permanent. Review supply, mint price, payout wallet, metadata, and ownership before confirming. See `AUDIT_CHECKLIST.md` for the independent contract-audit gate.

## Admin Safety

Admin controls must read authorization from contract ownership or explicit server-side authorization. Hiding a collection from platform discovery does not remove it from the blockchain.

# Push Nest to GitHub

## 1. Install prerequisites

Run PowerShell as Administrator:

```powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\install-prerequisites.ps1
```

Restart Windows if Docker Desktop requests it. Open Docker Desktop once and wait until the engine is running.

## 2. Start and test the complete stack

```powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\setup-local.ps1
PowerShell -ExecutionPolicy Bypass -File .\scripts\start-local.ps1
```

Confirm the frontend opens at `http://127.0.0.1:4178` and `http://127.0.0.1:8787/health` returns `status: ok`.

## 3. Create an empty GitHub repository

Create a private repository named `nest` on GitHub. Do not initialize it with a README, license, or `.gitignore` because those files already exist here.

## 4. Commit and push

Replace `YOUR_GITHUB_USERNAME` below:

```powershell
git init
git add .
git status
git commit -m "Initial Nest NFT launchpad"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/nest.git
git push -u origin main
```

The unused 234 MB legacy model, local dependencies, `.env`, database volume, caches, and generated ZIP files are excluded automatically.

## 5. Host it

For Railway or Render, deploy `outputs/backend` as the API and use a managed PostgreSQL database. Apply the environment variables from `.env.example`. Host the static `outputs` directory separately, then set `APP_ORIGIN` to that frontend domain.

Before mainnet, replace deployment placeholder calldata with the audited factory ABI, configure multisig treasury/factory addresses, run the full testnet rehearsal, and complete the requirements in the backend PRD.

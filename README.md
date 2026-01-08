# Zero Gravity INFT Viewer

Simple React + Vite app that:
- Connects via WalletConnect (no injected MetaMask required).
- Requests a signature from the connected wallet and derives a 32-byte AES key (SHA-256 of the signature).
- Fetches a base64 payload for the provided storage CID (prefers 0G SDK if available, otherwise uses a configured HTTP gateway).
- Expects payload to be base64 of (12-byte IV || AES-GCM ciphertext), decrypts with derived key, and saves the plaintext file locally.

Quick start (local)
1. Clone this repo (or add these files to `cloudfo20/Zero-Gravity`).
2. Install:
   - npm install
3. Dev:
   - npm run dev
   - Open http://localhost:5173
4. Build:
   - npm run build
   - npm run preview

Configuration & notes
- OWNER address is pre-set in `src/App.tsx` to your provided wallet (0x6F4D82...).
- Token list is pre-filled with the tokens you gave. If you have additional tokens, add them to the `TOKENS` array in `src/App.tsx`.
- STORAGE_GATEWAY: set the fallback HTTP gateway in the UI or in `src/App.tsx` (DEFAULT_STORAGE_GATEWAY). The gateway must return a base64-encoded string of the encrypted payload for a given CID (or you can install & configure the @0glabs/0g-ts-sdk and expose a `download(cid)` method).
- Encryption format expected: base64( IV (12 bytes) || ciphertext ). IV is 12 bytes required for AES-GCM.

Using the 0G SDK
- If you prefer the app to use the 0G TypeScript SDK to download content by CID, install `@0glabs/0g-ts-sdk` and ensure it exposes a `download(cid)` function (this code attempts a dynamic import and common shapes).
- Alternatively, provide a HTTP gateway URL that serves the base64 encrypted payload for a given hex CID.

WalletConnect
- This project uses `@walletconnect/web3-provider` (v1) for a simple Web QR experience.
- If you want WalletConnect v2 (recommended long-term), we can switch to a v2 web modal and add your Project ID. You said you can add the Project ID later — I can update the app to accept a projectId if you want.

If anything doesn't match how your files are stored (for example: files stored as raw encrypted bytes or the symmetric key is stored separately), tell me the exact storage & encryption layout and I will adapt the fetch/decrypt logic.

Next steps I can take (pick one)
- I can push these files to a branch in `cloudfo20/Zero-Gravity` and open a PR for you (I have admin permission per your message). Say "push" and I will create a branch and commit all files.
- Or you can upload these files yourself and tell me when they are live; then I can test the flow and adjust (e.g., tweak storage fetch, integrate 0g SDK direct download).
- If you want WalletConnect v2 instead, say so and provide a Project ID (or I can scaffold with a placeholder and you insert it later).

Security reminder
- The app performs client-side decryption using a key derived from a wallet signature. Keep private keys and wallet apps secure; anyone who can sign with the owner's private key can decrypt the files.
- If you want stronger access control or audit logging, we should add a backend (optional).

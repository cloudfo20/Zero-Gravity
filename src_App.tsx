import React, { useState } from 'react'
import WalletConnectProvider from "@walletconnect/web3-provider"
import { ethers } from "ethers"

/**
 * CONFIG
 * - OWNER_ADDRESS: the address that owns the tokens (your paradigm.0g wallet).
 * - RPCS: RPC endpoints for 0G mainnet and Galileo testnet (used by WalletConnect provider).
 * - TOKENS: pre-filled token list (tokenId, name, storageCid, fileName).
 * - STORAGE_GATEWAY: fallback HTTP gateway to fetch base64 content by CID (if 0g SDK is not used).
 */
const OWNER_ADDRESS = "0x6F4D829488686afd8D9B68AE56986C312784C0e6".toLowerCase()

const RPCS: Record<number, string> = {
  16661: "https://evmrpc.0g.ai", // 0G mainnet
  16602: "https://evmrpc-testnet.0g.ai" // galileo/testnet
}

// Pre-filled tokens from the data you gave. storageCid values are the Storage CID trait values.
// IMPORTANT: ensure these CIDs point to base64-encoded encrypted payloads (iv||ciphertext) or adjust fetch/decrypt accordingly.
const TOKENS = [
  {
    tokenId: "0x4884f459...01",
    name: "DARA Research Passport #1 (test)",
    storageCid: "", // token 1 had `encryptedURI: "test"` — not available; leave blank or fill later
    fileName: "unknown.txt"
  },
  {
    tokenId: "0x4884f459...02",
    name: "DARA Research Passport #2",
    storageCid: "0xda25a5f5ea40e210db8a662801647b655dd2d1030ab89285441c74ced13e2945",
    fileName: "restoreCode.bat"
  },
  {
    tokenId: "0x4884f459...03",
    name: "DARA Research Passport #3",
    storageCid: "0xbf02c1cab5034303eccda34e461e0f65c3277c217023979ca1901f57ce6ba6b0",
    fileName: "0g research.txt"
  },
  {
    tokenId: "0x4884f459...04",
    name: "DARA Research Passport #4",
    storageCid: "0x175dce81758f5c91c49fb8a0c4af35653bdf92fc21a02daf53adcc3004c0b57c",
    fileName: "Renewable Energy.txt"
  }
]

// Fallback HTTP gateway — set this to a working gateway that can serve the content for your storage CIDs.
// Example: if you have an HTTP endpoint that serves base64 payload by hex-CID: `${STORAGE_GATEWAY}${cid}`
const DEFAULT_STORAGE_GATEWAY = "" // <-- set to your gateway URL if 0g SDK not used

// Helper: convert hex-prefixed 0x... cid to normalized string (strip 0x)
function normalizeCid(cid: string) {
  if (!cid) return cid
  return cid.startsWith("0x") ? cid.slice(2) : cid
}

export default function App() {
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null)
  const [provider, setProvider] = useState<any | null>(null)
  const [signer, setSigner] = useState<any | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [storageGateway, setStorageGateway] = useState<string>(DEFAULT_STORAGE_GATEWAY)

  function addLog(msg: string) {
    setLogs(l => [new Date().toLocaleTimeString() + " — " + msg, ...l].slice(0, 200))
  }

  async function connectWalletConnect() {
    try {
      addLog("Opening WalletConnect...")
      const wcProvider = new WalletConnectProvider({
        rpc: RPCS,
        // infuraId: undefined, // not using Infura
        qrcode: true
      })

      // Enable session (triggers QR Code modal)
      await wcProvider.enable()

      const web3Provider = new ethers.providers.Web3Provider(wcProvider as any)
      const signerLocal = web3Provider.getSigner()
      const addr = (await signerLocal.getAddress()).toLowerCase()

      setProvider(wcProvider)
      setSigner(signerLocal)
      setConnectedAddress(addr)
      addLog("Connected: " + addr)
    } catch (err: any) {
      console.error(err)
      addLog("Connection failed: " + (err?.message ?? String(err)))
    }
  }

  async function disconnect() {
    if (provider && provider.disconnect) {
      try { await provider.disconnect() } catch {}
    }
    setProvider(null)
    setSigner(null)
    setConnectedAddress(null)
    addLog("Disconnected")
  }

  // Try to use 0g SDK if available. This is a placeholder attempt; if you install @0glabs/0g-ts-sdk
  // and it exposes a client with a `download(cid)` method, this will try to use it and fallback to gateway.
  async function fetchCidBase64(cid: string): Promise<string> {
    addLog("Fetching CID: " + cid)
    // Attempt dynamic import of the 0g SDK (optional)
    try {
      // Try global object first (if you add the SDK to the page)
      // @ts-ignore
      if ((window as any).OGStorage && typeof (window as any).OGStorage.download === "function") {
        // @ts-ignore
        const b64 = await (window as any).OGStorage.download(cid)
        addLog("Fetched via global OGStorage")
        return b64
      }

      // Try dynamic import (if installed via npm and built)
      // NOTE: We don't assume exact API shape; if you install the SDK, ensure there's a download method.
      try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const mod = await import('@0glabs/0g-ts-sdk')
        // Try common export shapes
        if (mod && typeof mod.download === "function") {
          const b64 = await mod.download(cid)
          addLog("Fetched via @0glabs/0g-ts-sdk.download")
          return b64
        } else if (mod && typeof mod.StorageClient === "function") {
          // placeholder: if SDK exposes StorageClient, user will have to configure it
          addLog("0g SDK loaded but no known download method found. Falling back to gateway.")
        }
      } catch (e) {
        // dynamic import failed or package not installed in this environment — fallback
      }

      // Fallback to HTTP gateway
      if (!storageGateway) throw new Error("No storage gateway configured and 0g SDK not available.")
      const normalized = normalizeCid(cid)
      const url = storageGateway.endsWith("/") ? storageGateway + normalized : storageGateway + "/" + normalized
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Gateway fetch failed: ${res.status}`)
      // Expecting plain base64 string in body
      const text = await res.text()
      addLog("Fetched via HTTP gateway")
      return text.trim()
    } catch (err: any) {
      addLog("Fetch error: " + (err?.message ?? String(err)))
      throw err
    }
  }

  // Convert base64 string to Uint8Array
  function base64ToBytes(base64: string): Uint8Array {
    if (typeof window === "undefined") throw new Error("Browser required")
    const binaryString = window.atob(base64)
    const len = binaryString.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes
  }

  // Derive a 32-byte AES key from signature (sha-256 of signature)
  async function deriveKeyFromSignature(signature: string): Promise<CryptoKey> {
    const enc = new TextEncoder()
    const sigBytes = enc.encode(signature)
    const hash = await crypto.subtle.digest("SHA-256", sigBytes)
    const key = await crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["decrypt"])
    return key
  }

  // Decrypt base64 blob (assumes iv is first 12 bytes)
  async function decryptBase64Payload(base64: string, key: CryptoKey): Promise<Uint8Array> {
    const bytes = base64ToBytes(base64)
    if (bytes.length <= 12) throw new Error("Payload too short")
    const iv = bytes.slice(0, 12)
    const ciphertext = bytes.slice(12)
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, ciphertext)
    return new Uint8Array(plain)
  }

  // Main: sign a challenge, derive key, fetch CID, decrypt and download
  async function handleDownload(token: { tokenId: string; storageCid: string; fileName: string }) {
    if (!signer || !connectedAddress) {
      addLog("Connect wallet first")
      return
    }

    if (connectedAddress.toLowerCase() !== OWNER_ADDRESS) {
      addLog("Connected address does not match owner — download not allowed")
      return
    }

    if (!token.storageCid) {
      addLog("No storage CID for this token. Fill it in code or metadata.")
      return
    }

    try {
      const challenge = `0g-download:${token.tokenId}:${Date.now()}`
      addLog("Signing challenge...")
      const signature = await signer.signMessage(challenge)
      addLog("Signature obtained. Deriving key...")
      const key = await deriveKeyFromSignature(signature)
      addLog("Fetching encrypted payload (base64)...")
      const b64 = await fetchCidBase64(token.storageCid)
      addLog("Decrypting...")
      const plainBytes = await decryptBase64Payload(b64, key)

      // Save file
      const blob = new Blob([plainBytes], { type: "application/octet-stream" })
      const url = URL.createObjectURL(blob)

      const a = document.createElement("a")
      a.href = url
      a.download = token.fileName || "download.bin"
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      addLog("Download complete: " + token.fileName)
    } catch (err: any) {
      console.error(err)
      addLog("Download/decrypt failed: " + (err?.message ?? String(err)))
    }
  }

  return (
    <div className="container">
      <header>
        <h1>Zero Gravity INFT Viewer</h1>
        <p className="muted">Connect with WalletConnect, sign to derive decryption key, fetch & decrypt the file client-side.</p>
      </header>

      <section className="controls">
        <div>
          <label>Storage gateway (fallback if 0g SDK not available)</label>
          <input value={storageGateway} onChange={e => setStorageGateway(e.target.value)} placeholder="https://my-gateway.example/cid/" />
        </div>

        <div className="buttons">
          {!connectedAddress ? (
            <button onClick={connectWalletConnect}>Connect wallet (WalletConnect)</button>
          ) : (
            <div>
              <div className="connected">Connected: {connectedAddress}</div>
              <button onClick={disconnect}>Disconnect</button>
            </div>
          )}
        </div>

        <div className="info">
          <div>Owner address (allowed to download): <strong>{OWNER_ADDRESS}</strong></div>
        </div>
      </section>

      <section className="tokens">
        <h2>Your INFTs</h2>
        <div className="grid">
          {TOKENS.map((t, i) => {
            const allowed = connectedAddress && connectedAddress.toLowerCase() === OWNER_ADDRESS
            return (
              <div className="card" key={i}>
                <h3>{t.name}</h3>
                <p className="small">Token ID: {t.tokenId}</p>
                <p className="small">Storage CID: {t.storageCid || <em>missing</em>}</p>
                <p className="small">File: {t.fileName}</p>
                <div className="card-actions">
                  <button disabled={!allowed || !t.storageCid} onClick={() => handleDownload(t)}>
                    {allowed ? "Download & Decrypt" : "Connect owner wallet to download"}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="log">
        <h3>Log</h3>
        <div className="log-list">
          {logs.map((l, idx) => <div key={idx} className="log-item">{l}</div>)}
        </div>
      </section>

      <footer>
        <small>Notes: If you want the app to fetch directly from the 0G storage layer, install/configure the @0glabs/0g-ts-sdk or set a working STORAGE_GATEWAY above that serves base64 encrypted blobs for the CIDs.</small>
      </footer>
    </div>
  )
}
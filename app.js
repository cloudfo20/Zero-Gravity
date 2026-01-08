// Minimal ERC-721 ABI fragments we'll use
const ERC721_ABI = [
  // Read-only
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  // Optional enumeration
  "function totalSupply() view returns (uint256)",
  "function tokenByIndex(uint256 index) view returns (uint256)"
];

const ipfsGateway = url => {
  if (!url) return url;
  if (url.startsWith("ipfs://")) {
    return url.replace("ipfs://", "https://ipfs.io/ipfs/");
  }
  return url;
};

const $ = id => document.getElementById(id);
const log = msg => { const el = $("log"); el.innerText = `${new Date().toLocaleTimeString()} — ${msg}\n` + el.innerText; }

let provider;
let signer;

async function getProviderFromInputs() {
  const rpcInput = $("rpcUrl").value.trim();
  if (window.ethereum) {
    // Prefer injected wallet so users can sign if needed
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    log("Using injected wallet provider (MetaMask or similar).");
    return provider;
  } else if (rpcInput) {
    provider = new ethers.JsonRpcProvider(rpcInput);
    log("Using RPC provider: " + rpcInput);
    return provider;
  } else {
    throw new Error("No provider: install a wallet or set an RPC URL.");
  }
}

async function connectWallet() {
  if (!window.ethereum) {
    alert("No injected wallet found (MetaMask). Provide an RPC URL for read-only mode or install a wallet.");
    return;
  }
  try {
    await window.ethereum.request({ method: "eth_requestAccounts" });
    await getProviderFromInputs();
    const addr = await signer.getAddress();
    $("ownerAddress").value = addr;
    log("Connected wallet: " + addr);
  } catch (err) {
    console.error(err);
    alert("Wallet connection failed: " + err.message);
  }
}

function createCard(nft) {
  const div = document.createElement("div");
  div.className = "nft-card";
  const imgUrl = nft.image ? ipfsGateway(nft.image) : "";
  div.innerHTML = `
    <div class="media"><img src="${imgUrl}" alt="${nft.name || ''}" onerror="this.src='';this.alt='Image not available'"/></div>
    <div class="meta">
      <h3>${nft.name || 'Untitled'}</h3>
      <p class="id">#${nft.tokenId}</p>
      <p class="desc">${nft.description || ''}</p>
    </div>
  `;
  if (nft.attributes && nft.attributes.length) {
    const attrs = document.createElement("ul");
    attrs.className = "attrs";
    nft.attributes.forEach(a => {
      const li = document.createElement("li");
      li.textContent = (a.trait_type ? a.trait_type + ': ' : '') + (a.value ?? '');
      attrs.appendChild(li);
    });
    div.querySelector(".meta").appendChild(attrs);
  }
  return div;
}

async function fetchMetadata(uri) {
  try {
    const url = ipfsGateway(uri);
    const r = await fetch(url, { mode: "cors" });
    if (!r.ok) throw new Error(`Status ${r.status}`);
    return await r.json();
  } catch (err) {
    console.warn("Failed to fetch metadata", uri, err);
    return null;
  }
}

async function loadOwnerNFTs() {
  try {
    $("nfts").innerHTML = "";
    await getProviderFromInputs();
    const contractAddress = $("contractAddress").value.trim();
    const owner = $("ownerAddress").value.trim();
    if (!contractAddress || !owner) return alert("Provide contract and owner addresses.");

    const contract = new ethers.Contract(contractAddress, ERC721_ABI, provider);

    // balanceOf
    const balanceBn = await contract.balanceOf(owner);
    const balance = Number(balanceBn.toString());
    log(`Owner ${owner} has ${balance} token(s) (reported by contract).`);

    // Try tokenOfOwnerByIndex (ERC721Enumerable)
    const hasEnumerable = typeof contract.tokenOfOwnerByIndex === "function";
    if (!hasEnumerable) log("Contract might not implement tokenOfOwnerByIndex; listing may fail for large collections.");

    for (let i = 0; i < balance; i++) {
      let tokenId;
      try {
        tokenId = await contract.tokenOfOwnerByIndex(owner, i);
      } catch (err) {
        // If tokenOfOwnerByIndex not present, we can't enumerate — bail out
        console.error("tokenOfOwnerByIndex failed:", err);
        log("tokenOfOwnerByIndex failed; collection probably not enumerable. Stop.");
        break;
      }
      tokenId = tokenId.toString();
      log("Found token id: " + tokenId);
      let tokenURI = "";
      try {
        tokenURI = await contract.tokenURI(tokenId);
      } catch (err) {
        console.warn("tokenURI fetch failed for", tokenId, err);
      }
      const meta = await fetchMetadata(tokenURI) || {};
      // sometimes metadata has image or image_url
      const image = meta.image || meta.image_url || "";
      const nft = { tokenId, name: meta.name, description: meta.description, image, attributes: meta.attributes || [] };
      $("nfts").appendChild(createCard(nft));
    }
  } catch (err) {
    console.error(err);
    alert("Error: " + err.message);
  }
}

async function listAllTokens() {
  try {
    $("nfts").innerHTML = "";
    await getProviderFromInputs();
    const contractAddress = $("contractAddress").value.trim();
    if (!contractAddress) return alert("Provide contract address.");

    const contract = new ethers.Contract(contractAddress, ERC721_ABI, provider);

    // Requires totalSupply + tokenByIndex
    const total = Number((await contract.totalSupply()).toString());
    log("Total supply: " + total);
    for (let i = 0; i < total; i++) {
      const tokenId = (await contract.tokenByIndex(i)).toString();
      let tokenURI = "";
      try { tokenURI = await contract.tokenURI(tokenId); } catch (e) { }
      const meta = await fetchMetadata(tokenURI) || {};
      const image = meta.image || meta.image_url || "";
      const nft = { tokenId, name: meta.name, description: meta.description, image, attributes: meta.attributes || [] };
      $("nfts").appendChild(createCard(nft));
    }
  } catch (err) {
    console.error(err);
    alert("Error: " + err.message);
  }
}

// Wire UI
$("connectWallet").addEventListener("click", connectWallet);
$("loadOwner").addEventListener("click", loadOwnerNFTs);
$("loadAll").addEventListener("click", listAllTokens);
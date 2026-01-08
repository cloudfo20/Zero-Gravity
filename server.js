// Simple Express proxy to fetch IPFS content through a gateway to avoid some CORS issues.
// WARNING: This is a minimal example and not production-ready. Use caching and rate-limiting in production.
const express = require('express');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;
const GATEWAY = process.env.IPFS_GATEWAY || "https://ipfs.io/ipfs/";

app.get('/ipfs/:cid', async (req, res) => {
  try {
    const cid = req.params.cid;
    const url = GATEWAY + cid;
    const r = await fetch(url);
    const body = await r.buffer();
    res.set('content-type', r.headers.get('content-type') || 'application/octet-stream');
    res.send(body);
  } catch (err) {
    res.status(500).send('Proxy error');
  }
});

app.listen(PORT, () => console.log(`IPFS proxy listening on ${PORT}`));
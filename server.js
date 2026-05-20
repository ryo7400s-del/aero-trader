const express = require('express');
const { ethers } = require('ethers');

const app = express();
app.use(express.json());

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const CONTRACT_ADDRESS = "0x348A1649B64c2A2139f458ca86Ef1A098E9E2E4A";

// x402エンドポイント
app.get('/trade', (req, res) => {
  const now = Math.floor(Date.now() / 1000);
  const nonce = ethers.hexlify(ethers.randomBytes(32));

  // 402レスポンスを返す
  res.status(402).json({
    x402Version: 1,
    accepts: [{
      scheme: "exact",
      network: "base-mainnet",
      maxAmountRequired: "1000000",
      resource: "http://localhost:3000/trade",
      description: "1 USDC for Aerodrome swap",
      mimeType: "application/json",
      payTo: CONTRACT_ADDRESS,
      maxTimeoutSeconds: 300,
      asset: USDC,
      extra: {
        validAfter: now - 10,
        validBefore: now + 300,
        nonce: nonce,
      }
    }]
  });
});

// 支払い確認後のエンドポイント
app.post('/trade', (req, res) => {
  const payment = req.headers['x-payment'];
  if (!payment) {
    return res.status(402).json({ error: "payment required" });
  }

  console.log("💳 x402支払い受信:", payment);
  res.json({
    success: true,
    message: "Trade authorized",
    payment: JSON.parse(Buffer.from(payment, 'base64').toString())
  });
});

app.listen(3000, () => {
  console.log("🚀 x402サーバー起動: http://localhost:3000");
});

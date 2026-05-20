const { CdpEvmWalletProvider } = require('@coinbase/agentkit');
const { ethers } = require('ethers');

const CONTRACT_ADDRESS = "0x348A1649B64c2A2139f458ca86Ef1A098E9E2E4A";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const WETH = "0x4200000000000000000000000000000000000006";
const RPC_URL = "https://mainnet.base.org";
const FIXED_ADDRESS = "0xfbc1BdD4726079864fEbc367Fb42FaAe0E314D46";

const TRADER_ABI = [
  "function executeTradeWithX402((address from, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s) payment, (address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOutMin, bool stable, address recipient, uint256 deadline) trade) returns (uint256)",
  "function getQuote(address tokenIn, address tokenOut, uint256 amountIn, bool stable, uint256 slippageBps) view returns (uint256 amountOut, uint256 amountOutMin)",
];

const USDC_ABI = [
  "function nonces(address owner) view returns (uint256)",
];

async function main() {
  const walletProvider = await CdpEvmWalletProvider.configureWithWallet({
    apiKeyId:     process.env.CDP_API_KEY_ID,
    apiKeySecret: process.env.CDP_API_KEY_SECRET,
    walletSecret: process.env.CDP_WALLET_SECRET,
    networkId:    "base-mainnet",
    address:      FIXED_ADDRESS,
  });

  console.log("🤖 Agent:", FIXED_ADDRESS);

  // 1. x402サーバーに問い合わせ
  console.log("\n📡 x402サーバーに問い合わせ中...");
  const res = await fetch("http://localhost:3000/trade");
  const x402 = await res.json();
  const paymentInfo = x402.accepts[0];
  console.log("✅ 402レスポンス受信");

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, TRADER_ABI, provider);

  // 2. 見積もり取得
  const [, amountOutMin] = await contract.getQuote(
    USDC, WETH, 1000000n, false, 300n
  );

  // 3. EIP-3009署名作成
  console.log("\n✍️ EIP-3009署名作成中...");
  const domain = {
    name: "USD Coin",
    version: "2",
    chainId: 8453,
    verifyingContract: USDC,
  };
  const types = {
    ReceiveWithAuthorization: [
      { name: "from",        type: "address" },
      { name: "to",          type: "address" },
      { name: "value",       type: "uint256" },
      { name: "validAfter",  type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce",       type: "bytes32" },
    ],
  };
  const message = {
    from:        FIXED_ADDRESS,
    to:          CONTRACT_ADDRESS,
    value:       1000000n,
    validAfter:  BigInt(paymentInfo.extra.validAfter),
    validBefore: BigInt(paymentInfo.extra.validBefore),
    nonce:       paymentInfo.extra.nonce,
  };

  const signature = await walletProvider.signTypedData({ domain, types, primaryType: "ReceiveWithAuthorization", message });
  const sig = ethers.Signature.from(signature);
  console.log("✅ 署名完了");

  // 4. executeTradeWithX402実行
  console.log("\n🔄 executeTradeWithX402実行中...");
  const iface = new ethers.Interface(TRADER_ABI);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);

  const data = iface.encodeFunctionData("executeTradeWithX402", [
    [
      FIXED_ADDRESS,
      1000000n,
      BigInt(paymentInfo.extra.validAfter),
      BigInt(paymentInfo.extra.validBefore),
      paymentInfo.extra.nonce,
      sig.v,
      sig.r,
      sig.s,
    ],
    [
      USDC,
      WETH,
      1000000n,
      amountOutMin,
      false,
      FIXED_ADDRESS,
      deadline,
    ]
  ]);

  const txHash = await walletProvider.sendTransaction({
    to: CONTRACT_ADDRESS,
    data: data,
  });

  console.log("✅ TX送信:", txHash);
  console.log("🔍 確認:", `https://basescan.org/tx/${txHash}`);
}

main().catch(console.error);

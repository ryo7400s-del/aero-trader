const { CdpEvmWalletProvider } = require('@coinbase/agentkit');
const { ethers } = require('ethers');

const CONTRACT_ADDRESS = "0x348A1649B64c2A2139f458ca86Ef1A098E9E2E4A";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const WETH = "0x4200000000000000000000000000000000000006";
const RPC_URL = "https://mainnet.base.org";
const FIXED_ADDRESS = "0xfbc1BdD4726079864fEbc367Fb42FaAe0E314D46";

const ABI = [
  "function executeTrade((address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOutMin, bool stable, address recipient, uint256 deadline) trade) returns (uint256)",
  "function getQuote(address tokenIn, address tokenOut, uint256 amountIn, bool stable, uint256 slippageBps) view returns (uint256 amountOut, uint256 amountOutMin)",
  "function getBalance(address token) view returns (uint256)"
];

async function main() {
  const walletProvider = await CdpEvmWalletProvider.configureWithWallet({
    apiKeyId:     process.env.CDP_API_KEY_ID,
    apiKeySecret: process.env.CDP_API_KEY_SECRET,
    walletSecret: process.env.CDP_WALLET_SECRET,
    networkId:    "base-mainnet",
    address:      FIXED_ADDRESS,
  });

  const address = await walletProvider.getAddress();
  console.log("🤖 Agent:", address);

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

  // 残高確認
  const balance = await contract.getBalance(USDC);
  console.log("💰 USDC残高:", balance.toString());

  // 見積もり取得
  const [amountOut, amountOutMin] = await contract.getQuote(
    USDC, WETH, 1000000n, false, 300n
  );
  console.log("📊 見積もり WETH:", amountOut.toString());

  // スワップ実行
  console.log("\n🔄 スワップ実行中...");
  const iface = new ethers.Interface(ABI);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);
  const data = iface.encodeFunctionData("executeTrade", [[
    USDC,        // tokenIn
    WETH,        // tokenOut
    1000000n,    // amountIn (1 USDC)
    amountOutMin, // amountOutMin
    false,       // stable
    FIXED_ADDRESS, // recipient
    deadline,    // deadline
  ]]);

  const txHash = await walletProvider.sendTransaction({
    to: CONTRACT_ADDRESS,
    data: data,
  });

  console.log("✅ TX送信:", txHash);
  console.log("🔍 確認:", `https://basescan.org/tx/${txHash}`);
}

main().catch(console.error);

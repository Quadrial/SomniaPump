import { useEffect, useState } from "react";
import axios from "axios";
import { getContract, readContract, prepareContractCall } from "thirdweb";
import { useSendTransaction, useActiveAccount } from "thirdweb/react";
import { client } from "../client";
import { somniaTestnet } from "thirdweb/chains";

type Props = {
  factory: any; // TokenFactory
  router: any; // SomniaRouter
};

/* Helpers */
const parseUnits = (value: string, decimals: number): bigint => {
  const clean = (value || "0").trim();
  if (!clean) return 0n;
  const [w, f = ""] = clean.replace(/,/g, "").split(".");
  const frac = (f + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(w || "0") * 10n ** BigInt(decimals) + BigInt(frac || "0");
};

export default function CreateToken({ factory, router }: Props) {
  // Form
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [decimals, setDecimals] = useState(18);
  const [initialSupply, setInitialSupply] = useState("");
  const [description, setDescription] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [website, setWebsite] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");

  // Liquidity seeding
  const [seedLiquidity, setSeedLiquidity] = useState(true);
  const [seedEth, setSeedEth] = useState("0.1"); // ETH to wrap to WETH
  const [seedTokens, setSeedTokens] = useState("100000");
  const [slippage, setSlippage] = useState(3); // %

  const [status, setStatus] = useState("");
  const { mutateAsync: sendTx, isPending } = useSendTransaction();
  const account = useActiveAccount();

  useEffect(() => {
    if (!imageFile) {
      setImagePreview("");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(imageFile);
  }, [imageFile]);

  const uploadFileToPinata = async (file: File) => {
    const url = "https://api.pinata.cloud/pinning/pinFileToIPFS";
    const form = new FormData();
    form.append("file", file);

    const apiKey = import.meta.env.VITE_PINATA_API_KEY;
    const secret = import.meta.env.VITE_PINATA_SECRET_API_KEY;
    if (!apiKey || !secret) throw new Error("Missing Pinata API keys");

    const res = await axios.post(url, form, {
      headers: {
        "Content-Type": "multipart/form-data",
        pinata_api_key: apiKey,
        pinata_secret_api_key: secret,
      },
    });
    return `https://gateway.pinata.cloud/ipfs/${res.data.IpfsHash}`;
  };

  const handleCreateToken = async () => {
    if (!name || !symbol || !initialSupply || Number(initialSupply) <= 0) {
      setStatus("❌ Please fill in name, symbol, and initial supply.");
      return;
    }
    try {
      setStatus("⏳ Uploading image…");
      let imageUrl = "";
      if (imageFile) imageUrl = await uploadFileToPinata(imageFile);

      const initialSupplyWei = parseUnits(initialSupply, decimals);

      // Create token
      setStatus("📡 Creating token…");
      const createTx = prepareContractCall({
        contract: factory,
        method:
          "function createToken(string name, string symbol, uint8 decimals, uint256 initialSupply, string description, string imageURI, string twitter, string telegram, string website, bool autoRenounce) returns (address)",
        params: [
          name,
          symbol,
          decimals,
          initialSupplyWei,
          description || "",
          imageUrl,
          twitter || "",
          telegram || "",
          website || "",
          true,
        ],
      });
      const receipt = await sendTx(createTx);
      console.log("Create token receipt:", receipt);

      // discover new token address from factory list (last item)
      setStatus("🔎 Fetching new token address…");
      const total = (await readContract({
        contract: factory,
        method: "function totalTokens() view returns (uint256)",
      })) as bigint;
      const last = total > 0n ? total - 1n : 0n;
      let tokenAddress: string;
      try {
        tokenAddress = (await readContract({
          contract: factory,
          method: "function tokenAt(uint256) view returns (address)",
          params: [last],
        })) as string;
      } catch {
        tokenAddress = (await readContract({
          contract: factory,
          method: "function tokensList(uint256) view returns (address)",
          params: [last],
        })) as string;
      }
      setStatus(`✅ Token created: ${tokenAddress}`);

      if (!seedLiquidity) {
        setStatus((s) => s + " (Skipping liquidity seeding.)");
        return;
      }

      // Need WETH address (read from factory)
      const wethAddr = (await readContract({
        contract: factory,
        method: "function weth() view returns (address)",
      })) as string;

      const weth = getContract({
        client,
        chain: somniaTestnet,
        address: wethAddr,
      });
      const token = getContract({
        client,
        chain: somniaTestnet,
        address: tokenAddress,
      });

      // Desired amounts
      const amountWethDesired = parseUnits(seedEth || "0", 18);
      const amountTokenDesired = parseUnits(seedTokens || "0", decimals);
      if (amountWethDesired <= 0n || amountTokenDesired <= 0n) {
        setStatus("❌ Seed ETH and Seed Tokens must be > 0");
        return;
      }

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 15 * 60);
      const tolerance = BigInt(Math.floor((100 - slippage) * 100));
      const denom = 10000n;
      const amountWethMin = (amountWethDesired * tolerance) / denom;
      const amountTokenMin = (amountTokenDesired * tolerance) / denom;

      // 1) Wrap ETH -> WETH
      setStatus("💧 Wrapping ETH to WETH…");
      await sendTx(
        prepareContractCall({
          contract: weth,
          method: "function deposit() payable",
          params: [],
          value: amountWethDesired,
        })
      );

      // 2) Approve router to spend WETH and the token
      setStatus("✅ Approving router…");
      await sendTx(
        prepareContractCall({
          contract: weth,
          method:
            "function approve(address spender, uint256 amount) returns (bool)",
          params: [router.address, amountWethDesired],
        })
      );
      await sendTx(
        prepareContractCall({
          contract: token,
          method:
            "function approve(address spender, uint256 amount) returns (bool)",
          params: [router.address, amountTokenDesired],
        })
      );

      // 3) Add liquidity on router
      setStatus("🧪 Adding liquidity (sets initial price)…");
      const addLiqTx = prepareContractCall({
        contract: router,
        method:
          "function addLiquidity(address tokenA, address tokenB, uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) returns (uint256 amountA, uint256 amountB, uint256 liquidity)",
        params: [
          wethAddr,
          tokenAddress,
          amountWethDesired,
          amountTokenDesired,
          amountWethMin,
          amountTokenMin,
          account?.address || "",
          deadline,
        ],
      });
      const liqReceipt = await sendTx(addLiqTx);
      console.log("Add liquidity receipt:", liqReceipt);

      setStatus(
        "🎉 Token created and liquidity seeded! Your token now has a price."
      );
    } catch (err: any) {
      console.error(err);
      setStatus(`❌ Error: ${err.message}`);
    }
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10 bg-gradient-to-b from-[#0b1622] to-[#111827] rounded shadow-lg">
      <h2 className="text-3xl font-bold mb-8 text-center text-white">
        Launch your token on Somnia Pump
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Form Section */}
        <div className="lg:col-span-3 space-y-4">
          <input
            className="w-full px-4 py-3 bg-[#0f2430] border border-blue-900 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Token Name (e.g., My Awesome Token)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              className="w-full px-4 py-3 bg-[#0f2430] border border-blue-900 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Token Symbol (e.g., MAT)"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
            />
            <input
              className="w-full px-4 py-3 bg-[#0f2430] border border-blue-900 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              type="number"
              placeholder="Decimals"
              value={decimals}
              onChange={(e) => setDecimals(Number(e.target.value))}
            />
          </div>
          <input
            className="w-full px-4 py-3 bg-[#0f2430] border border-blue-900 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            type="number"
            placeholder="Initial Supply"
            value={initialSupply}
            onChange={(e) => setInitialSupply(e.target.value)}
          />
          <textarea
            className="w-full px-4 py-3 bg-[#0f2430] border border-blue-900 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <input
              className="w-full px-4 py-3 bg-[#0f2430] border border-blue-900 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Twitter URL"
              value={twitter}
              onChange={(e) => setTwitter(e.target.value)}
            />
            <input
              className="w-full px-4 py-3 bg-[#0f2430] border border-blue-900 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Telegram URL"
              value={telegram}
              onChange={(e) => setTelegram(e.target.value)}
            />
            <input
              className="w-full px-4 py-3 bg-[#0f2430] border border-blue-900 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Website URL"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2 bg-[#0f2430] border border-blue-900 rounded-lg p-4">
            <label className="text-sm font-medium text-gray-300">
              Token Logo (optional)
            </label>
            <input
              type="file"
              accept="image/*"
              className="text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-500 file:text-white hover:file:bg-blue-600"
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {/* Seed Liquidity */}
          <div className="mt-6 border-t border-blue-900 pt-6">
            <label className="flex items-center gap-3 text-lg font-semibold">
              <input
                type="checkbox"
                checked={seedLiquidity}
                onChange={(e) => setSeedLiquidity(e.target.checked)}
                className="h-5 w-5 rounded text-blue-500 focus:ring-blue-500 bg-gray-700 border-gray-600"
              />
              Seed Initial Liquidity (Recommended)
            </label>
            <p className="text-sm text-gray-400 mt-1 ml-8">
              This will create a trading pair and set the initial price for your
              token.
            </p>
            {seedLiquidity && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pl-8">
                <input
                  className="w-full px-4 py-3 bg-[#0f2430] border border-blue-900 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Seed ETH (e.g., 0.1)"
                  value={seedEth}
                  onChange={(e) => setSeedEth(e.target.value)}
                />
                <input
                  className="w-full px-4 py-3 bg-[#0f2430] border border-blue-900 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Seed Tokens (e.g., 100000)"
                  value={seedTokens}
                  onChange={(e) => setSeedTokens(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">Slippage</span>
                  <input
                    className="w-full px-4 py-3 bg-[#0f2430] border border-blue-900 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    type="number"
                    min={0}
                    max={50}
                    value={slippage}
                    onChange={(e) => setSlippage(Number(e.target.value))}
                  />
                  <span className="text-sm text-gray-400">%</span>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleCreateToken}
            disabled={isPending}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3 rounded-lg font-semibold text-lg disabled:opacity-50 transition-all duration-300"
          >
            {isPending
              ? "Creating…"
              : seedLiquidity
              ? "Create + Seed Liquidity"
              : "Create Token"}
          </button>

          {status && (
            <p className="text-center mt-4 text-sm text-gray-300">{status}</p>
          )}
        </div>

        {/* Preview Section */}
        <div className="lg:col-span-2 lg:sticky top-24 h-fit">
          <h3 className="text-xl font-bold mb-4 text-center">Live Preview</h3>
          <div className="bg-[#132030] border border-blue-500 rounded-lg p-6 text-white shadow-lg">
            <div className="flex flex-col items-center text-center">
              {imagePreview ? (
                <img
                  src={imagePreview}
                  className="w-28 h-28 rounded-full object-cover border-4 border-blue-500/50 mb-4"
                  alt="Token Preview"
                />
              ) : (
                <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center text-white font-bold text-3xl mb-4">
                  {symbol ? symbol.slice(0, 3).toUpperCase() : "TKN"}
                </div>
              )}
              <div className="font-bold text-2xl">
                {name || "Your Token Name"}
              </div>
              <div className="text-md text-gray-400 mt-1">
                {symbol ? `(${symbol.toUpperCase()})` : "(SYMBOL)"}
              </div>
              <p className="text-sm text-gray-300 mt-4 max-w-md mx-auto">
                {description ||
                  "Your token's short description will appear here. Make it catchy!"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

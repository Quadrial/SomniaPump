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
    <div className="max-w-3xl mx-auto mt-10 p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-center">Create Token</h2>

      {/* Quick preview */}
      <div className="bg-[#132030] border border-blue-500 rounded-lg p-4 text-white">
        <div className="flex justify-between items-start gap-3">
          <div className="flex gap-3 items-start">
            <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg">
              {symbol ? symbol.slice(0, 2).toUpperCase() : "TK"}
            </div>
            <div>
              <div className="font-bold text-lg">
                {name || "Your Token Name"}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {symbol ? `(${symbol.toUpperCase()})` : "(SYMBOL)"}
              </div>
              <p className="text-sm text-gray-300 mt-2 max-w-xl">
                {description || "Short description will appear here."}
              </p>
            </div>
          </div>
          <div>
            {imagePreview ? (
              <img
                src={imagePreview}
                className="w-20 h-20 rounded-md object-cover border"
              />
            ) : (
              <div className="w-20 h-20 rounded-md bg-[#0b1220] border flex items-center justify-center text-gray-500 text-sm">
                Preview
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4 mt-6">
        <input
          className="w-full px-4 py-2 border rounded-lg"
          placeholder="Token Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="w-full px-4 py-2 border rounded-lg"
          placeholder="Token Symbol"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
        />
        <input
          className="w-full px-4 py-2 border rounded-lg"
          type="number"
          placeholder="Decimals"
          value={decimals}
          onChange={(e) => setDecimals(Number(e.target.value))}
        />
        <input
          className="w-full px-4 py-2 border rounded-lg"
          type="number"
          placeholder="Initial Supply"
          value={initialSupply}
          onChange={(e) => setInitialSupply(e.target.value)}
        />
        <textarea
          className="w-full px-4 py-2 border rounded-lg"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            className="w-full px-4 py-2 border rounded-lg"
            placeholder="Twitter URL"
            value={twitter}
            onChange={(e) => setTwitter(e.target.value)}
          />
          <input
            className="w-full px-4 py-2 border rounded-lg"
            placeholder="Telegram URL"
            value={telegram}
            onChange={(e) => setTelegram(e.target.value)}
          />
          <input
            className="w-full px-4 py-2 border rounded-lg"
            placeholder="Website URL"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm">Token Logo (optional)</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
          />
        </div>

        {/* Seed Liquidity */}
        <div className="mt-6 border-t pt-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={seedLiquidity}
              onChange={(e) => setSeedLiquidity(e.target.checked)}
            />
            Seed initial liquidity (sets price)
          </label>
          {seedLiquidity && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
              <input
                className="w-full px-4 py-2 border rounded-lg"
                placeholder="Seed ETH (e.g., 0.1)"
                value={seedEth}
                onChange={(e) => setSeedEth(e.target.value)}
              />
              <input
                className="w-full px-4 py-2 border rounded-lg"
                placeholder="Seed Tokens (e.g., 100000)"
                value={seedTokens}
                onChange={(e) => setSeedTokens(e.target.value)}
              />
              <div className="flex items-center gap-2">
                <span className="text-sm">Slippage %</span>
                <input
                  className="w-full px-4 py-2 border rounded-lg"
                  type="number"
                  min={0}
                  max={50}
                  value={slippage}
                  onChange={(e) => setSlippage(Number(e.target.value))}
                />
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleCreateToken}
          disabled={isPending}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold disabled:opacity-50"
        >
          {isPending
            ? "Creating…"
            : seedLiquidity
            ? "Create + Seed Liquidity"
            : "Create Token"}
        </button>

        {status && <p className="text-center mt-4 text-sm">{status}</p>}
      </div>
    </div>
  );
}
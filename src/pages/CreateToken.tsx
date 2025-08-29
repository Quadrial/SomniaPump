// import React, { useEffect, useState } from "react";
// import axios from "axios";
// import { prepareContractCall } from "thirdweb";
// import { useSendTransaction, useActiveAccount } from "thirdweb/react";
// import { FaTwitter, FaTelegram, FaGlobe } from "react-icons/fa6";

// interface CreateTokenProps {
//   contract: any; // the TokenFactory contract returned by getContract
// }

// export default function CreateToken({ contract }: CreateTokenProps) {
//   /* UI state -------------------------------------------------------------- */
//   const [name, setName] = useState("");
//   const [symbol, setSymbol] = useState("");
//   const [decimals, setDecimals] = useState(18);
//   const [initialSupply, setInitialSupply] = useState("");
//   const [description, setDescription] = useState("");
//   const [twitter, setTwitter] = useState("");
//   const [telegram, setTelegram] = useState("");
//   const [website, setWebsite] = useState("");
//   const [imageFile, setImageFile] = useState<File | null>(null);
//   const [imagePreview, setImagePreview] = useState("");
//   const [status, setStatus] = useState("");

//   /* Hooks ----------------------------------------------------------------- */
//   const { mutateAsync: sendTransaction, isPending } = useSendTransaction();
//   const activeAccount = useActiveAccount();

//   /* Image preview ---------------------------------------------------------- */
//   useEffect(() => {
//     if (!imageFile) {
//       setImagePreview("");
//       return;
//     }
//     const reader = new FileReader();
//     reader.onload = (e) => setImagePreview(e.target?.result as string);
//     reader.readAsDataURL(imageFile);
//   }, [imageFile]);

//   /* Pinata helpers – only upload the image --------------------------------*/
//   const uploadFileToPinata = async (file: File) => {
//     const url = "https://api.pinata.cloud/pinning/pinFileToIPFS";
//     const form = new FormData();
//     form.append("file", file);

//     const apiKey = import.meta.env.VITE_PINATA_API_KEY;
//     const secret = import.meta.env.VITE_PINATA_SECRET_API_KEY;
//     if (!apiKey || !secret) {
//       throw new Error("Pinata API keys are missing. Check your .env file.");
//     }

//     const res = await axios.post(url, form, {
//       headers: {
//         "Content-Type": "multipart/form-data",
//         pinata_api_key: apiKey,
//         pinata_secret_api_key: secret,
//       },
//     });

//     return `https://gateway.pinata.cloud/ipfs/${res.data.IpfsHash}`;
//   };

//   /* Create‑token handler --------------------------------------------------- */
//   const handleCreateToken = async () => {
//     if (!name || !symbol || !initialSupply || Number(initialSupply) <= 0) {
//       setStatus(
//         "❌ Please fill in the required fields (name, symbol, initial supply)."
//       );
//       return;
//     }

//     try {
//       /* 1️⃣ Upload image to Pinata (if any) */
//       setStatus("⏳ Uploading image…");
//       let imageUrl = "";
//       if (imageFile) {
//         imageUrl = await uploadFileToPinata(imageFile);
//         setStatus("📤 Image uploaded");
//       }

//       /* 2️⃣ Convert the initial supply to wei */
//       const initialSupplyWei = BigInt(Number(initialSupply) * 10 ** decimals);

//       /* 3️⃣ Prepare the contract call – new signature with all on‑chain metadata */
//       const transaction = prepareContractCall({
//         contract,
//         method:
//           "function createToken(string name, string symbol, uint8 decimals, uint256 initialSupply, string description, string imageURI, string twitter, string telegram, string website, bool autoRenounce) returns (address)",
//         params: [
//           name,
//           symbol,
//           decimals,
//           initialSupplyWei,
//           description || "",
//           imageUrl,
//           twitter || "",
//           telegram || "",
//           website || "",
//           true, // autoRenounce
//         ],
//       });

//       /* 4️⃣ Send the transaction */
//       setStatus("📡 Sending transaction…");
//       const receipt = await sendTransaction(transaction);

//       /* 5️⃣ Log everything the user entered – post‑transaction */
//       console.log("Token creation data (user input):", {
//         name,
//         symbol,
//         decimals,
//         initialSupply,
//         description,
//         imageUrl,
//         twitter,
//         telegram,
//         website,
//       });
//       console.log("Transaction receipt:", receipt);

//       setStatus(`✅ Token created! Address: ${receipt.transactionHash}`);
//     } catch (err: any) {
//       console.error("❌ Error creating token:", err);
//       setStatus(`❌ Error: ${err.message}`);
//     }
//   };

//   /* Preview card ----------------------------------------------------------- */
//   const PreviewCard = () => (
//     <div className="bg-[#132030] border border-blue-500 rounded-lg p-4">
//       <div className="flex justify-between items-start gap-3">
//         <div className="flex gap-3 items-start">
//           <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg">
//             {symbol ? symbol.slice(0, 2).toUpperCase() : "TK"}
//           </div>
//           <div className="min-w-0">
//             <div className="font-bold text-lg truncate">
//               {name || "Your Token Name"}
//             </div>
//             <div className="text-xs text-gray-400 mt-1">
//               {symbol ? `(${symbol.toUpperCase()})` : "(SYMBOL)"}
//             </div>
//             <p className="text-sm text-gray-400 mt-2 line-clamp-4">
//               {description || "Short description will appear here."}
//             </p>
//           </div>
//         </div>

//         <div className="text-right flex-shrink-0">
//           <div className="text-sm text-gray-400">Owner</div>
//           <div className="text-sm text-blue-400">
//             {activeAccount?.address
//               ? `${activeAccount.address.slice(0, 8)}…`
//               : "Not connected"}
//           </div>
//         </div>
//       </div>

//       <div className="mt-4 flex items-center justify-between gap-4">
//         <div className="text-xs text-gray-400">
//           {activeAccount?.address
//             ? "Owner is connected"
//             : "Connect wallet to see owner"}
//         </div>
//         <div>
//           {imagePreview ? (
//             <img
//               src={imagePreview}
//               alt="preview"
//               className="w-20 h-20 rounded-md object-cover border"
//             />
//           ) : (
//             <div className="w-20 h-20 rounded-md bg-[#0b1220] border flex items-center justify-center text-gray-500 text-sm">
//               Preview
//             </div>
//           )}
//         </div>
//       </div>

//       <div className="mt-4 flex gap-4">
//         {twitter && (
//           <a
//             href={twitter}
//             target="_blank"
//             rel="noopener noreferrer"
//             className="text-blue-400"
//           >
//             <FaTwitter />
//           </a>
//         )}
//         {telegram && (
//           <a
//             href={telegram}
//             target="_blank"
//             rel="noopener noreferrer"
//             className="text-blue-400"
//           >
//             <FaTelegram />
//           </a>
//         )}
//         {website && (
//           <a
//             href={website}
//             target="_blank"
//             rel="noopener noreferrer"
//             className="text-blue-400"
//           >
//             <FaGlobe />
//           </a>
//         )}
//       </div>
//     </div>
//   );

//   /* Render ----------------------------------------------------------------- */
//   if (!contract) {
//     return (
//       <div className="text-center py-4 text-red-400">Contract not ready</div>
//     );
//   }

//   return (
//     <div className="max-w-3xl mx-auto mt-10 p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-lg">
//       <h2 className="text-2xl font-bold mb-6 text-center text-gray-800 dark:text-white">
//         Create Token
//       </h2>

//       <PreviewCard />

//       <div className="space-y-4 mt-6">
//         <input
//           type="text"
//           placeholder="Token Name (max 50 chars)"
//           value={name}
//           onChange={(e) => setName(e.target.value.slice(0, 50))}
//           className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
//         />

//         <input
//           type="text"
//           placeholder="Token Symbol (max 10 chars)"
//           value={symbol}
//           onChange={(e) => setSymbol(e.target.value.slice(0, 10))}
//           className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
//         />

//         <input
//           type="number"
//           placeholder="Decimals (e.g., 18)"
//           value={decimals}
//           onChange={(e) => setDecimals(Number(e.target.value))}
//           className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
//         />

//         <input
//           type="number"
//           placeholder="Initial Supply"
//           value={initialSupply}
//           onChange={(e) => setInitialSupply(e.target.value)}
//           className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
//         />

//         <textarea
//           placeholder="Description"
//           value={description}
//           onChange={(e) => setDescription(e.target.value)}
//           className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
//           rows={3}
//         />

//         <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
//           <input
//             placeholder="Twitter URL"
//             value={twitter}
//             onChange={(e) => setTwitter(e.target.value)}
//             className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
//           />
//           <input
//             placeholder="Telegram URL"
//             value={telegram}
//             onChange={(e) => setTelegram(e.target.value)}
//             className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
//           />
//           <input
//             placeholder="Website URL"
//             value={website}
//             onChange={(e) => setWebsite(e.target.value)}
//             className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
//           />
//         </div>

//         <div className="flex flex-col gap-2">
//           <label className="text-sm font-medium">Token Logo (optional)</label>
//           <input
//             type="file"
//             accept="image/*"
//             onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
//             className="text-sm"
//           />
//           {imageFile && (
//             <p className="text-xs text-gray-500">{imageFile.name}</p>
//           )}
//         </div>

//         <button
//           onClick={handleCreateToken}
//           disabled={isPending}
//           className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold disabled:opacity-50"
//         >
//           {isPending ? "Creating…" : "Create Token"}
//         </button>

//         {status && (
//           <p className="text-center mt-4 text-sm text-gray-700 dark:text-gray-300">
//             {status}
//           </p>
//         )}
//       </div>
//     </div>
//   );
// }

// src/pages/CreateToken.tsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { getContract, readContract, prepareContractCall } from "thirdweb";
import { useSendTransaction, useActiveAccount } from "thirdweb/react";
import { FaTwitter, FaTelegram, FaGlobe } from "react-icons/fa6";
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

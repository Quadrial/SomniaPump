// import { useEffect, useState } from "react";
// import axios from "axios";
// import { getContract, readContract, prepareContractCall } from "thirdweb";
// import { useSendTransaction, useActiveAccount } from "thirdweb/react";
// import { client } from "../client";
// import { somniaTestnet } from "thirdweb/chains";

// type Props = {
//   factory: any; // TokenFactory
//   router: any; // SomniaRouter (UniswapV2-style)
// };

// /* Helpers */
// const parseUnits = (value: string, decimals: number): bigint => {
//   const clean = (value || "0").trim();
//   if (!clean) return 0n;
//   const [w, f = ""] = clean.replace(/,/g, "").split(".");
//   const frac = (f + "0".repeat(decimals)).slice(0, decimals);
//   return BigInt(w || "0") * 10n ** BigInt(decimals) + BigInt(frac || "0");
// };

// export default function CreateToken({ factory, router }: Props) {
//   // Form
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

//   // Liquidity seeding
//   const [seedLiquidity, setSeedLiquidity] = useState(true);
//   const [seedEth, setSeedEth] = useState("0.1");
//   const [seedTokens, setSeedTokens] = useState("100000");
//   const [slippage, setSlippage] = useState(3);

//   const [status, setStatus] = useState("");
//   const { mutateAsync: sendTx, isPending } = useSendTransaction();
//   const account = useActiveAccount();

//   const [lastTokenAddress, setLastTokenAddress] = useState<string>("");

//   useEffect(() => {
//     if (!imageFile) {
//       setImagePreview("");
//       return;
//     }
//     const reader = new FileReader();
//     reader.onload = (e) => setImagePreview(e.target?.result as string);
//     reader.readAsDataURL(imageFile);
//   }, [imageFile]);

//   const uploadFileToPinata = async (file: File) => {
//     const url = "https://api.pinata.cloud/pinning/pinFileToIPFS";
//     const form = new FormData();
//     form.append("file", file);
//     const apiKey = import.meta.env.VITE_PINATA_API_KEY;
//     const secret = import.meta.env.VITE_PINATA_SECRET_API_KEY;
//     if (!apiKey || !secret) throw new Error("Missing Pinata API keys");
//     const res = await axios.post(url, form, {
//       headers: {
//         "Content-Type": "multipart/form-data",
//         pinata_api_key: apiKey,
//         pinata_secret_api_key: secret,
//       },
//     });
//     return `https://gateway.pinata.cloud/ipfs/${res.data.IpfsHash}`;
//   };

//   const handleCreateToken = async () => {
//     // Preflight validations
//     if (!account?.address) {
//       setStatus("❌ Please connect your wallet.");
//       return;
//     }
//     if (!name || !symbol || !initialSupply || Number(initialSupply) <= 0) {
//       setStatus("❌ Please fill in name, symbol, and initial supply.");
//       return;
//     }
//     const initialSupplyWei = parseUnits(initialSupply, decimals);

//     if (seedLiquidity) {
//       const seedTokensWei = parseUnits(seedTokens || "0", decimals);
//       if (seedTokensWei <= 0n) {
//         setStatus("❌ Seed Tokens must be > 0.");
//         return;
//       }
//       if (seedTokensWei > initialSupplyWei) {
//         setStatus("❌ Seed Tokens cannot exceed the initial supply.");
//         return;
//       }
//       const amountWethDesired = parseUnits(seedEth || "0", 18);
//       if (amountWethDesired <= 0n) {
//         setStatus("❌ Seed ETH must be > 0.");
//         return;
//       }
//     }

//     try {
//       setStatus("⏳ Uploading image…");
//       let imageUrl = "";
//       if (imageFile) imageUrl = await uploadFileToPinata(imageFile);

//       // 1) Create token
//       setStatus("🧱 Step 1/4: Creating token… (Confirm in wallet)");
//       const createTx = prepareContractCall({
//         contract: factory,
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
//           true,
//         ],
//       });
//       await sendTx(createTx);

//       // Discover new token address
//       setStatus("🔎 Fetching new token address…");
//       const total = (await readContract({
//         contract: factory,
//         method: "function totalTokens() view returns (uint256)",
//       })) as bigint;
//       const last = total > 0n ? total - 1n : 0n;
//       let tokenAddress: string;
//       try {
//         tokenAddress = (await readContract({
//           contract: factory,
//           method: "function tokenAt(uint256) view returns (address)",
//           params: [last],
//         })) as string;
//       } catch {
//         tokenAddress = (await readContract({
//           contract: factory,
//           method: "function tokensList(uint256) view returns (address)",
//           params: [last],
//         })) as string;
//       }
//       setLastTokenAddress(tokenAddress);
//       setStatus(`✅ Token created: ${tokenAddress}`);

//       if (!seedLiquidity) {
//         setStatus((s) => s + " (Skipping liquidity seeding.)");
//         return;
//       }

//       // 2) Seed Liquidity
//       const wethAddr = (await readContract({
//         contract: factory,
//         method: "function weth() view returns (address)",
//       })) as string;

//       const weth = getContract({
//         client,
//         chain: somniaTestnet,
//         address: wethAddr,
//       });
//       const token = getContract({
//         client,
//         chain: somniaTestnet,
//         address: tokenAddress,
//       });

//       const amountWethDesired = parseUnits(seedEth || "0", 18);
//       const amountTokenDesired = parseUnits(seedTokens || "0", decimals);

//       const deadline = BigInt(Math.floor(Date.now() / 1000) + 15 * 60);
//       const tolerance = BigInt(Math.floor((100 - slippage) * 100)); // bps
//       const denom = 10000n;
//       const amountWethMin = (amountWethDesired * tolerance) / denom;
//       const amountTokenMin = (amountTokenDesired * tolerance) / denom;

//       // 2.1 Wrap ETH -> WETH
//       setStatus("💧 Step 2/4: Wrapping ETH to WETH… (Confirm in wallet)");
//       await sendTx(
//         prepareContractCall({
//           contract: weth,
//           method: "function deposit() payable",
//           params: [],
//           value: amountWethDesired,
//         })
//       );

//       // 2.2 Approve WETH
//       setStatus("✅ Step 3/4: Approving router (WETH)… (Confirm in wallet)");
//       await sendTx(
//         prepareContractCall({
//           contract: weth,
//           method:
//             "function approve(address spender, uint256 amount) returns (bool)",
//           params: [router.address, amountWethDesired],
//         })
//       );

//       // 2.3 Approve Token
//       setStatus("✅ Step 4/4: Approving router (Token)… (Confirm in wallet)");
//       await sendTx(
//         prepareContractCall({
//           contract: token,
//           method:
//             "function approve(address spender, uint256 amount) returns (bool)",
//           params: [router.address, amountTokenDesired],
//         })
//       );

//       // 2.4 Add Liquidity
//       setStatus(
//         "🧪 Adding liquidity (sets initial price)… (Confirm in wallet)"
//       );
//       await sendTx(
//         prepareContractCall({
//           contract: router,
//           method:
//             "function addLiquidity(address tokenA, address tokenB, uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) returns (uint256 amountA, uint256 amountB, uint256 liquidity)",
//           params: [
//             wethAddr,
//             tokenAddress,
//             amountWethDesired,
//             amountTokenDesired,
//             amountWethMin,
//             amountTokenMin,
//             account.address, // ensure not empty
//             deadline,
//           ],
//         })
//       );

//       // 3) Verify price exists
//       setStatus("🔍 Verifying liquidity and price…");
//       let hasPrice = false;
//       try {
//         const out: any = await readContract({
//           contract: router,
//           method:
//             "function getAmountsOut(uint amountIn, address[] path) view returns (uint[] memory amounts)",
//           params: [10n ** 18n, [tokenAddress, wethAddr]], // 1 token if token has 18? Use decimals properly below:
//         }).catch(() => null);

//         // Use correct decimals
//         if (out && Array.isArray(out)) {
//           const outAmounts = (await readContract({
//             contract: router,
//             method:
//               "function getAmountsOut(uint amountIn, address[] path) view returns (uint[] memory amounts)",
//             params: [10n ** BigInt(decimals), [tokenAddress, wethAddr]],
//           })) as bigint[];
//           const wOut = outAmounts[outAmounts.length - 1];
//           hasPrice = wOut > 0n;
//         }
//       } catch {
//         hasPrice = false;
//       }

//       if (hasPrice) {
//         setStatus(
//           "🎉 Token created and liquidity seeded! Your token now has a price."
//         );
//       } else {
//         setStatus(
//           `⚠️ Liquidity transaction completed, but price could not be verified yet. You can retry seeding liquidity for ${tokenAddress} if needed.`
//         );
//       }
//     } catch (err: any) {
//       console.error(err);
//       // At this point, if we already created the token but a later step failed:
//       if (lastTokenAddress) {
//         setStatus(
//           `❌ A step failed after token creation. Token exists at ${lastTokenAddress}, but liquidity was not added. You can retry adding liquidity from the token page. Error: ${err.message}`
//         );
//       } else {
//         setStatus(`❌ Error: ${err.message}`);
//       }
//     }
//   };

//   return (
//     <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10 bg-gradient-to-b from-[#0b1622] to-[#111827] rounded shadow-lg">
//       <h2 className="text-3xl font-bold mb-8 text-center text-white">
//         Launch your token on Somnia Pump
//       </h2>

//       <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
//         {/* Form Section */}
//         <div className="lg:col-span-3 space-y-4">
//           <input
//             className="w-full px-4 py-3 bg-[#0f2430] border border-blue-900 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
//             placeholder="Token Name"
//             value={name}
//             onChange={(e) => setName(e.target.value)}
//           />
//           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//             <input
//               className="w-full px-4 py-3 bg-[#0f2430] border border-blue-900 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
//               placeholder="Token Symbol"
//               value={symbol}
//               onChange={(e) => setSymbol(e.target.value)}
//             />
//             <input
//               className="w-full px-4 py-3 bg-[#0f2430] border border-blue-900 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
//               type="number"
//               placeholder="Decimals"
//               value={decimals}
//               onChange={(e) => setDecimals(Number(e.target.value))}
//             />
//           </div>
//           <input
//             className="w-full px-4 py-3 bg-[#0f2430] border border-blue-900 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
//             type="number"
//             placeholder="Initial Supply"
//             value={initialSupply}
//             onChange={(e) => setInitialSupply(e.target.value)}
//           />
//           <textarea
//             className="w-full px-4 py-3 bg-[#0f2430] border border-blue-900 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
//             placeholder="Description"
//             value={description}
//             onChange={(e) => setDescription(e.target.value)}
//             rows={4}
//           />
//           <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
//             <input
//               className="w-full px-4 py-3 bg-[#0f2430] border border-blue-900 rounded-lg text-white"
//               placeholder="Twitter URL"
//               value={twitter}
//               onChange={(e) => setTwitter(e.target.value)}
//             />
//             <input
//               className="w-full px-4 py-3 bg-[#0f2430] border border-blue-900 rounded-lg text-white"
//               placeholder="Telegram URL"
//               value={telegram}
//               onChange={(e) => setTelegram(e.target.value)}
//             />
//             <input
//               className="w-full px-4 py-3 bg-[#0f2430] border border-blue-900 rounded-lg text-white"
//               placeholder="Website URL"
//               value={website}
//               onChange={(e) => setWebsite(e.target.value)}
//             />
//           </div>
//           <div className="flex flex-col gap-2 bg-[#0f2430] border border-blue-900 rounded-lg p-4">
//             <label className="text-sm font-medium text-gray-300">
//               Token Logo (optional)
//             </label>
//             <input
//               type="file"
//               accept="image/*"
//               className="text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-500 file:text-white hover:file:bg-blue-600"
//               onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
//             />
//           </div>

//           {/* Seed Liquidity */}
//           <div className="mt-6 border-t border-blue-900 pt-6">
//             <label className="flex items-center gap-3 text-lg font-semibold">
//               <input
//                 type="checkbox"
//                 checked={seedLiquidity}
//                 onChange={(e) => setSeedLiquidity(e.target.checked)}
//                 className="h-5 w-5 rounded text-blue-500 focus:ring-blue-500 bg-gray-700 border-gray-600"
//               />
//               Seed Initial Liquidity (Recommended)
//             </label>
//             <p className="text-sm text-gray-400 mt-1 ml-8">
//               This creates a trading pair and sets the initial price for your
//               token.
//             </p>
//             {seedLiquidity && (
//               <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pl-8">
//                 <input
//                   className="w-full px-4 py-3 bg-[#0f2430] border border-blue-900 rounded-lg text-white"
//                   placeholder="Seed ETH (e.g., 0.1)"
//                   value={seedEth}
//                   onChange={(e) => setSeedEth(e.target.value)}
//                 />
//                 <input
//                   className="w-full px-4 py-3 bg-[#0f2430] border border-blue-900 rounded-lg text-white"
//                   placeholder="Seed Tokens (e.g., 100000)"
//                   value={seedTokens}
//                   onChange={(e) => setSeedTokens(e.target.value)}
//                 />
//                 <div className="flex items-center gap-2">
//                   <span className="text-sm text-gray-400">Slippage</span>
//                   <input
//                     className="w-full px-4 py-3 bg-[#0f2430] border border-blue-900 rounded-lg text-white"
//                     type="number"
//                     min={0}
//                     max={50}
//                     value={slippage}
//                     onChange={(e) => setSlippage(Number(e.target.value))}
//                   />
//                   <span className="text-sm text-gray-400">%</span>
//                 </div>
//               </div>
//             )}
//           </div>

//           <button
//             onClick={handleCreateToken}
//             disabled={isPending}
//             className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3 rounded-lg font-semibold text-lg disabled:opacity-50 transition-all duration-300"
//           >
//             {isPending
//               ? "Processing…"
//               : seedLiquidity
//               ? "Create + Seed Liquidity"
//               : "Create Token"}
//           </button>

//           {status && (
//             <p className="text-center mt-4 text-sm text-gray-300">{status}</p>
//           )}
//         </div>

//         {/* Preview */}
//         <div className="lg:col-span-2 lg:sticky top-24 h-fit">
//           <h3 className="text-xl font-bold mb-4 text-center text-white">
//             Live Preview
//           </h3>
//           <div className="bg-[#132030] border border-blue-500 rounded-lg p-6 text-white shadow-lg">
//             <div className="flex flex-col items-center text-center">
//               {imagePreview ? (
//                 <img
//                   src={imagePreview}
//                   className="w-28 h-28 rounded-full object-cover border-4 border-blue-500/50 mb-4"
//                   alt="Token Preview"
//                 />
//               ) : (
//                 <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center text-white font-bold text-3xl mb-4">
//                   {symbol ? symbol.slice(0, 3).toUpperCase() : "TKN"}
//                 </div>
//               )}
//               <div className="font-bold text-2xl">
//                 {name || "Your Token Name"}
//               </div>
//               <div className="text-md text-gray-400 mt-1">
//                 {symbol ? `(${symbol.toUpperCase()})` : "(SYMBOL)"}
//               </div>
//               <p className="text-sm text-gray-300 mt-4 max-w-md mx-auto">
//                 {description ||
//                   "Your token's short description will appear here."}
//               </p>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

import { useEffect, useState } from "react";
import axios from "axios";
import { getContract, readContract, prepareContractCall } from "thirdweb";
import { useSendTransaction, useActiveAccount } from "thirdweb/react";
import { client } from "../client";
import { somniaTestnet } from "thirdweb/chains";

type Props = {
  factory: any; // TokenFactory
  router: any; // SomniaRouter (UniswapV2-style)
};

/* Helpers */
const parseUnits = (value: string, decimals: number): bigint => {
  const clean = (value || "0").trim();
  if (!clean) return 0n;
  const [w, f = ""] = clean.replace(/,/g, "").split(".");
  const frac = (f + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(w || "0") * 10n ** BigInt(decimals) + BigInt(frac || "0");
};

const buildTweet = (
  baseUrl: string,
  tokenAddress: string,
  name: string,
  symbol: string
) => {
  const safeSymbol = (symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const nameHash = (name || "").replace(/[^A-Za-z0-9]/g, ""); // hashtag friendly
  const tokenPath = `/coin/${tokenAddress}`; // change if your route is different
  const tokenUrl = `${baseUrl}${tokenPath}`;
  const text = `I just launched ${name} (${safeSymbol}) on Somnia Pump! Trade now: ${tokenUrl} #${safeSymbol} #${nameHash} #Somnia #SomniaPump`;
  const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    text
  )}`;
  return { text, intent, tokenUrl };
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
  const [seedEth, setSeedEth] = useState("0.1");
  const [seedTokens, setSeedTokens] = useState("100000");
  const [slippage, setSlippage] = useState(3);

  const [status, setStatus] = useState("");
  const { mutateAsync: sendTx, isPending } = useSendTransaction();
  const account = useActiveAccount();

  const [lastTokenAddress, setLastTokenAddress] = useState<string>("");

  // Share state
  const [tweetText, setTweetText] = useState("");
  const [tweetIntentUrl, setTweetIntentUrl] = useState("");
  const [tokenPublicUrl, setTokenPublicUrl] = useState("");

  const appBaseUrl =
    (import.meta as any)?.env?.VITE_APP_BASE_URL || window.location.origin;

  useEffect(() => {
    if (!imageFile) {
      setImagePreview("");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(imageFile);
  }, [imageFile]);

  // Build share links whenever we have a token address
  useEffect(() => {
    if (lastTokenAddress) {
      const { text, intent, tokenUrl } = buildTweet(
        appBaseUrl,
        lastTokenAddress,
        name,
        symbol
      );
      setTweetText(text);
      setTweetIntentUrl(intent);
      setTokenPublicUrl(tokenUrl);
    } else {
      setTweetText("");
      setTweetIntentUrl("");
      setTokenPublicUrl("");
    }
  }, [lastTokenAddress, name, symbol, appBaseUrl]);

  const uploadFileToPinata = async (file: File) => {
    const url = "https://api.pinata.cloud/pinning/pinFileToIPFS";
    const form = new FormData();
    form.append("file", file);
    const apiKey = (import.meta as any).env?.VITE_PINATA_API_KEY;
    const secret = (import.meta as any).env?.VITE_PINATA_SECRET_API_KEY;
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
    // Preflight validations
    if (!account?.address) {
      setStatus("❌ Please connect your wallet.");
      return;
    }
    if (!name || !symbol || !initialSupply || Number(initialSupply) <= 0) {
      setStatus("❌ Please fill in name, symbol, and initial supply.");
      return;
    }
    const initialSupplyWei = parseUnits(initialSupply, decimals);

    if (seedLiquidity) {
      const seedTokensWei = parseUnits(seedTokens || "0", decimals);
      if (seedTokensWei <= 0n) {
        setStatus("❌ Seed Tokens must be > 0.");
        return;
      }
      if (seedTokensWei > initialSupplyWei) {
        setStatus("❌ Seed Tokens cannot exceed the initial supply.");
        return;
      }
      const amountWethDesired = parseUnits(seedEth || "0", 18);
      if (amountWethDesired <= 0n) {
        setStatus("❌ Seed ETH must be > 0.");
        return;
      }
    }

    try {
      setStatus("⏳ Uploading image…");
      let imageUrl = "";
      if (imageFile) imageUrl = await uploadFileToPinata(imageFile);

      // 1) Create token
      setStatus("🧱 Step 1/4: Creating token… (Confirm in wallet)");
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
      await sendTx(createTx);

      // Discover new token address
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
      setLastTokenAddress(tokenAddress);
      setStatus(`✅ Token created: ${tokenAddress}`);

      if (!seedLiquidity) {
        setStatus((s) => s + " (Skipping liquidity seeding.)");
        return;
      }

      // 2) Seed Liquidity
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

      const amountWethDesired = parseUnits(seedEth || "0", 18);
      const amountTokenDesired = parseUnits(seedTokens || "0", decimals);

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 15 * 60);
      const tolerance = BigInt(Math.floor((100 - slippage) * 100)); // bps
      const denom = 10000n;
      const amountWethMin = (amountWethDesired * tolerance) / denom;
      const amountTokenMin = (amountTokenDesired * tolerance) / denom;

      // 2.1 Wrap ETH -> WETH
      setStatus("💧 Step 2/4: Wrapping ETH to WETH… (Confirm in wallet)");
      await sendTx(
        prepareContractCall({
          contract: weth,
          method: "function deposit() payable",
          params: [],
          value: amountWethDesired,
        })
      );

      // 2.2 Approve WETH
      setStatus("✅ Step 3/4: Approving router (WETH)… (Confirm in wallet)");
      await sendTx(
        prepareContractCall({
          contract: weth,
          method:
            "function approve(address spender, uint256 amount) returns (bool)",
          params: [router.address, amountWethDesired],
        })
      );

      // 2.3 Approve Token
      setStatus("✅ Step 4/4: Approving router (Token)… (Confirm in wallet)");
      await sendTx(
        prepareContractCall({
          contract: token,
          method:
            "function approve(address spender, uint256 amount) returns (bool)",
          params: [router.address, amountTokenDesired],
        })
      );

      // 2.4 Add Liquidity
      setStatus(
        "🧪 Adding liquidity (sets initial price)… (Confirm in wallet)"
      );
      await sendTx(
        prepareContractCall({
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
            account.address,
            deadline,
          ],
        })
      );

      // 3) Verify price exists (optional but nice)
      setStatus("🔍 Verifying liquidity and price…");
      let hasPrice = false;
      try {
        const outAmounts = (await readContract({
          contract: router,
          method:
            "function getAmountsOut(uint amountIn, address[] path) view returns (uint[] memory amounts)",
          params: [10n ** BigInt(decimals), [tokenAddress, wethAddr]],
        })) as bigint[];
        const wOut = outAmounts[outAmounts.length - 1];
        hasPrice = wOut > 0n;
      } catch {
        hasPrice = false;
      }

      if (hasPrice) {
        setStatus(
          "🎉 Token created and liquidity seeded! Your token now has a price."
        );
      } else {
        setStatus(
          `⚠️ Liquidity transaction completed, but price could not be verified yet. You can retry seeding liquidity for ${tokenAddress} if needed.`
        );
      }

      // Optional: you could auto-open the share dialog here.
      // Many browsers block popups unless triggered by a direct click, so we leave it to the button.
      // if (tweetIntentUrl) window.open(tweetIntentUrl, "_blank");
    } catch (err: any) {
      console.error(err);
      if (lastTokenAddress) {
        setStatus(
          `❌ A step failed after token creation. Token exists at ${lastTokenAddress}, but liquidity was not added. You can retry adding liquidity from the token page. Error: ${err.message}`
        );
      } else {
        setStatus(`❌ Error: ${err.message}`);
      }
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
            placeholder="Token Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              className="w-full px-4 py-3 bg-[#0f2430] border border-blue-900 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Token Symbol"
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
              className="w-full px-4 py-3 bg-[#0f2430] border border-blue-900 rounded-lg text-white"
              placeholder="Twitter URL"
              value={twitter}
              onChange={(e) => setTwitter(e.target.value)}
            />
            <input
              className="w-full px-4 py-3 bg-[#0f2430] border border-blue-900 rounded-lg text-white"
              placeholder="Telegram URL"
              value={telegram}
              onChange={(e) => setTelegram(e.target.value)}
            />
            <input
              className="w-full px-4 py-3 bg-[#0f2430] border border-blue-900 rounded-lg text-white"
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
              This creates a trading pair and sets the initial price for your
              token.
            </p>
            {seedLiquidity && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pl-8">
                <input
                  className="w-full px-4 py-3 bg-[#0f2430] border border-blue-900 rounded-lg text-white"
                  placeholder="Seed ETH (e.g., 0.1)"
                  value={seedEth}
                  onChange={(e) => setSeedEth(e.target.value)}
                />
                <input
                  className="w-full px-4 py-3 bg-[#0f2430] border border-blue-900 rounded-lg text-white"
                  placeholder="Seed Tokens (e.g., 100000)"
                  value={seedTokens}
                  onChange={(e) => setSeedTokens(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">Slippage</span>
                  <input
                    className="w-full px-4 py-3 bg-[#0f2430] border border-blue-900 rounded-lg text-white"
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
              ? "Processing…"
              : seedLiquidity
              ? "Create + Seed Liquidity"
              : "Create Token"}
          </button>

          {status && (
            <p className="text-center mt-4 text-sm text-gray-300">{status}</p>
          )}

          {/* Share Panel */}
          {lastTokenAddress && tweetIntentUrl && (
            <div className="mt-6 bg-[#0f2430] border border-blue-900 rounded-lg p-4">
              <div className="font-semibold text-white">Share your launch</div>
              <div className="text-sm text-gray-400 mt-1">
                Let the world know about {name || "your token"}{" "}
                {symbol ? `(${symbol.toUpperCase()})` : ""}.
              </div>
              <div className="flex flex-wrap gap-3 mt-3">
                <a
                  href={tweetIntentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded bg-blue-500 hover:bg-blue-600 text-white font-semibold"
                >
                  Share on X (Twitter)
                </a>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(tweetText);
                      setStatus("📋 Tweet text copied to clipboard!");
                    } catch {
                      setStatus("⚠️ Could not copy. Please copy manually.");
                    }
                  }}
                  className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-white"
                >
                  Copy Tweet Text
                </button>
                {tokenPublicUrl && (
                  <a
                    href={tokenPublicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 text-white"
                  >
                    View Token Page
                  </a>
                )}
              </div>
              <div className="mt-3 text-xs text-gray-400 break-words">
                Preview:
                <div className="mt-1 p-2 bg-[#0b1a24] rounded border border-blue-900 text-gray-300">
                  {tweetText}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Preview Section */}
        <div className="lg:col-span-2 lg:sticky top-24 h-fit">
          <h3 className="text-xl font-bold mb-4 text-center text-white">
            Live Preview
          </h3>
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
                  "Your token's short description will appear here."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

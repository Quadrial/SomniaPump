// import React, { useEffect, useMemo, useState } from "react";
// import { FaChevronDown } from "react-icons/fa6";
// import { FaArrowRight } from "react-icons/fa";
// import {
//   useReadContract,
//   useActiveAccount
// } from "thirdweb/react";
// import { getContract, readContract } from "thirdweb";
// import { somniaTestnet } from "thirdweb/chains";
// import { client } from "../client";

// // Format units helper
// const formatUnits = (value: bigint, decimals: number) => {
//   const s = value.toString().padStart(decimals + 1, "0");
//   const i = s.length - decimals;
//   const whole = s.slice(0, i) || "0";
//   const frac = s.slice(i).replace(/0+$/, ""); // Remove trailing zeros from fraction
//   return frac ? `${whole}.${frac}` : whole;
// };

// // Parse units helper
// const parseUnits = (value: string, decimals: number): bigint => {
//   const clean = (value || "0").trim();
//   if (!clean) return 0n;
//   const [w, f = ""] = clean.replace(/,/g, "").split(".");
//   const frac = (f + "0".repeat(decimals)).slice(0, decimals);
//   return BigInt(w || "0") * 10n ** BigInt(decimals) + BigInt(frac || "0");
// };

// // Token type
// type Token = {
//   address: string;
//   name: string;
//   symbol: string;
//   decimals: number;
// };

// const Swap = ({
//   tokenFactoryContract,
//   routerContract,
// }: {
//   tokenFactoryContract: any;
//   routerContract: any;
// }) => {
//   // Account
//   const account = useActiveAccount();

//   // Tokens state
//   const [tokens, setTokens] = useState<Token[]>([]);
//   const [wethAddr, setWethAddr] = useState<string>("");

//   // Swap state
//   const [fromToken, setFromToken] = useState<Token | null>(null);
//   const [toToken, setToToken] = useState<Token | null>(null);
//   const [fromAmount, setFromAmount] = useState("");
//   const [toAmount, setToAmount] = useState("");
//   const [slippage, setSlippage] = useState(0.5); // 0.5%
//   const [showFromSelect, setShowFromSelect] = useState(false);
//   const [showToSelect, setShowToSelect] = useState(false);

//   // UI state
//   const [status, setStatus] = useState("");
//   const [busy, setBusy] = useState(false);
//   const [lastTx, setLastTx] = useState<string | null>(null);

//   // Fetch WETH address
//   useEffect(() => {
//     const fetchWethAddress = async () => {
//       if (!tokenFactoryContract) return;

//       try {
//         const weth = await readContract({
//           contract: tokenFactoryContract,
//           method: "function weth() view returns (address)",
//         });
//         setWethAddr(weth as string);
//       } catch (e) {
//         console.error("Failed to fetch WETH address:", e);
//       }
//     };

//     fetchWethAddress();
//   }, [tokenFactoryContract]);

//   // Fetch tokens
//   useEffect(() => {
//     const fetchTokens = async () => {
//       if (!tokenFactoryContract) return;

//       try {
//         setStatus("Loading tokens...");

//         // Get total tokens
//         const countBn = (await readContract({
//           contract: tokenFactoryContract,
//           method: "function totalTokens() view returns (uint256)",
//         })) as bigint;

//         const count = Number(countBn || 0n);
//         if (count === 0) {
//           setTokens([]);
//           setStatus("");
//           return;
//         }

//         // Get token addresses
//         const addresses = await Promise.all(
//           Array.from({ length: count }).map(async (_v, i) => {
//             try {
//               return (await readContract({
//                 contract: tokenFactoryContract,
//                 method: "function tokenAt(uint256) view returns (address)",
//                 params: [BigInt(i)],
//               })) as string;
//             } catch {
//               return (await readContract({
//                 contract: tokenFactoryContract,
//                 method: "function tokensList(uint256) view returns (address)",
//                 params: [BigInt(i)],
//               })) as string;
//             }
//           })
//         );

//         // Get token details
//         const tokenDetails = await Promise.all(
//           addresses.map(async (addr) => {
//             const tokenContract = getContract({
//               client,
//               chain: somniaTestnet,
//               address: addr,
//             });

//             const [name, symbol, decimals] = await Promise.all([
//               readContract({
//                 contract: tokenContract,
//                 method: "function name() view returns (string)",
//               }).catch(() => "Unknown"),
//               readContract({
//                 contract: tokenContract,
//                 method: "function symbol() view returns (string)",
//               }).catch(() => "???"),
//               readContract({
//                 contract: tokenContract,
//                 method: "function decimals() view returns (uint8)",
//               }).catch(() => 18),
//             ]);

//             return {
//               address: addr,
//               name: name as string,
//               symbol: symbol as string,
//               decimals: Number(decimals ?? 18),
//             };
//           })
//         );

//         setTokens(tokenDetails);

//         // Set default tokens if none selected
//         if (!fromToken && tokenDetails.length > 0) {
//           setFromToken(tokenDetails[0]);
//         }
//         if (!toToken && tokenDetails.length > 1) {
//           setToToken(tokenDetails[1]);
//         }

//         setStatus("");
//       } catch (e) {
//         console.error("Failed to fetch tokens:", e);
//         setTokens([]);
//         setStatus("Failed to load tokens");
//       }
//     };

//     fetchTokens();
//   }, [tokenFactoryContract, fromToken, toToken]);

//   const { data: quoteData, isLoading: quoteLoading } = useReadContract({
//     contract: routerContract,
//     method: "function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[] amounts)",
//     params: (() => {
//       if (fromToken && toToken && fromAmount && parseFloat(fromAmount) > 0 && wethAddr) {
//         const params: readonly [bigint, readonly string[]] = [
//           parseUnits(fromAmount, fromToken.decimals),
//           [fromToken.address, toToken.address],
//         ];
//         return params;
//       }
//       return undefined;
//     })(),
//     queryOptions: {
//       enabled: !!(
//         routerContract &&
//         fromToken &&
//         toToken &&
//         fromAmount &&
//         parseFloat(fromAmount) > 0 &&
//         wethAddr
//       ),
//     },
//   });

//   // Update toAmount when quote changes
//   useEffect(() => {
//     if (quoteData && Array.isArray(quoteData) && quoteData.length > 1) {
//       const outAmount = quoteData[quoteData.length - 1] as bigint;
//       if (toToken) {
//         setToAmount(formatUnits(outAmount, toToken.decimals));
//       }
//     } else {
//       setToAmount("");
//     }
//   }, [quoteData, toToken]);

//   // Token selector component
//   const TokenRow = ({ token, onSelect }: { token: Token; onSelect: (token: Token) => void }) => (
//     <button
//       className="w-full text-left px-3 py-2 hover:bg-[#0f2430] rounded flex items-center gap-3"
//       onClick={() => onSelect(token)}
//       aria-label={`Select ${token.symbol}`}
//     >
//       <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center text-xs font-bold">
//         {token.symbol.slice(0, 3)}
//       </div>
//       <div className="min-w-0">
//         <div className="text-sm font-medium truncate">{token.name}</div>
//         <div className="text-xs text-gray-400 truncate">{token.symbol}</div>
//       </div>
//     </button>
//   );

//   // Swap direction toggle
//   const flip = () => {
//     setFromAmount(toAmount || "");
//     setToAmount(fromAmount || "");
//     const temp = fromToken;
//     setFromToken(toToken);
//     setToToken(temp);
//   };

//   // Calculate price info
//   const priceInfo = useMemo(() => {
//     if (!fromToken || !toToken || !fromAmount || !toAmount)
//       return { price: null, route: null };

//     const amtIn = parseFloat(fromAmount) || 0;
//     const amtOut = parseFloat(toAmount) || 0;

//     if (amtIn <= 0 || amtOut <= 0)
//       return { price: null, route: null };

//     const price = amtIn / amtOut;

//     return {
//       price,
//       route: `${fromToken.symbol} → ${toToken.symbol}`,
//     };
//   }, [fromToken, toToken, fromAmount, toAmount]);

//   // Handle swap
//   const handleSwap = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setStatus("");

//     if (!fromAmount || parseFloat(fromAmount) <= 0) {
//       setStatus("Enter an amount to swap.");
//       return;
//     }

//     if (!fromToken || !toToken) {
//       setStatus("Select tokens to swap.");
//       return;
//     }

//     if (!account?.address) {
//       setStatus("Connect your wallet to swap.");
//       return;
//     }

//     try {
//       setBusy(true);
//       setStatus("Preparing swap...");

//       // TODO: Add actual swap logic here
//       // For now, we'll just simulate a transaction

//       setStatus(`Swapping ${fromAmount} ${fromToken.symbol} for ${toToken.symbol}...`);

//       // Simulate a delay
//       await new Promise(res => setTimeout(res, 2000));

//       const txHash = `0x${[...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;
//       setLastTx(txHash);
//       setStatus("Swap successful!");

//     } catch (err: any) {
//       setStatus(`Error: ${err.message || "Unknown error"}`);
//     } finally {
//       setBusy(false);
//     }
//   };

//   const connectWallet = () => {
//     // Add wallet connection logic here
//     console.log("Connect wallet clicked");
//   };

//   const selectFrom = (token: Token) => {
//     setFromToken(token);
//     setShowFromSelect(false);
//   };

//   const selectTo = (token: Token) => {
//     setToToken(token);
//     setShowToSelect(false);
//   };

//   return (
//     <div className="w-full max-w-lg mx-auto">
//       <div className="bg-[#0b1420] border border-blue-900 rounded-xl p-4 sm:p-6">
//         <div className="flex items-center justify-between mb-4">
//           <h2 className="text-xl font-semibold">Swap</h2>
//           {/* Settings button can go here */}
//         </div>

//         <form onSubmit={handleSwap} className="flex flex-col gap-4">
//           {/* from token */}
//           <div className="bg-[#0f2430] p-4 rounded-lg">
//             <div className="flex items-center justify-between mb-1">
//               <span className="text-sm text-gray-400">From</span>
//               <span className="text-sm text-gray-400">
//                 {/* Balance: {fromBalance || '0.0'} */}
//               </span>
//             </div>
//             <div className="flex items-center justify-between gap-4">
//               <input
//                 type="number"
//                 placeholder="0"
//                 value={fromAmount}
//                 onChange={(e) => setFromAmount(e.target.value)}
//                 className="bg-transparent text-2xl font-mono w-full focus:outline-none"
//               />
//               <button
//                 type="button"
//                 onClick={() => setShowFromSelect(true)}
//                 className="flex items-center gap-2 bg-[#0b1420] px-3 py-2 rounded-full hover:bg-gray-800"
//               >
//                 {fromToken ? (
//                   <>
//                     <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center text-xs font-bold">
//                       {fromToken.symbol.slice(0,3)}
//                     </div>
//                     <span className="font-medium">{fromToken.symbol}</span>
//                   </>
//                 ) : (
//                   "Select"
//                 )}
//                 <FaChevronDown />
//               </button>
//             </div>
//           </div>

//           {/* direction toggle */}
//           <div className="flex justify-center -my-2 z-10">
//             <button
//               type="button"
//               onClick={flip}
//               className="bg-[#0f2430] p-2 rounded-full border-4 border-[#0b1420] hover:rotate-180 transition-transform"
//             >
//               <FaArrowRight className="text-gray-400" />
//             </button>
//           </div>

//           {/* to token */}
//           <div className="bg-[#0f2430] p-4 rounded-lg">
//             <div className="flex items-center justify-between mb-1">
//               <span className="text-sm text-gray-400">To</span>
//               <span className="text-sm text-gray-400">
//                 {/* Balance: {toBalance || '0.0'} */}
//               </span>
//             </div>
//             <div className="flex items-center justify-between gap-4">
//               <input
//                 type="number"
//                 placeholder="0"
//                 value={quoteLoading ? "Loading..." : toAmount}
//                 onChange={(e) => setToAmount(e.target.value)}
//                 className="bg-transparent text-2xl font-mono w-full focus:outline-none"
//               />
//               <button
//                 type="button"
//                 onClick={() => setShowToSelect(true)}
//                 className="flex items-center gap-2 bg-[#0b1420] px-3 py-2 rounded-full hover:bg-gray-800"
//               >
//                 {toToken ? (
//                   <>
//                     <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center text-xs font-bold">
//                       {toToken.symbol.slice(0,3)}
//                     </div>
//                     <span className="font-medium">{toToken.symbol}</span>
//                   </>
//                 ) : (
//                   "Select"
//                 )}
//                 <FaChevronDown />
//               </button>
//             </div>
//           </div>

//             {/* info row */}
//             <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-gray-400">
//               <div>
//                 <div>
//                   Route:{" "}
//                   <span className="text-gray-200">
//                     {priceInfo.route || "—"}
//                   </span>
//                 </div>
//                 <div>
//                   Price:{" "}
//                   <span className="text-gray-200">
//                     {priceInfo.price ? priceInfo.price.toFixed(6) : "—"}
//                   </span>
//                 </div>
//               </div>

//               <div className="flex items-center gap-3">
//                 <div className="text-xs text-gray-300">Slippage</div>
//                 <div className="flex gap-2 items-center">
//                   {[0.1, 0.5, 1].map((s) => (
//                     <button
//                       key={s}
//                       type="button"
//                       onClick={() => setSlippage(s)}
//                       className={`px-2 py-1 rounded text-sm ${
//                         slippage === s ? "bg-blue-500" : "bg-[#0f2430]"
//                       }`}
//                     >
//                       {s}%
//                     </button>
//                   ))}
//                   <input
//                     type="number"
//                     min="0"
//                     step="0.1"
//                     value={slippage}
//                     onChange={(e) =>
//                       setSlippage(parseFloat(e.target.value || "0"))
//                     }
//                     className="w-20 px-2 py-1 rounded bg-[#0b1420] text-sm"
//                     aria-label="Custom slippage"
//                   />
//                 </div>
//               </div>
//             </div>

//             {/* actions */}
//             <div className="flex gap-3 flex-col sm:flex-row">
//               <button
//                 type="button"
//                 onClick={connectWallet}
//                 className="flex-1 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
//               >
//                 {account
//                   ? `Connected: ${account.address.slice(0, 8)}…`
//                   : "Connect Wallet"}
//               </button>
//               <button
//                 type="submit"
//                 disabled={busy}
//                 className="flex-1 bg-gradient-to-r from-indigo-500 to-pink-500 px-4 py-2 rounded"
//               >
//                 {busy ? "Swapping..." : "Swap"}
//               </button>
//             </div>

//             {status && <div className="text-sm text-gray-300">{status}</div>}
//             {lastTx && (
//               <div className="text-xs text-blue-300">
//                 Tx (sim): <a href="#">{lastTx}</a>
//               </div>
//             )}
//           </form>
//         </div>

//         {/* token selectors as modals */}
//         {(showFromSelect || showToSelect) && (
//           <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
//             <div className="bg-[#0b1420] border border-blue-500 rounded-lg w-full max-w-md p-4">
//               <div className="flex items-center justify-between mb-3">
//                 <h3 className="font-semibold">Select token</h3>
//                 <button
//                   onClick={() => {
//                     setShowFromSelect(false);
//                     setShowToSelect(false);
//                   }}
//                   className="text-gray-400"
//                 >
//                   Close
//                 </button>
//               </div>
//               <div className="mb-2">
//                 <input
//                   placeholder="Search token"
//                   className="w-full px-3 py-2 rounded bg-[#0b1220]"
//                   onChange={() => {}}
//                 />
//               </div>
//               <div className="max-h-64 overflow-auto">
//                 {tokens.map((t) => (
//                   <TokenRow
//                     key={t.address}
//                     token={t}
//                     onSelect={showFromSelect ? selectFrom : selectTo}
//                   />
//                 ))}
//               </div>
//             </div>
//           </div>
//         )}

//         {/* footer note */}
//         <div className="text-center text-xs text-gray-500 mt-6">
//           Demo swap uses simulated pools. To enable real swaps, integrate an
//           on-chain router and handle allowances/approvals, slippage checks, and
//           transaction confirmations.
//         </div>
//       </div>
//   );
// };

// export default Swap;

const Swap = () => {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center bg-gradient-to-br from-indigo-900 via-blue-900 to-pink-900 rounded-xl shadow-lg mx-auto mt-16 max-w-xl">
      <div className="flex flex-col items-center gap-4 p-8">
        <div className="animate-bounce">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="32" r="32" fill="url(#grad)" />
            <path
              d="M32 18v28M18 32h28"
              stroke="#fff"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <defs>
              <linearGradient
                id="grad"
                x1="0"
                y1="0"
                x2="64"
                y2="64"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#6366f1" />
                <stop offset="1" stopColor="#ec4899" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <h1 className="text-3xl font-extrabold text-white drop-shadow-lg">
          Coming Soon
        </h1>
        <p className="text-lg text-gray-200 text-center max-w-md">
          The Swap feature is under construction.
          <br />
          Stay tuned for a seamless trading experience!
        </p>
        <div className="mt-6">
          <span className="inline-block px-4 py-2 bg-gradient-to-r from-indigo-500 to-pink-500 text-white rounded-full font-semibold shadow">
            🚀 Launching Soon!
          </span>
        </div>
      </div>
    </div>
  );
};

export default Swap;

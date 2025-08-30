'''// Swap.tsx
import React, { useEffect, useMemo, useState } from "react";
import { FaChevronDown } from "react-icons/fa6";
import { FaArrowRight } from "react-icons/fa";
import {
  useReadContract,
  useSendTransaction,
  useActiveAccount,
} from "thirdweb/react";
import { prepareContractCall, getContract, readContract } from "thirdweb";
import { somniaTestnet } from "thirdweb/chains";
import { client } from "../client";

// Format units helper
const formatUnits = (value: bigint, decimals: number) => {
  const s = value.toString().padStart(decimals + 1, "0");
  const i = s.length - decimals;
  const whole = s.slice(0, i) || "0";
  const frac = s.slice(i).replace(/0+$/, ""); // Remove trailing zeros from fraction
  return frac ? `${whole}.${frac}` : whole;
};

// Parse units helper
const parseUnits = (value: string, decimals: number): bigint => {
  const clean = (value || "0").trim();
  if (!clean) return 0n;
  const [w, f = ""] = clean.replace(/,/g, "").split(".");
  const frac = (f + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(w || "0") * 10n ** BigInt(decimals) + BigInt(frac || "0");
};

// Token type
type Token = {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
};

const Swap = ({
  tokenFactoryContract,
  routerContract,
}: {
  tokenFactoryContract: any;
  routerContract: any;
}) => {
  // Account
  const account = useActiveAccount();

  // Tokens state
  const [tokens, setTokens] = useState<Token[]>([]);
  const [wethAddr, setWethAddr] = useState<string>("");

  // Swap state
  const [fromToken, setFromToken] = useState<Token | null>(null);
  const [toToken, setToToken] = useState<Token | null>(null);
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [slippage, setSlippage] = useState(0.5); // 0.5%
  const [showFromSelect, setShowFromSelect] = useState(false);
  const [showToSelect, setShowToSelect] = useState(false);

  // UI state
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastTx, setLastTx] = useState<string | null>(null);

  // Send transaction hook
  const { mutateAsync: sendTransaction } = useSendTransaction();

  // Fetch WETH address
  useEffect(() => {
    const fetchWethAddress = async () => {
      if (!tokenFactoryContract) return;

      try {
        const weth = await readContract({
          contract: tokenFactoryContract,
          method: "function weth() view returns (address)",
        });
        setWethAddr(weth as string);
      } catch (e) {
        console.error("Failed to fetch WETH address:", e);
      }
    };

    fetchWethAddress();
  }, [tokenFactoryContract]);

  // Fetch tokens
  useEffect(() => {
    const fetchTokens = async () => {
      if (!tokenFactoryContract) return;

      try {
        setStatus("Loading tokens...");

        // Get total tokens
        const countBn = (await readContract({
          contract: tokenFactoryContract,
          method: "function totalTokens() view returns (uint256)",
        })) as bigint;

        const count = Number(countBn || 0n);
        if (count === 0) {
          setTokens([]);
          setStatus("");
          return;
        }

        // Get token addresses
        const addresses = await Promise.all(
          Array.from({ length: count }).map(async (_v, i) => {
            try {
              return (await readContract({
                contract: tokenFactoryContract,
                method: "function tokenAt(uint256) view returns (address)",
                params: [BigInt(i)],
              })) as string;
            } catch {
              return (await readContract({
                contract: tokenFactoryContract,
                method: "function tokensList(uint256) view returns (address)",
                params: [BigInt(i)],
              })) as string;
            }
          })
        );

        // Get token details
        const tokenDetails = await Promise.all(
          addresses.map(async (addr) => {
            const tokenContract = getContract({
              client,
              chain: somniaTestnet,
              address: addr,
            });

            const [name, symbol, decimals] = await Promise.all([
              readContract({
                contract: tokenContract,
                method: "function name() view returns (string)",
              }).catch(() => "Unknown"),
              readContract({
                contract: tokenContract,
                method: "function symbol() view returns (string)",
              }).catch(() => "???"),
              readContract({
                contract: tokenContract,
                method: "function decimals() view returns (uint8)",
              }).catch(() => 18),
            ]);

            return {
              address: addr,
              name: name as string,
              symbol: symbol as string,
              decimals: Number(decimals ?? 18),
            };
          })
        );

        setTokens(tokenDetails);

        // Set default tokens if none selected
        if (!fromToken && tokenDetails.length > 0) {
          setFromToken(tokenDetails[0]);
        }
        if (!toToken && tokenDetails.length > 1) {
          setToToken(tokenDetails[1]);
        }

        setStatus("");
      } catch (e) {
        console.error("Failed to fetch tokens:", e);
        setTokens([]);
        setStatus("Failed to load tokens");
      }
    };

    fetchTokens();
  }, [tokenFactoryContract, fromToken, toToken]);

  // Get quote for fromAmount -> toAmount
  const { data: quoteData, isLoading: quoteLoading } = useReadContract({
    contract: routerContract,
    method:
      "function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[] amounts)",
    params:
      fromToken && toToken && fromAmount && parseFloat(fromAmount) > 0 && wethAddr
        ? [
            parseUnits(fromAmount, fromToken.decimals),
            [fromToken.address, toToken.address],
          ]
        : undefined,
    queryOptions: {
      enabled: !!(
        routerContract &&
        fromToken &&
        toToken &&
        fromAmount &&
        parseFloat(fromAmount) > 0 &&
        wethAddr
      ),
    },
  });

  // Update toAmount when quote changes
  useEffect(() => {
    if (quoteData && Array.isArray(quoteData) && quoteData.length > 1) {
      const outAmount = quoteData[quoteData.length - 1] as bigint;
      if (toToken) {
        setToAmount(formatUnits(outAmount, toToken.decimals));
      }
    } else {
      setToAmount("");
    }
  }, [quoteData, toToken]);

  // Get reverse quote for toAmount -> fromAmount
  const { data: reverseQuoteData } = useReadContract({
    contract: routerContract,
    method:
      "function getAmountsIn(uint256 amountOut, address[] path) view returns (uint256[] amounts)",
    params:
      toToken && toAmount && parseFloat(toAmount) > 0 && wethAddr
        ? [
            parseUnits(toAmount, toToken.decimals),
            [fromToken?.address || "", toToken.address],
          ]
        : undefined,
    queryOptions: {
      enabled: !!(
        routerContract &&
        fromToken &&
        toToken &&
        toAmount &&
        parseFloat(toAmount) > 0 &&
        wethAddr
      ),
    },
  });

  // Token selector component
  const TokenRow = ({
    token,
    onSelect,
  }: {
    token: Token;
    onSelect: (token: Token) => void;
  }) => (
    <button
      className="w-full text-left px-3 py-2 hover:bg-[#0f2430] rounded flex items-center gap-3"
      onClick={() => onSelect(token)}
      aria-label={`Select ${token.symbol}`}
    >
      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center text-xs font-bold">
        {token.symbol.slice(0, 3)}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{token.name}</div>
        <div className="text-xs text-gray-400 truncate">{token.symbol}</div>
      </div>
    </button>
  );

  // Swap direction toggle
  const flip = () => {
    setFromAmount(toAmount || "");
    setToAmount(fromAmount || "");
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
  };

  // Calculate price info
  const priceInfo = useMemo(() => {
    if (!fromToken || !toToken || !fromAmount || !toAmount)
      return { price: null, route: null, impact: null };

    const amtIn = parseFloat(fromAmount) || 0;
    const amtOut = parseFloat(toAmount) || 0;

    if (amtIn <= 0 || amtOut <= 0)
      return { price: null, route: null, impact: null };

    const price = amtIn / amtOut;

    return {
      price,
      route: `${fromToken.symbol} → ${toToken.symbol}`,
      impact: 0, // Placeholder for impact calculation
    };
  }, [fromToken, toToken, fromAmount, toAmount]);

  // Handle swap
  const handleSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("");

    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      setStatus("Enter an amount to swap.");
      return;
    }

    if (!fromToken || !toToken) {
      setStatus("Select tokens to swap.");
      return;
    }

    if (!account?.address) {
      setStatus("Connect your wallet to swap.");
      return;
    }

    try {
      setBusy(true);
      setStatus("Preparing swap...");

      // Parse amounts
      const amountIn = parseUnits(fromAmount, fromToken.decimals);
      const amountOutMin =
        toToken && quoteData && Array.isArray(quoteData) && quoteData.length > 1
          ? ((quoteData[quoteData.length - 1] as bigint) *
              BigInt(1000 - slippage * 10)) /
            1000n
          : 0n;

      // Path
      const path = [fromToken.address, toToken.address];

      // Deadline
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 mins

      // Prepare transaction
      const tx = prepareContractCall({
        contract: routerContract,
        method:
          "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[] amounts)",
        params: [amountIn, amountOutMin, path, account.address, BigInt(deadline)],
      });

      // Send transaction
      const { transactionHash } = await sendTransaction(tx);
      setLastTx(transactionHash);
      setStatus(`Swap submitted! Tx: ${transactionHash}`);
    } catch (e: any) {
      console.error("Swap failed:", e);
      setStatus(`Swap failed: ${e.message || "Unknown error"}`);
    } finally {
      setBusy(false);
    }
  };

  // Select token handlers
  const selectFrom = (token: Token) => {
    setFromToken(token);
    setShowFromSelect(false);
  };

  const selectTo = (token: Token) => {
    setToToken(token);
    setShowToSelect(false);
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="bg-[#0b1a28] border border-blue-500/20 rounded-xl p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Swap</h2>
          <div className="text-xs text-gray-400">Somnia Testnet</div>
        </div>

        <form onSubmit={handleSwap} className="flex flex-col gap-4">
          {/* from token */}
          <div className="bg-[#0f2430] p-3 rounded-lg">
            <div className="flex items-center justify-between text-sm mb-1">
              <div className="text-gray-400">From</div>
              <div className="text-gray-400">Balance: —</div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <input
                type="number"
                placeholder="0"
                value={fromAmount}
                onChange={(e) => setFromAmount(e.target.value)}
                className="bg-transparent text-2xl font-mono w-full focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowFromSelect(true)}
                className="flex items-center gap-2 bg-[#0b1a28] px-3 py-2 rounded-lg hover:bg-opacity-80"
              >
                {fromToken ? (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center text-xs font-bold">
                    {fromToken.symbol.slice(0, 3)}
                  </div>
                ) : null}
                <span className="font-medium">
                  {fromToken?.symbol || "Select"}
                </span>
                <FaChevronDown />
              </button>
            </div>
          </div>

          {/* separator */}
          <div className="flex justify-center -my-2">
            <button
              type="button"
              onClick={flip}
              className="bg-[#0f2430] border-4 border-[#0b1a28] rounded-full w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white hover:rotate-180 transition-transform"
            >
              <FaArrowRight />
            </button>
          </div>

          {/* to token */}
          <div className="bg-[#0f2430] p-3 rounded-lg">
            <div className="flex items-center justify-between text-sm mb-1">
              <div className="text-gray-400">To</div>
              <div className="text-gray-400">Balance: —</div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <input
                type="number"
                placeholder="0"
                value={toAmount}
                onChange={(e) => setToAmount(e.target.value)}
                className="bg-transparent text-2xl font-mono w-full focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowToSelect(true)}
                className="flex items-center gap-2 bg-[#0b1a28] px-3 py-2 rounded-lg hover:bg-opacity-80"
              >
                {toToken ? (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center text-xs font-bold">
                    {toToken.symbol.slice(0, 3)}
                  </div>
                ) : null}
                <span className="font-medium">
                  {toToken?.symbol || "Select"}
                </span>
                <FaChevronDown />
              </button>
            </div>
          </div>

          {/* info row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-gray-400">
            <div>
              <div>
                Route:{" "}
                <span className="text-gray-200">
                  {priceInfo.route || "—"}
                </span>
              </div>
              <div>
                Price:{" "}
                <span className="text-gray-200">
                  {priceInfo.price ? priceInfo.price.toFixed(6) : "—"}
                </span>
              </div>
              <div>
                Impact:{" "}
                <span
                  className={
                    Math.abs(priceInfo.impact || 0) > 5
                      ? "text-yellow-300"
                      : "text-gray-200"
                  }
                >
                  {priceInfo.impact ? priceInfo.impact.toFixed(2) + "%" : "—"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-xs text-gray-300">Slippage</div>
              <div className="flex gap-2 items-center">
                {[0.1, 0.5, 1].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSlippage(s)}
                    className={`px-2 py-1 rounded text-sm ${
                      slippage === s ? "bg-blue-500" : "bg-[#0f2430]"
                    }`}
                  >
                    {s}%
                  </button>
                ))}
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={slippage}
                  onChange={(e) =>
                    setSlippage(parseFloat(e.target.value || "0"))
                  }
                  className="w-20 px-2 py-1 rounded bg-[#0b1420] text-sm"
                  aria-label="Custom slippage"
                />
              </div>
            </div>
          </div>

          {/* actions */}
          <div className="flex gap-3 flex-col sm:flex-row">
            <button
              type="submit"
              disabled={busy || !account}
              className="flex-1 bg-gradient-to-r from-indigo-500 to-pink-500 px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? "Swapping..." : "Swap"}
            </button>
          </div>

          {status && <div className="text-sm text-gray-300">{status}</div>}
          {lastTx && (
            <div className="text-xs text-blue-300">
              Tx:{" "}
              <a
                href={`https://testnet.somniascan.io/tx/${lastTx}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {lastTx.slice(0, 10)}...{lastTx.slice(-8)}
              </a>
            </div>
          )}
        </form>
      </div>

      {/* token selectors as modals */}
      {(showFromSelect || showToSelect) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[#0b1420] border border-blue-500 rounded-lg w-full max-w-md p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Select token</h3>
              <button
                onClick={() => {
                  setShowFromSelect(false);
                  setShowToSelect(false);
                }}
                className="text-gray-400"
              >
                Close
              </button>
            </div>
            <div className="mb-2">
              <input
                placeholder="Search token"
                className="w-full px-3 py-2 rounded bg-[#0b1220]"
                onChange={() => {}}
              />
            </div>
            <div className="max-h-64 overflow-auto">
              {tokens.map((t) => (
                <TokenRow
                  key={t.address}
                  token={t}
                  onSelect={showFromSelect ? selectFrom : selectTo}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* footer note */}
      <div className="text-center text-xs text-gray-500 mt-6">
        Demo swap uses simulated pools. To enable real swaps, integrate an
        on-chain router and handle allowances/approvals, slippage checks, and
        transaction confirmations.
      </div>
    </div>
  );
};

export default Swap;
''
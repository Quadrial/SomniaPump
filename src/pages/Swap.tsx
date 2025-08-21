// Swap.jsx
import React, { useEffect, useMemo, useState } from "react";
import { FaChevronDown } from "react-icons/fa6";
import { FaArrowRight } from "react-icons/fa";

/*
  Swap UI (frontend-only)
  - Replace mockPools/mockTokens and simulation functions with real on-chain data.
  - If using EVM-like DEX: use ethers + router contract (approve -> swapExactTokensForTokensSupportingFeeOnTransferTokens or swapExactTokensForTokens)
  - If using Somnia/Sui: use Sui SDK swap methods.
*/

const SWAP_FEE = 0.003; // 0.3% typical AMM fee (adjust to your DEX)
const DEFAULT_SLIPPAGE = 0.5; // percent

// Mock tokens/pools for demo. Replace with real list/pools from indexer.
const MOCK_TOKENS = [
  { symbol: "SUI", name: "Somnia", address: "SUI", decimals: 9 },
  { symbol: "MPUMP", name: "MovePump", address: "0xmpump", decimals: 9 },
  { symbol: "USDC", name: "USD Coin", address: "0xusdc", decimals: 6 },
];

const MOCK_POOLS = {
  // key format "A|B" with reserves in token units
  "SUI|MPUMP": { reserveA: 1000000, reserveB: 500000 }, // SUI:MPUMP
  "USDC|MPUMP": { reserveA: 200000, reserveB: 400000 }, // USDC:MPUMP
  "SUI|USDC": { reserveA: 500000, reserveB: 250000 },
};

function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

// constant product swap calculation (amountOut given amountIn and reserves)
function getAmountOut(amountIn, reserveIn, reserveOut, fee = SWAP_FEE) {
  if (amountIn <= 0 || reserveIn <= 0 || reserveOut <= 0) return 0;
  const amountInWithFee = amountIn * (1 - fee);
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn + amountInWithFee;
  return numerator / denominator;
}

// execution price = amountIn/amountOut; midPrice = reserveIn/reserveOut
function getPriceImpact(amountIn, reserveIn, reserveOut, amountOut) {
  const midPrice = reserveIn / reserveOut;
  const executionPrice = amountIn / amountOut;
  if (!isFinite(midPrice) || !isFinite(executionPrice) || executionPrice === 0) return 0;
  return ((executionPrice - midPrice) / midPrice) * 100; // percent
}

const TokenRow = ({ token, onSelect }) => (
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

const Swap = () => {
  const [tokens, setTokens] = useState(MOCK_TOKENS);
  const [pools, setPools] = useState(MOCK_POOLS);

  // swap state
  const [fromToken, setFromToken] = useState(tokens[0]);
  const [toToken, setToToken] = useState(tokens[1]);
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [slippage, setSlippage] = useState(DEFAULT_SLIPPAGE);
  const [showFromSelect, setShowFromSelect] = useState(false);
  const [showToSelect, setShowToSelect] = useState(false);

  // wallet-ish UI
  const [account, setAccount] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastTx, setLastTx] = useState(null);

  // derive pool/reserves
  const poolKey = useMemo(() => pairKey(fromToken.address, toToken.address), [fromToken, toToken]);
  const pool = pools[poolKey] || null;

  // compute estimated output when fromAmount changes
  useEffect(() => {
    if (!pool || !fromAmount) {
      setToAmount("");
      return;
    }
    const amtIn = parseFloat(fromAmount);
    if (!isFinite(amtIn) || amtIn <= 0) {
      setToAmount("");
      return;
    }

    // Map tokens to pool reserves correctly depending on key ordering
    const [aAddr, bAddr] = poolKey.split("|");
    // identify which reserve corresponds to fromToken
    const reserveIn = fromToken.address === aAddr ? pool.reserveA : pool.reserveB;
    const reserveOut = fromToken.address === aAddr ? pool.reserveB : pool.reserveA;

    const amtOut = getAmountOut(amtIn, reserveIn, reserveOut);
    setToAmount(amtOut ? amtOut.toFixed(6) : "");
  }, [fromAmount, pool, poolKey, fromToken]);

  // swap direction toggle
  const flip = () => {
    setFromAmount(toAmount || "");
    setToAmount(fromAmount || "");
    const A = fromToken;
    setFromToken(toToken);
    setToToken(A);
  };

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        setStatus("No injected wallet (MetaMask). This UI still works for demos.");
        return;
      }
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      setAccount(accounts?.[0] || "");
      setStatus("Wallet connected: " + (accounts?.[0] ? accounts[0].slice(0, 8) + "…" : ""));
    } catch (err) {
      console.error(err);
      setStatus("Failed to connect wallet.");
    }
  };

  // Calculate price, price impact for display
  const priceInfo = useMemo(() => {
    if (!pool) return { price: null, impact: null, route: null };
    const [aAddr, bAddr] = poolKey.split("|");
    const reserveIn = fromToken.address === aAddr ? pool.reserveA : pool.reserveB;
    const reserveOut = fromToken.address === aAddr ? pool.reserveB : pool.reserveA;

    const amtIn = parseFloat(fromAmount) || 0;
    const amtOut = parseFloat(toAmount) || 0;

    const midPrice = reserveIn / reserveOut;
    const execPrice = amtOut > 0 ? amtIn / amtOut : midPrice;
    const impact = amtOut > 0 ? getPriceImpact(amtIn, reserveIn, reserveOut, amtOut) : 0;

    return {
      price: execPrice,
      midPrice,
      impact,
      route: `${fromToken.symbol} → ${toToken.symbol}`,
    };
  }, [pool, poolKey, fromToken, toToken, fromAmount, toAmount]);

  // basic slippage check
  const slippageAllowed = (toAmt) => {
    const allowed = toAmt * (1 - slippage / 100);
    return allowed;
  };

  // Simulate swap flow. Replace this with real on-chain flow:
  // - check allowance, call approve if needed
  // - call router.swapExactTokensForTokens or chain-specific function
  const handleSwap = async (e) => {
    e.preventDefault();
    setStatus("");
    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      setStatus("Enter an amount to swap.");
      return;
    }
    if (!pool) {
      setStatus("No pool found for selected pair.");
      return;
    }
    // price impact guard for demo
    if (priceInfo.impact && Math.abs(priceInfo.impact) > 20) {
      const ok = confirm(`High price impact (${priceInfo.impact.toFixed(2)}%). Continue?`);
      if (!ok) return;
    }

    setBusy(true);
    setStatus("Preparing swap (simulated)...");

    // Simulate asynchronous approval & swap; replace with real txs
    await new Promise((r) => setTimeout(r, 1000));
    setStatus("Submitting transaction (simulated)...");
    await new Promise((r) => setTimeout(r, 1400));
    const fakeTx = "0x" + Math.random().toString(16).slice(2, 12);
    setLastTx(fakeTx);
    setStatus("Swap complete (simulated). Tx: " + fakeTx);
    setBusy(false);
  };

  // helpers to open selectors
  const openFromSelect = () => setShowFromSelect(true);
  const openToSelect = () => setShowToSelect(true);

  const selectFrom = (t) => {
    setFromToken(t);
    setShowFromSelect(false);
    setFromAmount("");
    setToAmount("");
  };
  const selectTo = (t) => {
    setToToken(t);
    setShowToSelect(false);
    setFromAmount("");
    setToAmount("");
  };

  return (
    <div className="bg-gradient-to-b from-[#0b1622] to-[#111827] min-h-screen text-white px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-2">Swap tokens</h1>
        <p className="text-center text-blue-400 mb-6">Simple swap UI — connect a wallet to run real swaps (hook your router)</p>

        <div className="bg-[#132030] border border-blue-500 rounded-lg p-5 space-y-4">
          <form onSubmit={handleSwap} className="space-y-4">
            {/* From */}
            <div className="space-y-2">
              <label className="text-xs text-gray-300">From</label>
              <div className="flex gap-3">
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={fromAmount}
                  onChange={(e) => setFromAmount(e.target.value)}
                  placeholder="0.0"
                  className="flex-1 bg-[#0b1420] px-3 py-2 rounded text-sm"
                  aria-label="From amount"
                />
                <button type="button" onClick={openFromSelect} className="bg-[#0b1220] border border-blue-500 px-3 py-2 rounded flex items-center gap-2">
                  <div className="text-sm font-medium">{fromToken.symbol}</div>
                  <FaChevronDown />
                </button>
              </div>
            </div>

            {/* To */}
            <div className="space-y-2">
              <label className="text-xs text-gray-300">To</label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={toAmount}
                  readOnly
                  placeholder="0.0"
                  className="flex-1 bg-[#0b1420] px-3 py-2 rounded text-sm text-gray-300"
                  aria-label="To amount"
                />
                <button type="button" onClick={openToSelect} className="bg-[#0b1220] border border-blue-500 px-3 py-2 rounded flex items-center gap-2">
                  <div className="text-sm font-medium">{toToken.symbol}</div>
                  <FaChevronDown />
                </button>
              </div>
            </div>

            {/* flip */}
            <div className="flex justify-center">
              <button type="button" onClick={flip} className="bg-[#0f2430] px-3 py-2 rounded-full">
                <FaArrowRight />
              </button>
            </div>

            {/* info row */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-gray-400">
              <div>
                <div>Route: <span className="text-gray-200">{priceInfo.route || "—"}</span></div>
                <div>Price: <span className="text-gray-200">{priceInfo.price ? priceInfo.price.toFixed(6) : "—"}</span></div>
                <div>Impact: <span className={Math.abs(priceInfo.impact || 0) > 5 ? "text-yellow-300" : "text-gray-200"}>{priceInfo.impact ? priceInfo.impact.toFixed(2) + "%" : "—"}</span></div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-xs text-gray-300">Slippage</div>
                <div className="flex gap-2 items-center">
                  {[0.1, 0.5, 1].map((s) => (
                    <button key={s} type="button" onClick={() => setSlippage(s)} className={`px-2 py-1 rounded text-sm ${slippage === s ? "bg-blue-500" : "bg-[#0f2430]"}`}>
                      {s}%
                    </button>
                  ))}
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={slippage}
                    onChange={(e) => setSlippage(parseFloat(e.target.value || 0))}
                    className="w-20 px-2 py-1 rounded bg-[#0b1420] text-sm"
                    aria-label="Custom slippage"
                  />
                </div>
              </div>
            </div>

            {/* actions */}
            <div className="flex gap-3 flex-col sm:flex-row">
              <button type="button" onClick={connectWallet} className="flex-1 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded">
                {account ? `Connected: ${account.slice(0, 8)}…` : "Connect Wallet"}
              </button>
              <button type="submit" disabled={busy} className="flex-1 bg-gradient-to-r from-indigo-500 to-pink-500 px-4 py-2 rounded">
                {busy ? "Swapping..." : "Swap"}
              </button>
            </div>

            {status && <div className="text-sm text-gray-300">{status}</div>}
            {lastTx && <div className="text-xs text-blue-300">Tx (sim): <a href="#">{lastTx}</a></div>}
          </form>
        </div>

        {/* token selectors as modals */}
        {(showFromSelect || showToSelect) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-[#0b1420] border border-blue-500 rounded-lg w-full max-w-md p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Select token</h3>
                <button onClick={() => { setShowFromSelect(false); setShowToSelect(false); }} className="text-gray-400">Close</button>
              </div>
              <div className="mb-2">
                <input placeholder="Search token" className="w-full px-3 py-2 rounded bg-[#0b1220]" onChange={() => {}} />
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
          Demo swap uses simulated pools. To enable real swaps, integrate an on-chain router and handle allowances/approvals, slippage checks, and transaction confirmations.
        </div>
      </div>
    </div>
  );
};

export default Swap;
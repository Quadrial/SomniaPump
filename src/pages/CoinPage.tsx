// src/pages/CoinPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { getContract, readContract, prepareContractCall } from "thirdweb";
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { client } from "../client";
import { somniaTestnet } from "thirdweb/chains";
import { FaTelegram, FaTwitter, FaGlobe } from "react-icons/fa6";

/* --------------------------- Helpers --------------------------- */
const formatUnits = (value: bigint, decimals: number) => {
  const s = value.toString().padStart(decimals + 1, "0");
  const i = s.length - decimals;
  const whole = s.slice(0, i) || "0";
  const frac = s.slice(i).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
};

const parseUnits = (value: string, decimals: number): bigint => {
  const clean = (value || "0").trim();
  if (!clean) return 0n;
  const [w, f = ""] = clean.replace(/,/g, "").split(".");
  const frac = (f + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(w || "0") * 10n ** BigInt(decimals) + BigInt(frac || "0");
};

const ipfs2http = (uri?: string) =>
  uri && uri.startsWith("ipfs://")
    ? uri.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/")
    : uri;

const isAddress = (v: string) => /^0x[0-9a-fA-F]{40}$/.test(v);

/* --------------------------- Types ----------------------------- */
type Factory = any;
type TokenMeta = {
  name: string;
  symbol: string;
  description: string;
  imageURI: string;
  twitter: string;
  telegram: string;
  website: string;
};

type Props = { factory: Factory };

/* ---------------------------- Page ----------------------------- */
const CoinPage: React.FC<Props> = ({ factory }) => {
  const { tokenAddress } = useParams<{ tokenAddress: string }>();
  const tokenAddr = (tokenAddress || "").toLowerCase();
  const account = useActiveAccount();
  const { mutateAsync: sendTx, isPending } = useSendTransaction();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [meta, setMeta] = useState<TokenMeta | null>(null);
  const [decimals, setDecimals] = useState(18);
  const [totalSupply, setTotalSupply] = useState<string>("0");

  const [routerAddr, setRouterAddr] = useState<string>("");
  const [wethAddr, setWethAddr] = useState<string>("");

  // UI state for trade
  const [buyEth, setBuyEth] = useState<string>("0.1");
  const [buyOut, setBuyOut] = useState<string>("");
  const [slippage, setSlippage] = useState<number>(1); // %
  const [sellToken, setSellToken] = useState<string>("1000");
  const [sellOut, setSellOut] = useState<string>("");

  // Price
  const [priceEthPerToken, setPriceEthPerToken] = useState<string>("");

  /* ------------------------ Load base data ------------------------ */
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!factory || !tokenAddr || !isAddress(tokenAddr)) {
        setError("Invalid token address");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        // 1) router & WETH from factory
        const [r, w] = await Promise.all([
          readContract({
            contract: factory,
            method: "function router() view returns (address)",
          }) as Promise<string>,
          readContract({
            contract: factory,
            method: "function weth() view returns (address)",
          }) as Promise<string>,
        ]);
        if (cancelled) return;
        setRouterAddr(r);
        setWethAddr(w);

        // 2) metadata from factory
        let tm: TokenMeta;
        try {
          const info: any = await readContract({
            contract: factory,
            method:
              "function getTokenInfo(address) view returns (address token, address creator, string name, string symbol, string description, string imageURI, string twitter, string telegram, string website, uint256 createdAt, bool lpLocked, uint256 lockId)",
            params: [tokenAddr],
          });
          tm = {
            name: info.name ?? info[2] ?? "",
            symbol: info.symbol ?? info[3] ?? "",
            description: info.description ?? info[4] ?? "",
            imageURI: info.imageURI ?? info[5] ?? "",
            twitter: info.twitter ?? info[6] ?? "",
            telegram: info.telegram ?? info[7] ?? "",
            website: info.website ?? info[8] ?? "",
          };
        } catch {
          const m: any = await readContract({
            contract: factory,
            method:
              "function getTokenMetadata(address) view returns (string name, string symbol, string description, string imageURI, string twitter, string telegram, string website)",
            params: [tokenAddr],
          });
          tm = {
            name: m.name ?? m[0] ?? "",
            symbol: m.symbol ?? m[1] ?? "",
            description: m.description ?? m[2] ?? "",
            imageURI: m.imageURI ?? m[3] ?? "",
            twitter: m.twitter ?? m[4] ?? "",
            telegram: m.telegram ?? m[5] ?? "",
            website: m.website ?? m[6] ?? "",
          };
        }
        if (cancelled) return;
        setMeta(tm);

        // 3) ERC-20 data
        const token = getContract({
          client,
          chain: somniaTestnet,
          address: tokenAddr,
        });
        const [d, ts] = await Promise.all([
          readContract({
            contract: token,
            method: "function decimals() view returns (uint8)",
          }).catch(() => 18),
          readContract({
            contract: token,
            method: "function totalSupply() view returns (uint256)",
          }).catch(() => 0n),
        ]);
        if (cancelled) return;
        const dec = Number(d || 18);
        setDecimals(dec);
        setTotalSupply(typeof ts === "bigint" ? formatUnits(ts, dec) : "0");
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load token data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [factory, tokenAddr]);

  const router = useMemo(() => {
    if (!routerAddr) return null;
    return getContract({ client, chain: somniaTestnet, address: routerAddr });
  }, [routerAddr]);

  const token = useMemo(() => {
    if (!tokenAddr || !isAddress(tokenAddr)) return null;
    return getContract({ client, chain: somniaTestnet, address: tokenAddr });
  }, [tokenAddr]);

  const weth = useMemo(() => {
    if (!wethAddr) return null;
    return getContract({ client, chain: somniaTestnet, address: wethAddr });
  }, [wethAddr]);

  /* ------------------------ Current price ------------------------ */
  useEffect(() => {
    let cancelled = false;
    const loadPrice = async () => {
      setPriceEthPerToken("");
      if (!router || !wethAddr || !tokenAddr) return;
      try {
        // Quote 1 token -> WETH to get price in ETH
        const oneToken = 10n ** BigInt(decimals);
        const out: any = await readContract({
          contract: router,
          method:
            "function getAmountsOut(uint amountIn, address[] path) view returns (uint[] memory amounts)",
          params: [oneToken, [tokenAddr, wethAddr]],
        });
        if (cancelled) return;
        const wethOut = Array.isArray(out)
          ? (out[out.length - 1] as bigint)
          : 0n;
        setPriceEthPerToken(formatUnits(wethOut, 18));
      } catch {
        // No liquidity or router error => leave blank
      }
    };
    loadPrice();
    return () => {
      cancelled = true;
    };
  }, [router, tokenAddr, wethAddr, decimals]);

  /* ------------------------ Quote (Buy) ------------------------ */
  useEffect(() => {
    let cancelled = false;
    const quote = async () => {
      setBuyOut("");
      if (!router || !wethAddr || !tokenAddr || !buyEth) return;
      try {
        const amountIn = parseUnits(buyEth, 18); // ETH/WETH is 18
        if (amountIn <= 0n) return;
        const out: any = await readContract({
          contract: router,
          method:
            "function getAmountsOut(uint amountIn, address[] path) view returns (uint[] memory amounts)",
          params: [amountIn, [wethAddr, tokenAddr]],
        });
        if (cancelled) return;
        const outRaw = Array.isArray(out)
          ? (out[out.length - 1] as bigint)
          : 0n;
        setBuyOut(formatUnits(outRaw, decimals));
      } catch {
        // ignore
      }
    };
    quote();
    return () => {
      cancelled = true;
    };
  }, [router, wethAddr, tokenAddr, buyEth, decimals]);

  /* ------------------------ Quote (Sell) ----------------------- */
  useEffect(() => {
    let cancelled = false;
    const quote = async () => {
      setSellOut("");
      if (!router || !wethAddr || !tokenAddr || !sellToken) return;
      try {
        const amountIn = parseUnits(sellToken, decimals);
        if (amountIn <= 0n) return;
        const out: any = await readContract({
          contract: router,
          method:
            "function getAmountsOut(uint amountIn, address[] path) view returns (uint[] memory amounts)",
          params: [amountIn, [tokenAddr, wethAddr]],
        });
        if (cancelled) return;
        const outRaw = Array.isArray(out)
          ? (out[out.length - 1] as bigint)
          : 0n;
        setSellOut(formatUnits(outRaw, 18)); // WETH/ETH 18
      } catch {
        // ignore
      }
    };
    quote();
    return () => {
      cancelled = true;
    };
  }, [router, wethAddr, tokenAddr, sellToken, decimals]);

  /* ------------------------ Buy action (ETH->WETH->TOKEN) ------------------------ */
  const onBuy = async () => {
    if (!account?.address || !router || !weth || !tokenAddr) return;
    try {
      const amountIn = parseUnits(buyEth || "0", 18);
      if (amountIn <= 0n) return;
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

      // 1) Wrap ETH to WETH
      const depositTx = prepareContractCall({
        contract: weth,
        method: "function deposit() payable",
        params: [],
        value: amountIn,
      });
      await sendTx(depositTx);

      // 2) Approve router to spend WETH
      const approveWethTx = prepareContractCall({
        contract: weth,
        method:
          "function approve(address spender, uint256 amount) returns (bool)",
        params: [routerAddr, amountIn],
      });
      await sendTx(approveWethTx);

      // 3) Compute minOut with slippage
      const out: any = await readContract({
        contract: router,
        method:
          "function getAmountsOut(uint amountIn, address[] path) view returns (uint[] memory amounts)",
        params: [amountIn, [wethAddr, tokenAddr]],
      });
      const outRaw = Array.isArray(out) ? (out[out.length - 1] as bigint) : 0n;
      const minOut =
        (outRaw * BigInt(Math.floor((100 - slippage) * 100))) / 10000n;

      // 4) Swap WETH -> TOKEN
      const swapTx = prepareContractCall({
        contract: router,
        method:
          "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[] amounts)",
        params: [
          amountIn,
          minOut,
          [wethAddr, tokenAddr],
          account.address,
          deadline,
        ],
      });
      await sendTx(swapTx);
    } catch (e: any) {
      setError(e?.message || "Buy failed");
    }
  };

  /* ------------------------ Sell action (TOKEN->WETH) ------------------------ */
  const onSell = async () => {
    if (!account?.address || !router || !token || !wethAddr) return;
    try {
      const amountIn = parseUnits(sellToken || "0", decimals);
      if (amountIn <= 0n) return;
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

      // 1) Approve router to spend TOKEN
      const approveTokenTx = prepareContractCall({
        contract: token,
        method:
          "function approve(address spender, uint256 amount) returns (bool)",
        params: [routerAddr, amountIn],
      });
      await sendTx(approveTokenTx);

      // 2) Compute minOut with slippage
      const out: any = await readContract({
        contract: router,
        method:
          "function getAmountsOut(uint amountIn, address[] path) view returns (uint[] memory amounts)",
        params: [amountIn, [tokenAddr, wethAddr]],
      });
      const outRaw = Array.isArray(out) ? (out[out.length - 1] as bigint) : 0n;
      const minOut =
        (outRaw * BigInt(Math.floor((100 - slippage) * 100))) / 10000n;

      // 3) Swap TOKEN -> WETH (user ends up with WETH)
      const swapTx = prepareContractCall({
        contract: router,
        method:
          "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[] amounts)",
        params: [
          amountIn,
          minOut,
          [tokenAddr, wethAddr],
          account.address,
          deadline,
        ],
      });
      await sendTx(swapTx);

      // Optional extra step: let user unwrap WETH -> ETH in a separate button/flow:
      // prepareContractCall({ contract: weth, method: "function withdraw(uint256 wad)", params: [amountOut] })
    } catch (e: any) {
      setError(e?.message || "Sell failed");
    }
  };

  /* ----------------------------- UI ---------------------------- */
  if (!tokenAddr || !isAddress(tokenAddr)) {
    return (
      <div className="p-8 text-center text-red-400">Invalid token address</div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-300">
        Loading token details…
      </div>
    );
  }

  if (error) {
    return <div className="p-8 text-center text-red-400">Failed: {error}</div>;
  }

  return (
    <div className="bg-gradient-to-b from-[#0b1622] to-[#111827] min-h-screen text-white px-4 md:px-12 lg:px-32 py-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-6 md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <img
            src={
              ipfs2http(meta?.imageURI) ||
              "https://placehold.co/80x80/1e293b/9ca3af?text=No+Image"
            }
            onError={(e) => {
              e.currentTarget.src =
                "https://placehold.co/80x80/1e293b/9ca3af?text=No+Image";
            }}
            alt={`${meta?.symbol || "Token"} logo`}
            className="w-20 h-20 rounded-md object-cover border border-blue-500/40"
          />
          <div>
            <h1 className="text-2xl font-bold">
              {meta?.name}{" "}
              <span className="text-gray-300">({meta?.symbol})</span>
            </h1>
            <p className="text-sm text-blue-300 break-all">{tokenAddr}</p>
            {meta?.description && (
              <p className="text-sm text-gray-300 mt-2 max-w-2xl">
                {meta.description}
              </p>
            )}
            <div className="flex gap-2 mt-2">
              {meta?.twitter && (
                <a
                  href={
                    meta.twitter.startsWith("http")
                      ? meta.twitter
                      : `https://${meta.twitter}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-blue-500 p-2 rounded hover:bg-blue-600 transition"
                  aria-label="Twitter"
                >
                  <FaTwitter />
                </a>
              )}
              {meta?.telegram && (
                <a
                  href={
                    meta.telegram.startsWith("http")
                      ? meta.telegram
                      : `https://${meta.telegram}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-blue-500 p-2 rounded hover:bg-blue-600 transition"
                  aria-label="Telegram"
                >
                  <FaTelegram />
                </a>
              )}
              {meta?.website && (
                <a
                  href={
                    meta.website.startsWith("http")
                      ? meta.website
                      : `https://${meta.website}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-blue-500 p-2 rounded hover:bg-blue-600 transition"
                  aria-label="Website"
                >
                  <FaGlobe />
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="text-sm text-gray-300">
          <div>
            Total Supply: <span className="text-green-400">{totalSupply}</span>
          </div>
          <div>
            Decimals: <span className="text-blue-300">{decimals}</span>
          </div>
          <div>
            Price:{" "}
            <span className="text-yellow-300">{priceEthPerToken || "—"}</span>{" "}
            ETH per {meta?.symbol}
          </div>
        </div>
      </div>

      {/* Trade panels */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Buy */}
        <div className="bg-[#132030] border border-blue-500 rounded-lg p-4">
          <h2 className="font-semibold text-lg mb-3">Buy {meta?.symbol}</h2>
          <label className="text-sm text-gray-300">Pay (ETH)</label>
          <input
            type="text"
            value={buyEth}
            onChange={(e) => setBuyEth(e.target.value)}
            className="w-full mt-1 px-3 py-2 rounded bg-[#0f1a28] border border-blue-500/40"
          />
          <div className="mt-2 text-sm text-gray-300">
            Est. receive:{" "}
            <span className="text-green-400">{buyOut || "-"}</span>{" "}
            {meta?.symbol}
          </div>
          <div className="mt-2 text-sm text-gray-300">
            Slippage:
            <input
              type="number"
              min={0}
              max={50}
              value={slippage}
              onChange={(e) => setSlippage(Number(e.target.value))}
              className="ml-2 w-20 px-2 py-1 rounded bg-[#0f1a28] border border-blue-500/40"
            />
            %
          </div>
          <button
            onClick={onBuy}
            disabled={!account || isPending || !routerAddr}
            className="mt-4 w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-2 rounded"
          >
            {account
              ? isPending
                ? "Processing…"
                : `Buy ${meta?.symbol}`
              : "Connect wallet to buy"}
          </button>
        </div>

        {/* Sell */}
        <div className="bg-[#132030] border border-blue-500 rounded-lg p-4">
          <h2 className="font-semibold text-lg mb-3">Sell {meta?.symbol}</h2>
          <label className="text-sm text-gray-300">
            Amount ({meta?.symbol})
          </label>
          <input
            type="text"
            value={sellToken}
            onChange={(e) => setSellToken(e.target.value)}
            className="w-full mt-1 px-3 py-2 rounded bg-[#0f1a28] border border-blue-500/40"
          />
          <div className="mt-2 text-sm text-gray-300">
            Est. receive:{" "}
            <span className="text-green-400">{sellOut || "-"}</span> ETH (as
            WETH)
          </div>
          <div className="mt-2 text-sm text-gray-300">
            Slippage:
            <input
              type="number"
              min={0}
              max={50}
              value={slippage}
              onChange={(e) => setSlippage(Number(e.target.value))}
              className="ml-2 w-20 px-2 py-1 rounded bg-[#0f1a28] border border-blue-500/40"
            />
            %
          </div>
          <button
            onClick={onSell}
            disabled={!account || isPending || !routerAddr}
            className="mt-4 w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2 rounded"
          >
            {account
              ? isPending
                ? "Processing…"
                : `Sell ${meta?.symbol}`
              : "Connect wallet to sell"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CoinPage;

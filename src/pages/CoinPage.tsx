import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { getContract, readContract, prepareContractCall } from "thirdweb";
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { client } from "../client";
import { somniaTestnet } from "thirdweb/chains";
import { FaTelegram, FaTwitter, FaGlobe } from "react-icons/fa6";
import PriceChart from "../components/PriceChart";

/* Helpers */
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
  uri?.startsWith("ipfs://")
    ? uri.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/")
    : uri;
const isAddress = (v: string) => /^0x[0-9a-fA-F]{40}$/.test(v);

/* Types */
type Props = { factory: any; router: any };
type TokenMeta = {
  name: string;
  symbol: string;
  description: string;
  imageURI: string;
  twitter: string;
  telegram: string;
  website: string;
};

export default function CoinPage({ factory, router }: Props) {
  const { tokenAddress } = useParams<{ tokenAddress: string }>();
  const tokenAddr = (tokenAddress || "").toLowerCase();
  const account = useActiveAccount();
  const { mutateAsync: sendTx, isPending } = useSendTransaction();

  const [meta, setMeta] = useState<TokenMeta | null>(null);
  const [decimals, setDecimals] = useState(18);
  const [totalSupply, setTotalSupply] = useState("0");
  const [wethAddr, setWethAddr] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [priceEthPerToken, setPriceEthPerToken] = useState(""); // Current price (ETH per token)
  const [priceHistory, setPriceHistory] = useState<
    { timestamp: number; price: string }[]
  >([]);
  const [userBalance, setUserBalance] = useState("0");

  // Trade form state
  const [buyEth, setBuyEth] = useState("0.1");
  const [buyOut, setBuyOut] = useState("");
  const [sellToken, setSellToken] = useState("1000");
  const [sellOut, setSellOut] = useState("");
  const [slippage, setSlippage] = useState(1);

  /** ---------------- Contracts ---------------- */
  const token = useMemo(() => {
    if (!tokenAddr || !isAddress(tokenAddr)) return null;
    return getContract({ client, chain: somniaTestnet, address: tokenAddr });
  }, [tokenAddr]);

  const weth = useMemo(() => {
    if (!wethAddr) return null;
    return getContract({ client, chain: somniaTestnet, address: wethAddr });
  }, [wethAddr]);

  /** ---------------- Load token + factory data ---------------- */
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!factory || !router || !tokenAddr || !isAddress(tokenAddr)) {
        setError("Invalid token address");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        // Read WETH from factory
        const w = (await readContract({
          contract: factory,
          method: "function weth() view returns (address)",
        })) as string;
        if (cancelled) return;
        setWethAddr(w);

        // metadata
        let tm: TokenMeta;
        try {
          const info: any = await readContract({
            contract: factory,
            method:
              "function getTokenInfo(address) view returns (address token, address creator, string name, string symbol, string description, string imageURI, string twitter, string telegram, string website, uint256 createdAt, bool lpLocked, uint256 lockId)",
            params: [tokenAddr],
          });
          tm = {
            name: info?.name ?? info[2] ?? "",
            symbol: info?.symbol ?? info[3] ?? "",
            description: info?.description ?? info[4] ?? "",
            imageURI: info?.imageURI ?? info[5] ?? "",
            twitter: info?.twitter ?? info[6] ?? "",
            telegram: info?.telegram ?? info[7] ?? "",
            website: info?.website ?? info[8] ?? "",
          };
        } catch {
          const m: any = await readContract({
            contract: factory,
            method:
              "function getTokenMetadata(address) view returns (string name, string symbol, string description, string imageURI, string twitter, string telegram, string website)",
            params: [tokenAddr],
          });
          tm = {
            name: m[0] ?? "",
            symbol: m[1] ?? "",
            description: m[2] ?? "",
            imageURI: m[3] ?? "",
            twitter: m[4] ?? "",
            telegram: m[5] ?? "",
            website: m[6] ?? "",
          };
        }
        if (cancelled) return;
        setMeta(tm);

        // ERC20 details
        if (token) {
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
        }
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
  }, [factory, router, tokenAddr, token]);

  /** ---------------- Load user balance ---------------- */
  useEffect(() => {
    let cancelled = false;
    const loadBalance = async () => {
      if (!token || !account?.address) {
        setUserBalance("0");
        return;
      }
      try {
        const bal: bigint = await readContract({
          contract: token,
          method: "function balanceOf(address owner) view returns (uint256)",
          params: [account.address],
        });
        if (cancelled) return;
        setUserBalance(formatUnits(bal, decimals));
      } catch {
        if (!cancelled) setUserBalance("0");
      }
    };
    loadBalance();
    return () => {
      cancelled = true;
    };
  }, [token, account?.address, decimals, isPending]);

  /** ---------------- Load price, quotes ---------------- */
  useEffect(() => {
    let cancelled = false;
    const loadPrice = async () => {
      setPriceEthPerToken("");
      if (!router || !wethAddr || !tokenAddr) return;
      try {
        const oneToken = 10n ** BigInt(decimals);
        const out: any = await readContract({
          contract: router,
          method:
            "function getAmountsOut(uint amountIn, address[] path) view returns (uint[] memory amounts)",
          params: [oneToken, [tokenAddr, wethAddr]],
        });
        if (cancelled) return;
        const wOut = Array.isArray(out) ? (out[out.length - 1] as bigint) : 0n;
        const formattedPrice = formatUnits(wOut, 18);
        setPriceEthPerToken(formattedPrice);

        // Update price history
        setPriceHistory((prev) => {
          const now = Date.now();
          const newEntry = { timestamp: now, price: formattedPrice };

          // Only add new entry if price has changed significantly or enough time has passed
          if (prev.length === 0) {
            return [newEntry];
          }

          const lastEntry = prev[prev.length - 1];
          const timeDiff = now - lastEntry.timestamp;
          const priceDiff = Math.abs(
            parseFloat(formattedPrice) - parseFloat(lastEntry.price)
          );

          // Add new entry if:
          // 1. Price has changed by more than 0.1%
          // 2. More than 30 seconds have passed since last entry
          if (
            priceDiff > parseFloat(lastEntry.price) * 0.001 ||
            timeDiff > 30000
          ) {
            // Keep only the last 100 entries
            const updated = [...prev, newEntry];
            return updated.length > 100 ? updated.slice(-100) : updated;
          }

          return prev;
        });
      } catch {}
    };
    loadPrice();
    return () => {
      cancelled = true;
    };
  }, [router, tokenAddr, wethAddr, decimals]);

  // Buy quote WETH->TOKEN
  useEffect(() => {
    let cancelled = false;
    const quote = async () => {
      setBuyOut("");
      if (!router || !wethAddr || !tokenAddr || !buyEth) return;
      try {
        const amountIn = parseUnits(buyEth, 18);
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
      } catch {}
    };
    quote();
    return () => {
      cancelled = true;
    };
  }, [router, wethAddr, tokenAddr, buyEth, decimals]);

  // Sell quote TOKEN->WETH
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
        setSellOut(formatUnits(outRaw, 18));
      } catch {}
    };
    quote();
    return () => {
      cancelled = true;
    };
  }, [router, wethAddr, tokenAddr, sellToken, decimals]);

  // Buy: ETH->WETH->TOKEN
  const onBuy = async () => {
    if (!account?.address || !router || !weth || !tokenAddr) return;
    try {
      const amountIn = parseUnits(buyEth || "0", 18);
      if (amountIn <= 0n) return;
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

      // Wrap ETH
      await sendTx(
        prepareContractCall({
          contract: weth,
          method: "function deposit() payable",
          params: [],
          value: amountIn,
        })
      );

      // Approve router to spend WETH
      await sendTx(
        prepareContractCall({
          contract: weth,
          method:
            "function approve(address spender, uint256 amount) returns (bool)",
          params: [router.address, amountIn],
        })
      );

      // Min out
      const quoted: any = await readContract({
        contract: router,
        method:
          "function getAmountsOut(uint amountIn, address[] path) view returns (uint[] memory amounts)",
        params: [amountIn, [wethAddr, tokenAddr]],
      });
      const qOut = Array.isArray(quoted)
        ? (quoted[quoted.length - 1] as bigint)
        : 0n;
      const minOut =
        (qOut * BigInt(Math.floor((100 - slippage) * 100))) / 10000n;

      // Swap WETH -> TOKEN
      await sendTx(
        prepareContractCall({
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
        })
      );
    } catch (e: any) {
      setError(e?.message || "Buy failed");
    }
  };

  // Sell: TOKEN->WETH
  const onSell = async () => {
    if (!account?.address || !router || !token || !wethAddr) return;
    try {
      const amountIn = parseUnits(sellToken || "0", decimals);
      if (amountIn <= 0n) return;
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

      // Approve router to spend TOKEN
      await sendTx(
        prepareContractCall({
          contract: token,
          method:
            "function approve(address spender, uint256 amount) returns (bool)",
          params: [router.address, amountIn],
        })
      );

      // Min out
      const quoted: any = await readContract({
        contract: router,
        method:
          "function getAmountsOut(uint amountIn, address[] path) view returns (uint[] memory amounts)",
        params: [amountIn, [tokenAddr, wethAddr]],
      });
      const qOut = Array.isArray(quoted)
        ? (quoted[quoted.length - 1] as bigint)
        : 0n;
      const minOut =
        (qOut * BigInt(Math.floor((100 - slippage) * 100))) / 10000n;

      // Swap TOKEN -> WETH (user ends with WETH)
      await sendTx(
        prepareContractCall({
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
        })
      );
    } catch (e: any) {
      setError(e?.message || "Sell failed");
    }
  };

  if (!tokenAddr || !isAddress(tokenAddr)) {
    return (
      <div className="p-8 text-center text-red-400">Invalid token address</div>
    );
  }
  if (loading)
    return (
      <div className="p-8 text-center text-gray-300">
        Loading token details…
      </div>
    );
  if (error)
    return <div className="p-8 text-center text-red-400">Failed: {error}</div>;

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

        {/* left meta ... */}
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
            ETH
          </div>
          {account?.address && (
            <div>
              Your Balance:{" "}
              <span className="text-purple-400">
                {userBalance} {meta?.symbol}
              </span>
            </div>
          )}
        </div>
      </div>

      <PriceChart priceHistory={priceHistory} />

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
            disabled={!account || isPending || !router}
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
          <h2 className="font-semibold text-lg">Sell {meta?.symbol}</h2>
          {account?.address && (
            <div className="text-xs text-gray-400 mb-1">
              Available: <span className="text-purple-400">{userBalance}</span>{" "}
              {meta?.symbol}
            </div>
          )}
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
            disabled={!account || isPending || !router}
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
}
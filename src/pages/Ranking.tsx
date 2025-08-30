// Ranking.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { readContract, getContract } from "thirdweb";
import { client } from "../client";
import { somniaTestnet } from "thirdweb/chains";

// Format units helper
const formatUnits = (value: bigint, decimals: number) => {
  const s = value.toString().padStart(decimals + 1, "0");
  const i = s.length - decimals;
  const whole = s.slice(0, i) || "0";
  const frac = s.slice(i).replace(/0+$/, ""); // Remove trailing zeros from fraction
  return frac ? `${whole}.${frac}` : whole;
};

// Token type definition
type Token = {
  id: number;
  name: string;
  symbol: string;
  price: number;
  liquidity: number;
  volume24: number;
  change24: number;
  ageHours: number;
  lpLocked: boolean;
  ownerRenounced: boolean;
  spark: number[];
  address: string;
  marketCap: number;
  decimals: number;
  totalSupply: string;
};

// Props type
type Props = { contract: any };

// Fetch token metadata helper
async function fetchTokenMetadata(factoryContract: any, tokenAddr: string) {
  try {
    const metadataArray = await readContract({
      contract: factoryContract,
      method:
        "function getTokenMetadata(address) view returns (string name, string symbol, string description, string imageURI, string twitter, string telegram, string website)",
      params: [tokenAddr],
    });

    if (!Array.isArray(metadataArray) || metadataArray.length !== 7) {
      return {
        name: "",
        symbol: "",
        description: "",
        imageURI: "",
        twitter: "",
        telegram: "",
        website: "",
      };
    }

    const [name, symbol] = metadataArray;
    return { name, symbol };
  } catch (e: any) {
    console.warn(`Could not fetch metadata for ${tokenAddr}:`, e.message);
    return { name: "", symbol: "" };
  }
}

// Fetch tokens from contract
async function getTokens(
  contract: any,
  routerContract: any,
  wethAddr: string,
  sort: string,
  page: number,
  pageSize: number,
  q: string
) {
  if (!contract || !wethAddr) return { items: [], total: 0, page, pageSize };

  try {
    // Get the total number of tokens
    const countBn = (await readContract({
      contract,
      method: "function totalTokens() view returns (uint256)",
      params: [],
    })) as bigint;

    const count = Number(countBn || 0n);
    if (count === 0) {
      return { items: [], total: 0, page, pageSize };
    }

    // Read each token address by index
    const addresses = await Promise.all(
      Array.from({ length: count }).map(async (_v, i) => {
        try {
          return (await readContract({
            contract,
            method: "function tokenAt(uint256) view returns (address)",
            params: [BigInt(i)],
          })) as string;
        } catch {
          return (await readContract({
            contract,
            method: "function tokensList(uint256) view returns (address)",
            params: [BigInt(i)],
          })) as string;
        }
      })
    );

    // For each token address, fetch ERC‑20 info and metadata
    const tokensWithMarketCap = await Promise.all(
      addresses.map(async (addr, index) => {
        // Get basic ERC‑20 info from the token contract itself
        const erc20 = getContract({
          client,
          chain: somniaTestnet,
          address: addr,
        });

        const [rawName, rawSymbol, rawDecimals, rawTotalSupply] =
          await Promise.all([
            readContract({
              contract: erc20,
              method: "function name() view returns (string)",
            }).catch(() => "Unknown"),
            readContract({
              contract: erc20,
              method: "function symbol() view returns (string)",
            }).catch(() => "???"),
            readContract({
              contract: erc20,
              method: "function decimals() view returns (uint8)",
            }).catch(() => 18),
            readContract({
              contract: erc20,
              method: "function totalSupply() view returns (uint256)",
            }).catch(() => 0n),
          ]);

        const decimals = Number(rawDecimals ?? 18);
        const totalSupply =
          typeof rawTotalSupply === "bigint"
            ? formatUnits(rawTotalSupply, decimals)
            : "0";

        // Fetch metadata
        const metadata = await fetchTokenMetadata(contract, addr);

        // Calculate market cap in ETH
        let marketCapEth = 0;
        let priceEth = 0;
        if (routerContract && wethAddr) {
          try {
            // Get price of 1 token in ETH
            const oneToken = 10n ** BigInt(decimals);
            const out: any = await readContract({
              contract: routerContract,
              method:
                "function getAmountsOut(uint amountIn, address[] path) view returns (uint[] memory amounts)",
              params: [oneToken, [addr, wethAddr]],
            });

            if (Array.isArray(out) && out.length > 0) {
              const wOut = out[out.length - 1] as bigint;
              const priceEthPerToken = parseFloat(formatUnits(wOut, 18));
              priceEth = priceEthPerToken;

              // Calculate market cap: price per token * total supply
              const totalSupplyBigInt =
                typeof rawTotalSupply === "bigint" ? rawTotalSupply : 0n;
              const marketCapWei = (wOut * totalSupplyBigInt) / oneToken;
              marketCapEth = parseFloat(formatUnits(marketCapWei, 18));
            }
          } catch (e) {
            console.warn(`Could not fetch market cap for ${addr}:`, e);
          }
        }

        // Generate mock sparkline data based on price
        const spark = Array.from({ length: 12 }).map(
          () => +(priceEth * (0.8 + Math.random() * 0.4)).toFixed(4)
        );

        // Return token object with all required fields
        return {
          id: index,
          name: metadata.name || `${rawName}`,
          symbol: metadata.symbol || `${rawSymbol}`,
          price: priceEth,
          liquidity: marketCapEth * 0.3, // Mock liquidity as 30% of market cap
          volume24: marketCapEth * 0.1, // Mock volume as 10% of market cap
          change24: +(Math.random() * 20 - 10).toFixed(2), // Random change between -10% and +10%
          ageHours: Math.round(Math.random() * 720), // Random age up to 30 days
          lpLocked: Math.random() > 0.6, // 40% chance of locked LP
          ownerRenounced: Math.random() > 0.8, // 20% chance of renounced owner
          spark, // array of recent price points for sparkline
          address: addr,
          marketCap: marketCapEth,
          decimals,
          totalSupply,
        };
      })
    );

    // Filter by search query
    const filtered = tokensWithMarketCap.filter(
      (t) =>
        t.name.toLowerCase().includes(q.toLowerCase()) ||
        t.symbol.toLowerCase().includes(q.toLowerCase()) ||
        t.address.toLowerCase().includes(q.toLowerCase())
    );

    // Sort tokens
    const [key, dir] = sort.split("_");
    filtered.sort((a, b) => {
      let va: any = (a as any)[key];
      let vb: any = (b as any)[key];

      if (key === "change24") {
        va = a.change24;
        vb = b.change24;
      }

      if (va === vb) return 0;
      return dir === "asc" ? va - vb : vb - va;
    });

    // Pagination
    const start = (page - 1) * pageSize;
    const pageItems = filtered.slice(start, start + pageSize);

    return {
      items: pageItems,
      total: filtered.length,
      page,
      pageSize,
    };
  } catch (err) {
    console.error("Failed to fetch tokens:", err);
    return { items: [], total: 0, page, pageSize };
  }
}

// Simple inline sparkline component using SVG
const Sparkline = ({
  points = [] as number[],
  width = 100,
  height = 28,
  stroke = "#4F46E5",
}) => {
  if (!points || points.length === 0) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const stepX = width / (points.length - 1);
  const coords = points
    .map((p, i) => {
      const x = i * stepX;
      const y = height - ((p - min) / range) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="inline-block"
    >
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={coords}
      />
    </svg>
  );
};

const SORT_OPTIONS = [
  { value: "liquidity_desc", label: "Liquidity ↓" },
  { value: "liquidity_asc", label: "Liquidity ↑" },
  { value: "volume24_desc", label: "24h Volume ↓" },
  { value: "price_desc", label: "Price ↓" },
  { value: "change24_desc", label: "24h % ↓" },
  { value: "ageHours_asc", label: "Newest" },
  { value: "marketCap_desc", label: "Market Cap ↓" },
];

const Ranking: React.FC<Props> = ({ contract }) => {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("liquidity_desc");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [loading, setLoading] = useState(false);
  const [wethAddr, setWethAddr] = useState("");
  const [data, setData] = useState({
    items: [] as Token[],
    total: 0,
    page: 1,
    pageSize: 12,
  });

  // Get router contract
  const routerContract = useMemo(() => {
    if (!wethAddr) return null;
    return getContract({
      client,
      chain: somniaTestnet,
      address: "0x8a5735ab1497e8b476072df1941c9dfc3e2bd9eb", // Router address from MyRoutes
    });
  }, [wethAddr]);

  // Fetch WETH address from factory contract
  useEffect(() => {
    const fetchWethAddress = async () => {
      if (!contract) return;
      try {
        const weth = await readContract({
          contract,
          method: "function weth() view returns (address)",
        });
        setWethAddr(weth as string);
      } catch (e) {
        console.error("Failed to fetch WETH address:", e);
      }
    };
    fetchWethAddress();
  }, [contract]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    // Only fetch tokens when we have both contract and wethAddr
    if (!contract || !wethAddr) {
      setLoading(false);
      return;
    }

    getTokens(contract, routerContract, wethAddr, sort, page, pageSize, q).then(
      (res) => {
        if (!mounted) return;
        setData(res);
        setLoading(false);
      }
    );
    return () => {
      mounted = false;
    };
  }, [contract, wethAddr, routerContract, page, pageSize, q, sort]);

  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));

  const onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQ(e.target.value);
    setPage(1);
  };

  const handleSort = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSort(e.target.value);
    setPage(1);
  };

  const items = data.items || [];

  return (
    <div className="bg-gradient-to-b from-[#0b1622] to-[#111827] min-h-screen min-w-screen md:px-20 lg:px-40 p-4 max-w-6xl mx-auto">
      <header className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-[#3f5877] text-2xl font-semibold">
          Token Rankings
        </h1>

        <div className="flex gap-2 items-center">
          <input
            aria-label="Search tokens"
            value={q}
            onChange={onSearchChange}
            placeholder="Search name, symbol, address..."
            className="bg-[#3f5877] px-3 py-2 border rounded-md w-64 focus:outline-none"
          />

          <select
            value={sort}
            onChange={handleSort}
            className="bg-[#3f5877] px-3 py-2 border rounded-md"
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <main>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: pageSize }).map((_, i) => (
              <div
                key={i}
                className="border rounded-lg p-4 animate-pulse bg-white/50 h-28"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No tokens found.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((t) => (
              <div
                key={t.id}
                className="border rounded-lg p-4 bg-white shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center text-white font-bold">
                        {t.symbol.slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-medium">
                          {t.name}{" "}
                          <span className="text-xs text-gray-400">
                            ({t.symbol})
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          Addr: {t.address.slice(0, 8)}…{t.address.slice(-6)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm text-gray-500">Price</div>
                    <div className="font-semibold">
                      {t.price.toFixed(8)} ETH
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <Sparkline
                      points={t.spark}
                      width={120}
                      height={28}
                      stroke={t.change24 >= 0 ? "#16A34A" : "#DC2626"}
                    />
                  </div>

                  <div className="text-right text-xs text-gray-500">
                    <div>
                      24h:{" "}
                      <span
                        className={
                          t.change24 >= 0 ? "text-green-600" : "text-red-600"
                        }
                      >
                        {t.change24}%
                      </span>
                    </div>
                    <div>Vol: ${t.volume24.toLocaleString()}</div>
                    <div>LP: ${t.liquidity.toLocaleString()}</div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs">
                  <div className="flex gap-2 items-center">
                    {t.lpLocked ? (
                      <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded">
                        LP locked
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-yellow-50 text-yellow-700 rounded">
                        LP unlocked
                      </span>
                    )}
                    {t.ownerRenounced ? (
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded">
                        Owner renounced
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-red-50 text-red-700 rounded">
                        Has owner
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Link
                      className="text-blue-600 text-sm"
                      to={`/coin/${t.address}`}
                    >
                      Buy
                    </Link>
                    <a
                      className="text-gray-600"
                      href={`#`}
                      onClick={(e) => e.preventDefault()}
                    >
                      Details
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="mt-6 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Showing page {page} of {totalPages} — {data.total} tokens
        </div>

        <div className="flex gap-2 items-center">
          <button
            className="px-3 py-1 border rounded disabled:opacity-50"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Prev
          </button>

          <div className="text-sm">{page}</div>

          <button
            className="px-3 py-1 border rounded disabled:opacity-50"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Next
          </button>
        </div>
      </footer>
    </div>
  );
};

export default Ranking;

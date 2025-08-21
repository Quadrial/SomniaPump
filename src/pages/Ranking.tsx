// Ranking.jsx
import React, { useEffect, useMemo, useState } from "react";

/*
Mock API: replace getTokens with your real API call.
API response shape is defined below so your backend can match it.
*/

async function getTokens({ page = 1, pageSize = 12, q = "", sort = "liquidity_desc", filters = {} } = {}) {
  // Simulate latency
  await new Promise((r) => setTimeout(r, 180));

  // Generate mock tokens (for demo). Replace with fetch("/api/tokens?...") in prod.
  const all = Array.from({ length: 56 }).map((_, i) => {
    const id = 1000 + i;
    const liquidity = Math.round((Math.random() * 50000) + 1000);
    const volume24 = Math.round(liquidity * (Math.random() * 0.3));
    const price = +(Math.random() * 5).toFixed(4);
    const change24 = (Math.random() * 20 - 10).toFixed(2); // -10% .. +10%
    const ageHours = Math.round(Math.random() * 720);
    const lpLocked = Math.random() > 0.6;
    const ownerRenounced = Math.random() > 0.8;
    const spark = Array.from({ length: 12 }).map(() => +(price * (0.8 + Math.random() * 0.4)).toFixed(4));
    return {
      id,
      name: `Token${id}`,
      symbol: `T${id}`,
      price,
      liquidity,
      volume24,
      change24: parseFloat(change24),
      ageHours,
      lpLocked,
      ownerRenounced,
      spark, // array of recent price points for sparkline
      address: `0x${(Math.random() * 1e18).toString(16).slice(0, 20)}`,
    };
  });

  // Filter q by name/symbol
  const filtered = all.filter(
    (t) =>
      t.name.toLowerCase().includes(q.toLowerCase()) ||
      t.symbol.toLowerCase().includes(q.toLowerCase()) ||
      t.address.toLowerCase().includes(q.toLowerCase())
  );

  // Sort
  const [key, dir] = sort.split("_");
  filtered.sort((a, b) => {
    let va = a[key];
    let vb = b[key];
    if (key === "change24") { // numeric
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
}

// Simple inline sparkline component using SVG
const Sparkline = ({ points = [], width = 100, height = 28, stroke = "#4F46E5" }) => {
  if (!points || points.length === 0) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const stepX = width / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = i * stepX;
    const y = height - ((p - min) / range) * height;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="inline-block">
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
];

const Ranking = () => {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("liquidity_desc");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ items: [], total: 0, page: 1, pageSize: 12 });

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getTokens({ page, pageSize, q, sort }).then((res) => {
      if (!mounted) return;
      setData(res);
      setLoading(false);
    });
    return () => { mounted = false; };
  }, [page, pageSize, q, sort]);

  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));

  const onSearchChange = (e) => {
    setQ(e.target.value);
    setPage(1);
  };

  const handleSort = (e) => {
    setSort(e.target.value);
    setPage(1);
  };

  const items = data.items || [];

  return (
    <div className="bg-gradient-to-b from-[#0b1622] to-[#111827] min-h-screen min-w-screen md:px-20 lg:px-40 p-4 max-w-6xl mx-auto">
      <header className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-[#3f5877] text-2xl font-semibold">Token Rankings</h1>

        <div className="flex gap-2 items-center">
          <input
            aria-label="Search tokens"
            value={q}
            onChange={onSearchChange}
            placeholder="Search name, symbol, address..."
            className="bg-[#3f5877] px-3 py-2 border rounded-md w-64 focus:outline-none"
          />

          <select value={sort} onChange={handleSort} className="bg-[#3f5877] px-3 py-2 border rounded-md">
            {SORT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </header>

      <main>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: pageSize }).map((_, i) => (
              <div key={i} className="border rounded-lg p-4 animate-pulse bg-white/50 h-28" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No tokens found.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((t) => (
              <div key={t.id} className="border rounded-lg p-4 bg-white shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center text-white font-bold">
                        {t.symbol.slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-medium">{t.name} <span className="text-xs text-gray-400">({t.symbol})</span></div>
                        <div className="text-xs text-gray-500">Addr: {t.address.slice(0, 8)}…{t.address.slice(-6)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm text-gray-500">Price</div>
                    <div className="font-semibold">${t.price.toFixed(4)}</div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <Sparkline points={t.spark} width={120} height={28} stroke={t.change24 >= 0 ? "#16A34A" : "#DC2626"} />
                  </div>

                  <div className="text-right text-xs text-gray-500">
                    <div>24h: <span className={t.change24 >= 0 ? "text-green-600" : "text-red-600"}>{t.change24}%</span></div>
                    <div>Vol: ${t.volume24.toLocaleString()}</div>
                    <div>LP: ${t.liquidity.toLocaleString()}</div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs">
                  <div className="flex gap-2 items-center">
                    {t.lpLocked ? <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded">LP locked</span> : <span className="px-2 py-0.5 bg-yellow-50 text-yellow-700 rounded">LP unlocked</span>}
                    {t.ownerRenounced ? <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded">Owner renounced</span> : <span className="px-2 py-0.5 bg-red-50 text-red-700 rounded">Has owner</span>}
                  </div>

                  <div className="flex gap-2">
                    <a className="text-blue-600 text-sm" href={`#`} onClick={(e) => e.preventDefault()}>Buy</a>
                    <a className="text-gray-600" href={`#`} onClick={(e) => e.preventDefault()}>Details</a>
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
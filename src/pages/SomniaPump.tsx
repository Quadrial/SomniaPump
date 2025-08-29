// src/pages/SomniaPump.tsx
import React, { useEffect, useMemo, useState } from "react";
import { FaTelegram, FaTwitter, FaGlobe } from "react-icons/fa6";
import { readContract, getContract } from "thirdweb";
import { client } from "../client"; // your shared Thirdweb client
import { somniaTestnet } from "thirdweb/chains";
import axios from "axios"; // Ensure axios is imported
import { Link } from "react-router-dom";

type Props = { contract: any };

type TokenRow = {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  imageURI?: string; // Renamed from 'image', to reflect it's a URI
  description?: string;
  twitter?: string;
  telegram?: string;
  website?: string;
};

const shorten = (addr: string) =>
  addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";

const formatUnits = (value: bigint, decimals: number) => {
  const s = value.toString().padStart(decimals + 1, "0");
  const i = s.length - decimals;
  const whole = s.slice(0, i) || "0";
  const frac = s.slice(i).replace(/0+$/, ""); // Remove trailing zeros from fraction
  return frac ? `${whole}.${frac}` : whole;
};

/* ------------------------------------------------------------------
   Helper to fetch all metadata strings from the factory's contract
   ------------------------------------------------------------------ */
async function fetchTokenMetadata(
  factoryContract: any, // Renamed for clarity
  tokenAddr: string
): Promise<
  Pick<
    TokenRow,
    | "name"
    | "symbol"
    | "description"
    | "imageURI"
    | "twitter"
    | "telegram"
    | "website"
  >
> {
  try {
    // Call the contract function that returns all metadata strings directly
    const metadataArray = await readContract({
      contract: factoryContract,
      method:
        "function getTokenMetadata(address) view returns (string name, string symbol, string description, string imageURI, string twitter, string telegram, string website)",
      params: [tokenAddr],
    });

    // Expecting an array of 7 strings: [name, symbol, description, imageURI, twitter, telegram, website]
    if (!Array.isArray(metadataArray) || metadataArray.length !== 7) {
      console.warn(
        `Unexpected metadata format for ${tokenAddr}. Expected 7 strings, got:`,
        metadataArray
      );
      return {}; // Return empty if format is wrong
    }

    const [name, symbol, description, imageURI, twitter, telegram, website] =
      metadataArray;

    return {
      name,
      symbol,
      description,
      imageURI,
      twitter,
      telegram,
      website,
    };
  } catch (e: any) {
    console.warn(`Could not fetch metadata for ${tokenAddr}:`, e.message);
    return {}; // Return empty object on error
  }
}

const SomniaPump: React.FC<Props> = ({ contract }) => {
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!contract) return; // Safety check
      setLoading(true);
      try {
        /* 1️⃣ Get the total number of tokens */
        const countBn = (await readContract({
          contract,
          method: "function totalTokens() view returns (uint256)",
          params: [],
        })) as bigint;

        const count = Number(countBn || 0n);
        if (count === 0) {
          if (!cancelled) setTokens([]);
          return;
        }

        /* 2️⃣ Read each token address by index */
        const addresses = await Promise.all(
          Array.from({ length: count }).map(async (_v, i) => {
            try {
              // Prefer 'tokenAt' if available
              return (await readContract({
                contract,
                method: "function tokenAt(uint256) view returns (address)",
                params: [BigInt(i)], // Ensure index is BigInt for uint256
              })) as string;
            } catch {
              // Fallback to 'tokensList'
              return (await readContract({
                contract,
                method: "function tokensList(uint256) view returns (address)",
                params: [BigInt(i)],
              })) as string;
            }
          })
        );

        /* 3️⃣ For each token address, fetch ERC‑20 info and factory metadata */
        const rows = await Promise.all(
          addresses.map(async (addr) => {
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
                }).catch(() => "Unknown"), // Fallback if name() fails
                readContract({
                  contract: erc20,
                  method: "function symbol() view returns (string)",
                }).catch(() => "???"), // Fallback if symbol() fails
                readContract({
                  contract: erc20,
                  method: "function decimals() view returns (uint8)",
                }).catch(() => 18), // Fallback for decimals
                readContract({
                  contract: erc20,
                  method: "function totalSupply() view returns (uint256)",
                }).catch(() => 0n), // Fallback for totalSupply
              ]);

            const decimals = Number(rawDecimals ?? 18);
            const totalSupply =
              typeof rawTotalSupply === "bigint"
                ? formatUnits(rawTotalSupply, decimals)
                : "0";

            /* 4️⃣ Fetch all metadata (description, image, socials) from the factory */
            const metadata = await fetchTokenMetadata(contract, addr);

            // Construct the TokenRow object
            return {
              address: addr,
              name: metadata.name || `${rawName}`, // Prioritize metadata name, fallback to ERC20 name
              symbol: metadata.symbol || `${rawSymbol}`, // Prioritize metadata symbol, fallback to ERC20 symbol
              decimals,
              totalSupply,
              imageURI: metadata.imageURI, // Use imageURI from metadata
              description: metadata.description,
              twitter: metadata.twitter,
              telegram: metadata.telegram,
              website: metadata.website,
            } as TokenRow;
          })
        );

        if (!cancelled) setTokens(rows);
      } catch (err) {
        console.error("Failed to fetch tokens:", err);
        if (!cancelled) setTokens([]); // Clear tokens on error
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    // Cleanup function to prevent state updates if component unmounts
    return () => {
      cancelled = true;
    };
  }, [contract]); // Re-run if the contract instance changes

  /* ------------------------------------------------------------------
     Client‑side filtering for search
     ------------------------------------------------------------------ */
  const filteredTokens = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tokens; // If no search query, return all tokens
    return tokens.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.symbol.toLowerCase().includes(q) ||
        t.address.toLowerCase().includes(q)
    );
  }, [tokens, search]);

  /* ------------------------------------------------------------------
     Helper to check if a link is valid (not empty and not just whitespace)
     ------------------------------------------------------------------ */
  const isValidLink = (link: string | undefined): boolean => {
    return !!link && link.trim() !== "";
  };

  /* ------------------------------------------------------------------
     Render Component
     ------------------------------------------------------------------ */
  return (
    <div className="bg-gradient-to-b from-[#0b1622] to-[#111827] min-h-screen text-white md:px-20 lg:px-40 py-10">
      {/* Page Title */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold">Somnia Pump</h1>
        <p className="text-blue-400 mt-2">
          The Best Meme Fair Launch Platform on Somnia
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-center gap-4 mb-10">
        <select className="bg-[#132030] border border-blue-500 rounded px-4 py-2">
          <option>Chain: Somnia</option>
        </select>

        <select className="bg-[#132030] border border-blue-500 rounded px-4 py-2">
          <option>Sort by: Feature</option>
          <option>Newest</option>
          <option>Total Supply</option>
        </select>

        <input
          type="text"
          placeholder="Search token / address"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-[#132030] border border-blue-500 rounded px-4 py-2 w-60"
        />
      </div>

      {/* Token Cards */}
      {loading ? (
        // Loading state with a spinner
        <div className="flex flex-col items-center justify-center py-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-center text-gray-400">Loading tokens…</p>
        </div>
      ) : filteredTokens.length === 0 ? (
        // State when no tokens are found
        <p className="text-center text-gray-400">No tokens found.</p>
      ) : (
        // Display the tokens in a grid
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredTokens.map((t) => (
            <div
              key={t.address} // Use token address as key for uniqueness
              className="bg-[#132030] border border-blue-500 rounded-lg p-4 hover:shadow-lg transition"
            >
              {/* <h2 className="font-bold text-lg">
                {t.name} <span className="text-gray-300">({t.symbol})</span>
              </h2> */}
              <h2 className="font-bold text-lg">
                <Link to={`/coin/${t.address}`} className="hover:underline">
                  {t.name} <span className="text-gray-300">({t.symbol})</span>
                </Link>
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                Address:{" "}
                <span className="text-blue-300">{shorten(t.address)}</span>
              </p>

              {/* Supply and Decimals */}
              <div className="mt-3 text-sm">
                <p>
                  Total Supply:{" "}
                  <span className="text-green-400">{t.totalSupply}</span>
                </p>
                <p>
                  Decimals: <span className="text-gray-300">{t.decimals}</span>
                </p>
              </div>

              {/* Description */}
              {t.description && (
                <p className="text-sm text-gray-300 mt-3 line-clamp-3">
                  {t.description}
                </p>
              )}

              {/* Image and Social Links */}
              <div className="flex items-center justify-between mt-4">
                <img
                  src={
                    t.imageURI ||
                    "https://placehold.co/80x80/1e293b/9ca3af?text=No+Image"
                  }
                  alt={`${t.symbol} logo`}
                  className="w-20 h-20 rounded-md object-cover border border-blue-500/40"
                  onError={(e) => {
                    // Fallback image if the provided imageURI fails to load
                    e.currentTarget.src =
                      "https://placehold.co/80x80/1e293b/9ca3af?text=No+Image";
                  }}
                />

                {/* Social Links */}
                <div className="flex space-x-2">
                  {isValidLink(t.twitter) && (
                    <a
                      href={
                        t.twitter!.startsWith("http")
                          ? t.twitter
                          : `https://${t.twitter}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-blue-500 p-2 rounded hover:bg-blue-600 transition"
                      aria-label="Twitter"
                    >
                      <FaTwitter />
                    </a>
                  )}
                  {isValidLink(t.telegram) && (
                    <a
                      href={
                        t.telegram!.startsWith("http")
                          ? t.telegram
                          : `https://${t.telegram}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-blue-500 p-2 rounded hover:bg-blue-600 transition"
                      aria-label="Telegram"
                    >
                      <FaTelegram />
                    </a>
                  )}
                  {isValidLink(t.website) && (
                    <a
                      href={
                        t.website!.startsWith("http")
                          ? t.website
                          : `https://${t.website}`
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
          ))}
        </div>
      )}
    </div>
  );
};

export default SomniaPump;

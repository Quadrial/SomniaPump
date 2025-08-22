// CreateToken.tsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { FaTelegram, FaTwitter, FaGlobe } from "react-icons/fa6";
import { prepareContractCall } from "thirdweb";
import { useSendTransaction, useActiveAccount } from "thirdweb/react";
// import { ConnectButton } from "thirdweb/react";
// import { client } from "../client";
import ConnectWalletButton from "../components/ConnectButton";

const DEFAULT_DEPLOY_FEE = "0.001"; // UI-only display
const MAX_IMAGE_MB = 5;

// ---------- helpers ----------
const parseUnits = (valStr: string, decimals: number): bigint => {
  const [w, f = ""] = String(valStr).trim().split(".");
  const frac = (f + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(w || "0") * 10n ** BigInt(decimals) + BigInt(frac || "0");
};
const parseEther = (ethStr: string): bigint => parseUnits(ethStr, 18);

// ---------- Pinata uploaders ----------
interface PinataResponse {
  cid: string;
  gatewayUrl: string;
  ipfsUri: string;
}

const uploadToPinata = async (file: File): Promise<PinataResponse> => {
  const url = "https://api.pinata.cloud/pinning/pinFileToIPFS";
  const formData = new FormData();
  formData.append("file", file);

  const apiKey = import.meta.env.VITE_PINATA_API_KEY;
  const secretKey = import.meta.env.VITE_PINATA_SECRET_API_KEY;

  if (!apiKey || !secretKey) {
    throw new Error("Pinata API key or secret is not defined");
  }

  try {
    const response = await axios.post(url, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
        pinata_api_key: apiKey,
        pinata_secret_api_key: secretKey,
      },
    });
    const hash = response.data.IpfsHash;
    return {
      cid: hash,
      gatewayUrl: `https://gateway.pinata.cloud/ipfs/${hash}`,
      ipfsUri: `ipfs://${hash}`,
    };
  } catch (error: any) {
    console.error("Pinata upload error:", error.response || error);
    throw new Error("Pinata upload failed: " + (error.response?.data?.error || error.message));
  }
};

const uploadJSONToPinata = async (json: object): Promise<PinataResponse> => {
  const url = "https://api.pinata.cloud/pinning/pinJSONToIPFS";
  const apiKey = import.meta.env.VITE_PINATA_API_KEY;
  const secretKey = import.meta.env.VITE_PINATA_SECRET_API_KEY;

  if (!apiKey || !secretKey) {
    throw new Error("Pinata API key or secret is not defined");
  }

  try {
    const response = await axios.post(url, json, {
      headers: {
        "Content-Type": "application/json",
        pinata_api_key: apiKey,
        pinata_secret_api_key: secretKey,
      },
    });
    const hash = response.data.IpfsHash;
    return {
      cid: hash,
      gatewayUrl: `https://gateway.pinata.cloud/ipfs/${hash}`,
      ipfsUri: `ipfs://${hash}`,
    };
  } catch (error: any) {
    console.error("Pinata JSON upload error:", error.response || error);
    throw new Error("Pinata JSON upload failed: " + (error.response?.data?.error || error.message));
  }
};

interface CreateTokenProps {
  contract: any; // thirdweb contract type
}

const CreateToken: React.FC<CreateTokenProps> = ({ contract }) => {
  // form state
  const [chainLabel, setChainLabel] = useState("Somnia Testnet");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [website, setWebsite] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");

  // advanced (you can hide or prefill these)
  const [decimals, setDecimals] = useState(18);
  const [initialSupplyTokens, setInitialSupplyTokens] = useState("1000000"); // human-readable tokens

  // optional liquidity seeding
  const [seedWithETH, setSeedWithETH] = useState(false);
  const [tokenAmountTokens, setTokenAmountTokens] = useState("700000"); // for LP (subset of supply)
  const [baseAmountEth, setBaseAmountEth] = useState("0.2"); // ETH to pair
  const [lockDurationHours, setLockDurationHours] = useState("24");

  // options
  const [autoRenounce, setAutoRenounce] = useState(false);
  const [lockLP, setLockLP] = useState(true);

  // UI state
  const activeAccount = useActiveAccount();
  const connectedAddress = activeAccount?.address;
  const [account, setAccount] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);

  const { mutate: sendTransaction, isPending: isSending } = useSendTransaction();

  useEffect(() => {
    setAccount(connectedAddress || "");
  }, [connectedAddress]);

  useEffect(() => {
    if (!imageFile) {
      setImagePreview("");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(imageFile);
  }, [imageFile]);

  // validation
  const validate = (): string | null => {
    if (!contract) return "Contract not provided.";
    if (!name.trim()) return "Token name required";
    if (!symbol.trim()) return "Token symbol required";
    if (!/^[A-Za-z0-9]{2,11}$/.test(symbol)) return "Symbol must be 2-11 alphanumeric chars (no spaces)";
    if (!account) return "Connect your wallet to continue";
    if (imageFile) {
      const mb = imageFile.size / (1024 * 1024);
      if (mb > MAX_IMAGE_MB) return `Image too large — must be <= ${MAX_IMAGE_MB}MB`;
      if (!/^image\/(png|jpe?g|gif|webp)$/.test(imageFile.type)) return "Unsupported image type";
    }
    if (!Number.isInteger(Number(decimals)) || Number(decimals) < 6 || Number(decimals) > 18) {
      return "Decimals should be an integer between 6 and 18";
    }
    if (!/^\d+(\.\d+)?$/.test(String(initialSupplyTokens))) return "Initial supply must be a number";
    if (seedWithETH) {
      if (!/^\d+(\.\d+)?$/.test(String(tokenAmountTokens))) return "LP token amount must be a number";
      if (!/^\d+(\.\d+)?$/.test(String(baseAmountEth))) return "Base ETH must be a number";
      if (!/^\d+$/.test(String(lockDurationHours))) return "Lock duration (hours) must be an integer";
    }
    return null;
  };

  const onSelectFile = (file: File | null) => {
    if (!file) {
      setImageFile(null);
      return;
    }
    const mb = file.size / (1024 * 1024);
    if (mb > MAX_IMAGE_MB) {
      setStatus(`Image too large — must be <= ${MAX_IMAGE_MB}MB`);
      return;
    }
    setStatus("");
    setImageFile(file);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("");
    setTxHash(null);

    const v = validate();
    if (v) {
      setStatus(v);
      return;
    }

    try {
      setBusy(true);
      setStatus("Uploading image to IPFS (Pinata)...");
      let imageUrl: string | null = null;

      if (imageFile) {
        const imgRes = await uploadToPinata(imageFile);
        imageUrl = imgRes.gatewayUrl; // use gateway URL for broad compatibility
      }

      setStatus("Uploading metadata to IPFS (Pinata)...");
      const metadata = {
        name,
        symbol,
        description,
        image: imageUrl,
        links: { twitter, telegram, website },
        options: { autoRenounce, lockLP, seedWithETH },
      };
      const metaRes = await uploadJSONToPinata(metadata);
      const metadataURI = metaRes.gatewayUrl; // you can also use metaRes.ipfsUri

      // Build params
      const dec = Number(decimals);
      const initialSupply = parseUnits(initialSupplyTokens, dec);

      const methodCreate = "function createToken(string name, string symbol, uint8 decimals, uint256 initialSupply, string metadataURI, bool autoRenounce) returns (address)";
      const methodCreateAndSeed =
        "function createTokenAndSeedETH(string name, string symbol, uint8 decimals, uint256 initialSupply, string metadataURI, bool autoRenounce, uint256 tokenAmount, uint256 baseAmount, uint256 lockDurationSeconds) payable returns (address tokenAddr)";

      let transaction;
      if (seedWithETH) {
        const tokenAmount = parseUnits(tokenAmountTokens, dec);
        const baseAmountWei = parseEther(baseAmountEth);
        const lockDurationSeconds = BigInt(Number(lockDurationHours) * 3600);

        transaction = prepareContractCall({
          contract,
          method: methodCreateAndSeed,
          params: [
            name,
            symbol,
            dec,
            initialSupply,
            metadataURI,
            Boolean(autoRenounce),
            tokenAmount,
            baseAmountWei,
            lockDurationSeconds,
          ],
          value: baseAmountWei, // payable
        });
      } else {
        transaction = prepareContractCall({
          contract,
          method: methodCreate,
          params: [name, symbol, dec, initialSupply, metadataURI, Boolean(autoRenounce)],
        });
      }

      setStatus("Please confirm the transaction in your wallet...");
      sendTransaction(transaction, {
        onSuccess: (receipt: any) => {
          // thirdweb returns a transaction result; try common fields
          const hash =
            receipt?.transactionHash ||
            receipt?.receipt?.transactionHash ||
            receipt?.hash ||
            null;
          setTxHash(hash);
          setStatus("Token created! It will appear after indexing.");
          setBusy(false);
        },
        onError: (err: any) => {
          console.error(err);
          setStatus(err?.message || "Transaction failed");
          setBusy(false);
        },
      });
    } catch (err: any) {
      console.error(err);
      setStatus(err?.message || "Creation failed");
      setBusy(false);
    }
  };

  const PreviewCard = () => (
    <div className="bg-[#132030] border border-blue-500 rounded-lg p-4 w-full">
      <div className="flex justify-between items-start gap-3">
        <div className="flex gap-3 items-start">
          <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
            {symbol ? symbol.slice(0, 2).toUpperCase() : "TK"}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-lg truncate">{name || "Your Token Name"}</div>
            <div className="text-xs text-gray-400 mt-1">{symbol ? `(${symbol.toUpperCase()})` : "(SYMBOL)"}</div>
            <p className="text-sm text-gray-400 mt-2 line-clamp-4 overflow-hidden">{description || "Short description will appear here."}</p>
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <div className="text-sm text-gray-400">Deploy Fee</div>
          <div className="text-lg font-semibold">{DEFAULT_DEPLOY_FEE} ETH</div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex gap-2 items-center text-sm">
          {twitter && (
            <a href={twitter} target="_blank" rel="noreferrer" className="bg-blue-500 p-2 rounded" aria-label="Twitter">
              <FaTwitter />
            </a>
          )}
          {telegram && (
            <a href={telegram} target="_blank" rel="noreferrer" className="bg-blue-500 p-2 rounded" aria-label="Telegram">
              <FaTelegram />
            </a>
          )}
          {website && (
            <a href={website} target="_blank" rel="noreferrer" className="bg-blue-500 p-2 rounded" aria-label="Website">
              <FaGlobe />
            </a>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-400">Owner:</div>
          <div className="text-sm text-blue-400">
            {account ? account.slice(0, 8) + "…" : "Not connected"}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="text-xs text-gray-400">
          {lockLP ? <span className="text-green-400">LP will be locked</span> : <span className="text-yellow-300">LP unlock allowed</span>}
          {" • "}
          {autoRenounce ? <span className="text-indigo-300">Owner renounce</span> : <span className="text-gray-400">Owner retained</span>}
        </div>
        <div>
          {imagePreview ? (
            <img src={imagePreview} alt="preview" className="w-20 h-20 rounded-md object-cover border" />
          ) : (
            <div className="w-20 h-20 rounded-md bg-[#0b1220] border flex items-center justify-center text-gray-500 text-sm">Preview</div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-gradient-to-b from-[#0b1622] to-[#111827] min-h-screen text-white px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-2">Launch your token on Somnia Pump</h1>
        <p className="text-center text-blue-400 mb-6">No-code token & liquidity seeding for Somnia</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* FORM */}
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="bg-[#132030] border border-blue-500 rounded-lg p-5">
              <label className="block text-xs text-gray-300 mb-1">Chain</label>
              <select
                className="w-full bg-[#0b1420] px-3 py-2 rounded text-sm"
                value={chainLabel}
                onChange={(e) => setChainLabel(e.target.value)}
                aria-label="Select chain"
              >
                <option>Somnia Testnet</option>
              </select>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-300">Token Name *</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded bg-[#0b1420] border border-transparent focus:border-blue-400 text-sm"
                    placeholder="Enter token name"
                    aria-label="Token name"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-300">Token Symbol *</label>
                  <input
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded bg-[#0b1420] border border-transparent focus:border-blue-400 text-sm"
                    placeholder="SYMB"
                    aria-label="Token symbol"
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-300">Decimals</label>
                  <input
                    value={decimals}
                    onChange={(e) => setDecimals(Number(e.target.value))}
                    className="mt-1 w-full px-3 py-2 rounded bg-[#0b1420] text-sm"
                    placeholder="18"
                    aria-label="Decimals"
                    type="number"
                    min={6}
                    max={18}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-300">Initial Supply (tokens)</label>
                  <input
                    value={initialSupplyTokens}
                    onChange={(e) => setInitialSupplyTokens(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded bg-[#0b1420] text-sm"
                    placeholder="1000000"
                    aria-label="Initial supply"
                  />
                </div>
                <div />
              </div>

              <div className="mt-4">
                <label className="text-xs text-gray-300">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="mt-1 w-full px-3 py-2 rounded bg-[#0b1420] border border-transparent focus:border-blue-400 text-sm"
                  placeholder="Enter description"
                  aria-label="Description"
                />
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value)}
                  placeholder="Twitter link"
                  className="px-3 py-2 rounded bg-[#0b1420] text-sm"
                  aria-label="Twitter link"
                />
                <input
                  value={telegram}
                  onChange={(e) => setTelegram(e.target.value)}
                  placeholder="Telegram link"
                  className="px-3 py-2 rounded bg-[#0b1420] text-sm"
                  aria-label="Telegram link"
                />
                <input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="Website link"
                  className="px-3 py-2 rounded bg-[#0b1420] text-sm"
                  aria-label="Website link"
                />
              </div>

              <div className="mt-4">
                <label className="text-xs text-gray-300">Logo / Image (PNG/JPG, max {MAX_IMAGE_MB}MB)</label>
                <div className="mt-2 flex gap-3 items-center">
                  <label className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded cursor-pointer text-sm" aria-label="Upload image">
                    Upload
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => onSelectFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>
                  <div className="text-sm text-gray-300 truncate">
                    {imageFile ? imageFile.name : "No file selected"}
                  </div>
                </div>
                {imagePreview && (
                  <div className="mt-3">
                    <img src={imagePreview} alt="preview" className="w-28 h-28 object-cover rounded-md border" />
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex gap-4 items-center flex-wrap">
                  <label className="text-sm flex items-center gap-2">
                    <input type="checkbox" checked={autoRenounce} onChange={(e) => setAutoRenounce(e.target.checked)} />
                    <span className="text-xs text-gray-300">Auto-renounce ownership</span>
                  </label>

                  <label className="text-sm flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={seedWithETH}
                      onChange={(e) => setSeedWithETH(e.target.checked)}
                    />
                    <span className="text-xs text-gray-300">Seed liquidity with ETH</span>
                  </label>

                  <label className="text-sm flex items-center gap-2">
                    <input type="checkbox" checked={lockLP} onChange={(e) => setLockLP(e.target.checked)} />
                    <span className="text-xs text-gray-300">Lock LP on launch</span>
                  </label>
                </div>

                <div className="text-right">
                  <div className="text-xs text-gray-400">Deployment Fee</div>
                  <div className="text-lg font-semibold">{DEFAULT_DEPLOY_FEE} ETH</div>
                </div>
              </div>

              {seedWithETH && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-gray-300">LP Token Amount</label>
                    <input
                      value={tokenAmountTokens}
                      onChange={(e) => setTokenAmountTokens(e.target.value)}
                      className="mt-1 w-full px-3 py-2 rounded bg-[#0b1420] text-sm"
                      placeholder="700000"
                      aria-label="LP token amount"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-300">Base Amount (ETH)</label>
                    <input
                      value={baseAmountEth}
                      onChange={(e) => setBaseAmountEth(e.target.value)}
                      className="mt-1 w-full px-3 py-2 rounded bg-[#0b1420] text-sm"
                      placeholder="0.2"
                      aria-label="Base ETH amount"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-300">Lock Duration (hours)</label>
                    <input
                      value={lockDurationHours}
                      onChange={(e) => setLockDurationHours(e.target.value)}
                      className="mt-1 w-full px-3 py-2 rounded bg-[#0b1420] text-sm"
                      placeholder="24"
                      aria-label="Lock duration hours"
                    />
                  </div>
                </div>
              )}

              <div className="mt-4 flex gap-3 flex-col sm:flex-row items-stretch">
                <div className="w-full sm:flex-1">
                  <ConnectWalletButton theme="dark" />
                </div>

                <button
                  type="submit"
                  disabled={busy || isSending}
                  className="w-full sm:flex-1 bg-gradient-to-r from-indigo-500 to-pink-500 px-4 py-2 rounded text-sm disabled:opacity-60"
                >
                  {busy || isSending ? "Working..." : seedWithETH ? "Create + Seed ETH" : "Create Token"}
                </button>
              </div>

              {status && <div className="mt-3 text-sm text-gray-300">{status}</div>}
              {txHash && (
                <div className="mt-2 text-xs text-blue-300 break-all">
                  Tx: <span>{txHash}</span>
                </div>
              )}
            </div>
          </form>

          {/* PREVIEW + TIPS */}
          <div className="space-y-4">
            <PreviewCard />

            <div className="bg-[#132030] border border-blue-500 rounded-lg p-4 text-sm text-gray-300">
              <div className="font-semibold mb-2">Trust & Safety</div>
              <ul className="list-disc ml-5 space-y-1">
                <li>LP lock prevents immediate rugpulls — recommended.</li>
                <li>Auto-renounce makes ownerless tokens (cannot upgrade & manage).</li>
                <li>For production, upload metadata to IPFS and lock LP by default for featured launches.</li>
              </ul>
            </div>

            <div className="bg-[#132030] border border-blue-500 rounded-lg p-4 text-sm text-gray-300">
              <div className="font-semibold mb-2">Preview will match list cards</div>
              <p>After creation the token appears in the marketplace ranking and buyers can trade via the integrated DEX UI.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateToken;
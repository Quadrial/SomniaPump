// CreateToken.jsx
import React, { useEffect, useState } from "react";
import { FaTelegram, FaTwitter, FaGlobe } from "react-icons/fa6";

// NOTE: If you plan to enable on-chain wallet actions later, re-add ethers and wallet logic.
// import { ethers } from "ethers";

const DEFAULT_DEPLOY_FEE = "0.99"; // UI-only display

const MAX_IMAGE_MB = 5;

const CreateToken = () => {
  // form state
  const [chain, setChain] = useState("Somnia (SUI)");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [website, setWebsite] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [autoRenounce, setAutoRenounce] = useState(false);
  const [lockLP, setLockLP] = useState(true);

  // wallet-like state (UI only)
  const [account, setAccount] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [txHash, setTxHash] = useState(null);

  useEffect(() => {
    if (!imageFile) {
      setImagePreview("");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target.result);
    reader.readAsDataURL(imageFile);
  }, [imageFile]);

  // simple wallet connect UI (uses injected provider if available)
  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        setStatus("No injected wallet found (e.g. MetaMask). You can still create via backend later.");
        return;
      }
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      setAccount(accounts[0] || "");
      setStatus("Wallet connected: " + (accounts[0] ? accounts[0].slice(0, 8) + "…" : ""));
    } catch (err) {
      console.error(err);
      setStatus("Wallet connect failed.");
    }
  };

  // validation
  const validate = () => {
    if (!name.trim()) return "Token name required";
    if (!symbol.trim()) return "Token symbol required";
    if (!/^[A-Za-z0-9]{2,11}$/.test(symbol)) return "Symbol must be 2-11 alphanumeric chars (no spaces)";
    if (imageFile) {
      const mb = imageFile.size / (1024 * 1024);
      if (mb > MAX_IMAGE_MB) return `Image too large — must be <= ${MAX_IMAGE_MB}MB`;
      if (!/^image\/(png|jpe?g|gif|webp)$/.test(imageFile.type)) return "Unsupported image type";
    }
    return null;
  };

  // image selector helper
  const onSelectFile = (file) => {
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

  // FRONTEND-ONLY create (simulate). Replace this with your API or on-chain call.
  const handleCreate = async (e) => {
    e.preventDefault();
    setStatus("");
    setTxHash(null);

    const v = validate();
    if (v) {
      setStatus(v);
      return;
    }

    setBusy(true);
    setStatus("Preparing metadata and uploading image (simulated)...");

    // Simulate upload latency for demo
    await new Promise((r) => setTimeout(r, 800));

    // You can replace this with: upload to IPFS (nft.storage/web3.storage) or your /api/upload-image
    const simulatedImageUrl = imagePreview || null;

    const metadata = {
      name,
      symbol,
      description,
      links: { twitter, telegram, website },
      image: simulatedImageUrl,
      options: { autoRenounce, lockLP },
      owner: account || "0xNotConnected",
    };

    setStatus("Sending create request (simulated)...");
    // simulate server/on-chain latency
    await new Promise((r) => setTimeout(r, 1200));

    // simulated tx hash — replace with real tx hash from backend or on-chain call
    const fakeHash = "0x" + Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 8);
    setTxHash(fakeHash);
    setStatus("Token created (simulated). It will appear in the marketplace after indexing.");
    setBusy(false);
  };

  // small preview card that mirrors your token cards
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
          <div className="text-lg font-semibold">{DEFAULT_DEPLOY_FEE} SUI</div>
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
          <div className="text-sm text-blue-400">{account ? account.slice(0, 8) + "…" : "Not connected"}</div>
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
        <h1 className="text-3xl font-bold text-center mb-2">Launch your token on Move Pump</h1>
        <p className="text-center text-blue-400 mb-6">No-code token & liquidity seeding for Somnia</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* FORM */}
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="bg-[#132030] border border-blue-500 rounded-lg p-5">
              <label className="block text-xs text-gray-300 mb-1">Chain</label>
              <select
                className="w-full bg-[#0b1420] px-3 py-2 rounded text-sm"
                value={chain}
                onChange={(e) => setChain(e.target.value)}
                aria-label="Select chain"
              >
                <option>Somnia (SUI)</option>
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
                  <label
                    className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded cursor-pointer text-sm"
                    aria-label="Upload image"
                  >
                    Upload
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => onSelectFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>
                  <div className="text-sm text-gray-300 truncate">{imageFile ? imageFile.name : "No file selected"}</div>
                </div>
                {imagePreview && <div className="mt-3"><img src={imagePreview} alt="preview" className="w-28 h-28 object-cover rounded-md border" /></div>}
              </div>

              <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex gap-4 items-center flex-wrap">
                  <label className="text-sm flex items-center gap-2">
                    <input type="checkbox" checked={autoRenounce} onChange={(e) => setAutoRenounce(e.target.checked)} />
                    <span className="text-xs text-gray-300">Auto-renounce ownership</span>
                  </label>

                  <label className="text-sm flex items-center gap-2">
                    <input type="checkbox" checked={lockLP} onChange={(e) => setLockLP(e.target.checked)} />
                    <span className="text-xs text-gray-300">Lock LP on launch</span>
                  </label>
                </div>

                <div className="text-right">
                  <div className="text-xs text-gray-400">Deployment Fee</div>
                  <div className="text-lg font-semibold">{DEFAULT_DEPLOY_FEE} SUI</div>
                </div>
              </div>

              <div className="mt-4 flex gap-3 flex-col sm:flex-row">
                <button
                  type="button"
                  onClick={connectWallet}
                  className="w-full sm:flex-1 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm"
                >
                  {account ? `Connected: ${account.slice(0, 6)}…` : "Connect Wallet"}
                </button>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full sm:flex-1 bg-gradient-to-r from-indigo-500 to-pink-500 px-4 py-2 rounded text-sm"
                >
                  {busy ? "Working..." : "Create Token"}
                </button>
              </div>

              {status && <div className="mt-3 text-sm text-gray-300">{status}</div>}
              {txHash && (
                <div className="mt-2 text-xs text-blue-300 break-all">
                  Tx (simulated): <a target="_blank" rel="noreferrer" href="#">{txHash}</a>
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
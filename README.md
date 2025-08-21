SomniaPump — No‑Code Token Launcher
Create and launch ERC‑20 style tokens from a friendly UI. This project:

* Uploads token images and metadata to IPFS via Pinata
* Calls your on‑chain factory using thirdweb
* Supports two flows:

Create token
Create token and seed liquidity with Somnia Shannon (payable)



It’s designed to be simple to fork, configure, and ship. You bring a factory contract and a chain; Move Pump does the rest.
Note: The UI label says “Somnia (SUI)” but the current contract calls and thirdweb client are EVM‑style. Update the label or point the app at your EVM chain accordingly.

Features

* Image upload to Pinata (pinFileToIPFS)
* Metadata pinning to Pinata (pinJSONToIPFS)
* Contract calls via thirdweb:

createToken(name, symbol, decimals, initialSupply, metadataURI, autoRenounce)
createTokenAndSeedETH(name, symbol, decimals, initialSupply, metadataURI, autoRenounce, tokenAmount, baseAmount, lockDurationSeconds) payable


* Wallet connect via thirdweb’s ConnectButton
* Optional “seed with Somnia Shannon” toggle with parameters for LP token amount, Somnia Shannon, and lock duration
* User‑friendly validation for symbol, image size/type, decimals, and inputs
* Clean token preview card mirroring marketplace tiles


Tech Stack

* React + Vite
* thirdweb SDK (EVM)
* Pinata (IPFS pinning)
* Axios
* Tailwind‑style utility classes
* React Icons


Project Structure

* src/components/CreateToken.jsx — main page with the full flow (upload + contract call)
* App.jsx — renders CreateToken
* main.jsx — wraps your app in ThirdwebProvider

Your file names may vary; this README assumes a typical Vite+React setup.

Prerequisites

* Node.js 18+
* A deployed factory contract that exposes the following functions:

function createToken(
  string name,
  string symbol,
  uint8 decimals,
  uint256 initialSupply,
  string metadataURI,
  bool autoRenounce
) returns (address)

function createTokenAndSeedETH(
  string name,
  string symbol,
  uint8 decimals,
  uint256 initialSupply,
  string metadataURI,
  bool autoRenounce,
  uint256 tokenAmount,
  uint256 baseAmount,
  uint256 lockDurationSeconds
) payable returns (address tokenAddr)


* A thirdweb clientId
* Pinata API credentials


Environment Variables
Create a .env file (Vite uses variables prefixed with VITE_):
VITE_THIRDW\EB_CLIENT_ID=your_thirdweb_client_id
VITE_FACTORY_ADDRESS=0xYourFactoryAddress
VITE_CHAIN_ID=1                          # e.g., 1 (Ethereum), 8453 (Base), 11155111 (Sepolia)
VITE_PINATA_API_KEY=your_pinata_api_key
VITE_PINATA_SECRET_API_KEY=your_pinata_secret_key

Security note: Don’t ship Pinata secrets in a public client for production. Use a server or serverless proxy to handle uploads. The direct‑from‑browser approach is convenient for dev/testing.

Installation
bashDownloadCopy code Wrap# 1) Install deps
npm install

# 2) Run dev
npm run dev
Open the local URL from your terminal output.

Thirdweb Provider Setup
Wrap your app once at the root (e.g., main.jsx):
jsxDownloadCopy code Wrapimport React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { ThirdwebProvider } from "thirdweb/react";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThirdwebProvider clientId={import.meta.env.VITE_THIRDW\EB_CLIENT_ID}>
      <App />
    </ThirdwebProvider>
  </React.StrictMode>
);

How It Works

1. User fills in token details and uploads an image
2. App uploads the image to Pinata (pinFileToIPFS) and receives a CID
3. App builds metadata JSON and pins it to Pinata (pinJSONToIPFS)
4. App prepares a contract call via thirdweb:

createToken(...) or createTokenAndSeedETH(...) depending on the toggle


5. User confirms the transaction in their wallet
6. App shows the transaction hash and success status


Key UI/Logic Highlights

* Decimals: default 18; allowed 6–18 in UI
* Initial supply: input is human‑readable, converted to base units before calling
* Seeding with Somnia Shannon:

tokenAmount: portion of total supply for LP
baseAmount: Somnia Shannon value in wei and set as transaction value
lockDuration: hours -> seconds


* Auto Renounce: if enabled, ownership renounce is handled per your factory’s logic
* LP Lock: flag included in metadata; actual locking is handled by your contract if implemented


Using the App

1. Connect wallet
2. Fill out Token Name and Symbol
3. (Optional) Set decimals and initial supply
4. Add description and social links
5. Upload a logo image (PNG/JPG/WebP/GIF up to 5 MB)
6. Choose options:

Auto‑renounce ownership
Lock LP on launch (metadata flag)
Seed liquidity with ETH (enables extra inputs)


7. Click Create Token (or Create + Seed ETH)
8. Confirm the transaction in your wallet

You’ll see a transaction hash on success.

Configuration Tips

* Chain ID and Factory Address must match your connected wallet network
* If your factory prefers ipfs:// URIs, send the ipfsUri (e.g., ipfs://CID) instead of the gateway URL
* You can adjust defaults in CreateToken.jsx:

decimals (default 18)
initialSupplyTokens (default 1,000,000)
tokenAmountTokens, baseAmountEth, lockDurationHours for the seeding flow


* Update explorer link mapping if you want clickable hashes for your chain


Pinata Notes

* Dev convenience: direct calls from the client
* Production best practice: route uploads through a backend to protect secrets and apply validation/rate limits
* Response values used:

IpfsHash -> build gateway URL https://gateway.pinata.cloud/ipfs/{CID}
Optional: prefer ipfs://CID if your app/infra supports native IPFS URIs




Troubleshooting

* 
“Factory contract not configured.”

Check VITE_FACTORY_ADDRESS and VITE_CHAIN_ID; ensure the address is deployed on that chain


* 
“Connect your wallet to continue.”

Use the ConnectButton and confirm your wallet network matches VITE_CHAIN_ID


* 
“Pinata upload failed.”

Verify API key/secret, network access, and image size/type
Watch the browser console for error details
Consider a server proxy if you encounter CORS or want to secure keys


* 
Transaction fails or reverts

Ensure sufficient native balance for gas (and baseAmount for seeding)
Validate decimals and input types
Confirm your ABI matches the factory implementation


* 
Wrong chain/network

Switch the wallet network to match VITE_CHAIN_ID




Security and Safety

* Client‑side secrets are not safe. Move Pinata uploads to a server for production.
* Auto‑renounce is irreversible; ensure this is intended before enabling.
* LP lock behavior depends on your contracts; the UI toggle only influences metadata unless your factory enforces it.
* This project is for educational/demo purposes; not financial advice.


Contributing
Pull requests are welcome. If you’re adding features:

* Keep the UI accessible and validate user input
* Document new env vars or configuration
* Include brief notes in this README


License
MIT

Acknowledgments

* thirdweb for streamlined wallet and contract interactions
* Pinata for IPFS pinning
* The open‑source community for making web3 dev less mysterious and more fun
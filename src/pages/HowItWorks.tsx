import React from "react";

const HowItWorks: React.FC = () => {
  return (
    <div className="bg-gradient-to-b from-[#0b1622] to-[#111827] min-h-screen text-white px-4 md:px-12 lg:px-32 py-10">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-6 text-center">
          How Somnia Pump Works
        </h1>

        <div className="space-y-8">
          <div className="bg-[#132030] border border-blue-500/30 rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-3">
              What is Somnia Pump?
            </h2>
            <p className="text-gray-300">
              Somnia Pump is a decentralized platform for creating and launching
              new tokens on the Somnia testnet. It provides a simple and
              intuitive interface for users to create their own tokens, seed
              liquidity, and get their projects off the ground.
            </p>
          </div>

          <div className="bg-[#132030] border border-blue-500/30 rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-3">Key Features</h2>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li>
                <span className="font-semibold text-white">
                  Token Creation:
                </span>{" "}
                Easily create your own ERC20 tokens with custom names, symbols,
                and supplies.
              </li>
              <li>
                <span className="font-semibold text-white">
                  Liquidity Seeding:
                </span>{" "}
                Provide initial liquidity for your token to enable trading on
                the decentralized exchange.
              </li>
              <li>
                <span className="font-semibold text-white">
                  Decentralized Exchange:
                </span>{" "}
                Swap between different tokens on the Somnia testnet using our
                integrated DEX.
              </li>
              <li>
                <span className="font-semibold text-white">Ranking:</span> View
                the top-performing tokens on the platform based on various
                metrics.
              </li>
            </ul>
          </div>

          <div className="bg-[#132030] border border-blue-500/30 rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-3">Getting Started</h2>
            <p className="text-gray-300 mb-4">
              To start using Somnia Pump, you will need some Somnia testnet
              tokens (STT). You can get free STT from the official Somnia
              faucet.
            </p>
            <a
              href="https://cloud.google.com/application/web3/faucet/somnia/shannon"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg transition"
            >
              Get Somnia Testnet Faucet
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HowItWorks;

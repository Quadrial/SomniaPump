import React from "react";
import { FaTelegram, FaTwitter, FaGlobe } from "react-icons/fa6"; // social icons

const tokens = [
  {
    name: "ShibaHood (SHIBHOOD)",
    description: "The Shiba that steals from the rich, and gives to the...",
    createdBy: "0x7ea...cdbb",
    marketcap: "$2,035.62",
    percentage: "2.00%",
    image: "images/image.png",
  },
  {
    name: "BALLZ DEEP (DBZ)",
    description: "How deep are we?",
    createdBy: "0x168...3241",
    marketcap: "$5,439.75",
    percentage: "1.78%",
    image: "images/image.png",
  },
  {
    name: "Jerry Maguire ($JERRY)",
    description: "What can I do for ya? It’s a very personal, you ready?",
    createdBy: "0x828...7ae9",
    marketcap: "$1,725",
    percentage: "0.00%",
    image: "images/image.png",
  },
  {
    name: "REC Protocol (REC)",
    description: "OFFICIAL",
    createdBy: "0x7be...7247",
    marketcap: "$1,744.14",
    percentage: "0.03%",
    image: "images/image.png",
  },
];

const SomniaPump = () => {
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
          <option>Marketcap</option>
          <option>Newest</option>
        </select>

        <input
          type="text"
          placeholder="Search token"
          className="bg-[#132030] border border-blue-500 rounded px-4 py-2 w-60"
        />
      </div>

      {/* Token Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {tokens.map((token, index) => (
          <div
            key={index}
            className="bg-[#132030] border border-blue-500 rounded-lg p-4 hover:shadow-lg transition"
          >
            {/* Token Info */}
            <h2 className="font-bold text-lg">{token.name}</h2>
            <p className="text-sm text-gray-400 mt-1">{token.description}</p>

            {/* Creator + Marketcap */}
            <div className="mt-4 text-sm">
              <p>
                Created by:{" "}
                <span className="text-blue-400">{token.createdBy}</span>
              </p>
              <p>
                Marketcap:{" "}
                <span className="text-green-400">{token.marketcap}</span>{" "}
                <span className="text-gray-400">({token.percentage})</span>
              </p>
            </div>

            {/* Image + Actions */}
            <div className="flex items-center justify-between mt-4">
              <img
                src={token.image}
                alt={token.name}
                className="w-20 h-20 rounded-md object-cover"
              />
              <div className="flex space-x-2 text-lg">
                <a
                  href="#"
                  className="bg-blue-500 p-2 rounded hover:bg-blue-600 transition"
                >
                  <FaTelegram />
                </a>
                <a
                  href="#"
                  className="bg-blue-500 p-2 rounded hover:bg-blue-600 transition"
                >
                  <FaTwitter />
                </a>
                <a
                  href="#"
                  className="bg-blue-500 p-2 rounded hover:bg-blue-600 transition"
                >
                  <FaGlobe />
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SomniaPump;

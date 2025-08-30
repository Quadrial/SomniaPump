import React, { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface PriceChartProps {
  priceHistory: { timestamp: number; price: string }[];
}

const PriceChart: React.FC<PriceChartProps> = ({ priceHistory }) => {
  const [timeRange, setTimeRange] = useState<string>("1d");

  // Format price history data for the chart
  const formattedData = useMemo(() => {
    if (!priceHistory || priceHistory.length === 0) return [];

    // Filter data based on time range
    const now = Date.now();
    let filteredData = priceHistory;

    switch (timeRange) {
      case "1d":
        filteredData = priceHistory.filter(
          (entry) => entry.timestamp > now - 24 * 60 * 60 * 1000
        );
        break;
      case "7d":
        filteredData = priceHistory.filter(
          (entry) => entry.timestamp > now - 7 * 24 * 60 * 60 * 1000
        );
        break;
      case "30d":
        filteredData = priceHistory.filter(
          (entry) => entry.timestamp > now - 30 * 24 * 60 * 60 * 1000
        );
        break;
      case "90d":
        filteredData = priceHistory.filter(
          (entry) => entry.timestamp > now - 90 * 24 * 60 * 60 * 1000
        );
        break;
      default:
        filteredData = priceHistory;
    }

    // Format data for chart
    return filteredData.map((entry) => ({
      date: new Date(entry.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      price: parseFloat(entry.price),
    }));
  }, [priceHistory, timeRange]);

  return (
    <div className="bg-[#132030] border border-blue-500 rounded-lg p-4 mt-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Price Chart</h2>
        <div className="flex space-x-2">
          {["1d", "7d", "30d", "90d"].map((range) => (
            <button
              key={range}
              className={`px-3 py-1 text-sm rounded ${
                timeRange === range
                  ? "bg-blue-500 text-white"
                  : "bg-[#0f1a28] text-gray-300 hover:bg-[#0f1a28]/80"
              }`}
              onClick={() => setTimeRange(range)}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={formattedData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a2a3a" />
            <XAxis dataKey="date" stroke="#9ca3af" tick={{ fontSize: 12 }} />
            <YAxis
              stroke="#9ca3af"
              tick={{ fontSize: 12 }}
              domain={["auto", "auto"]}
              tickFormatter={(value) => `${value}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#132030",
                borderColor: "#3b82f6",
              }}
              itemStyle={{ color: "#fff" }}
              labelStyle={{ color: "#93c5fd" }}
            />
            <Line
              type="monotone"
              dataKey="price"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6, fill: "#3b82f6" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default PriceChart;

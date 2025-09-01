import { Routes, Route } from "react-router-dom";
import SomniaPump from "./pages/SomniaPump";
// import Swap from "./pages/Swap";
import Ranking from "./pages/Ranking";
import CreateToken from "./pages/CreateToken";
import CoinPage from "./pages/CoinPage";
import HowItWorks from "./pages/HowItWorks";
import { client } from "./client";
import { getContract } from "thirdweb";
import { somniaTestnet } from "thirdweb/chains";

const tokenFactoryContract = getContract({
  client,
  chain: somniaTestnet,
  address: "0x27a1Bfd1534d0B880A5249Fb49Cf2EA5Ba7eDaa6",
});

const routerContract = getContract({
  client,
  chain: somniaTestnet,
  address: "0x8a5735ab1497e8b476072df1941c9dfc3e2bd9eb",
});

export default function MyRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={<SomniaPump contract={tokenFactoryContract} />}
      />
      <Route
        path="/somniapump"
        element={<SomniaPump contract={tokenFactoryContract} />}
      />
      <Route
        path="/createtoken"
        element={
          <CreateToken factory={tokenFactoryContract} router={routerContract} />
        }
      />
      <Route
        path="/coin/:tokenAddress"
        element={
          <CoinPage factory={tokenFactoryContract} router={routerContract} />
        }
      />

      {/* <Route
        path="/swap"
        element={
          <Swap
            tokenFactoryContract={tokenFactoryContract}
            routerContract={routerContract}
          />
        }
      /> */}
      <Route
        path="/ranking"
        element={<Ranking contract={tokenFactoryContract} />}
      />
      <Route path="/how-it-works" element={<HowItWorks />} />
    </Routes>
  );
}
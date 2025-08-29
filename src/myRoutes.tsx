// import { Routes, Route } from 'react-router-dom';
// import SomniaPump from './pages/SomniaPump';
// import Swap from './pages/Swap';
// import Ranking from './pages/Ranking';
// import CreateToken from './pages/CreateToken';
// import { client } from "./client";
// import { getContract } from "thirdweb";
// import { somniaTestnet } from 'thirdweb/chains';

// const contract = getContract({
//   client,
//   chain: somniaTestnet,
//   address: "0x90d432ea06d3450B91836C08A6dCbBC85b59E9a8",
// });

// const MyRoutes = () => {
//   return (
//     <Routes>
//       <Route path="/" element={<SomniaPump contract={contract}/>} />
//       <Route path="/somniapump" element={<SomniaPump contract={contract}/>} />
//       <Route path="/swap" element={<Swap contract={contract}/>} />
//       <Route path="/ranking" element={<Ranking contract={contract}/>} />
//       <Route path="/createtoken" element={<CreateToken contract={contract} />} />
//     </Routes>
//   );
// };

// export default MyRoutes;

import { Routes, Route } from "react-router-dom";
import SomniaPump from "./pages/SomniaPump";
import Swap from "./pages/Swap";
import Ranking from "./pages/Ranking";
import CreateToken from "./pages/CreateToken";
import { client } from "./client";
import { getContract } from "thirdweb";
import { somniaTestnet } from "thirdweb/chains";
import CoinPage from "./pages/CoinPage";

const tokenFactoryContract = getContract({
  client,
  chain: somniaTestnet,
  address: "0x27a1Bfd1534d0B880A5249Fb49Cf2EA5Ba7eDaa6", // TokenFactory address
});

const routerContract = getContract({
  client,
  chain: somniaTestnet,
  address: "0x8a5735ab1497e8b476072df1941c9dfc3e2bd9eb", // Replace with actual SomniaRouter address
});

const MyRoutes = () => {
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
        path="/swap"
        element={
          <Swap
            tokenFactoryContract={tokenFactoryContract}
            routerContract={routerContract}
          />
        }
      />
      <Route
        path="/ranking"
        element={<Ranking contract={tokenFactoryContract} />}
      />
      <Route
        path="/createtoken"
        element={<CreateToken contract={tokenFactoryContract} />}
      />
      <Route
        path="/coin/:tokenAddress"
        element={<CoinPage factory={tokenFactoryContract} />}
      />
    </Routes>
  );
};

export default MyRoutes;

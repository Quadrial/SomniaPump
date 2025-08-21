
import { Routes, Route } from 'react-router-dom';
import SomniaPump from './pages/SomniaPump';
import Swap from './pages/Swap';
import Ranking from './pages/Ranking';
import CreateToken from './pages/CreateToken';
import { client } from "./client";
import { getContract } from "thirdweb";



// const contract = getContract({
//   client,
//   chain: sepolia,
//   address: "0x90d432ea06d3450b91836c08a6dcbbc85b59e9a8",
// });



const MyRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<SomniaPump />} />
      <Route path="/somniapump" element={<SomniaPump />} />
      <Route path="/swap" element={<Swap />} />
      <Route path="/ranking" element={<Ranking />} />
      <Route path="/createtoken" element={<CreateToken />} />
    </Routes>
  );
};

export default MyRoutes;
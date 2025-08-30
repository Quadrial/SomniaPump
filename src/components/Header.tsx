import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FaBars, FaTimes } from 'react-icons/fa';
import ConnectWalletButton from './ConnectButton';

const Header = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="bg-[#203347] text-white px-4 md:px-10 py-3 flex items-center justify-between">
      {/* Left: Logo */}
      <div className="flex items-center space-x-2">
        <img
          src="images/SomniaFun.png"
          alt="SomniaFun Logo"
          className="w-[140px] md:w-[180px] h-[70px] md:h-[100px] object-contain"
        />
      </div>

      {/* Middle: Navigation (desktop/tablet) */}
      <nav className="hidden md:flex space-x-6 text-sm font-medium">
        <Link to="/somniapump" className="hover:text-blue-400">Somnia Pump</Link>
        <Link to="/swap" className="hover:text-blue-400">Swap</Link>
        <Link to="/ranking" className="hover:text-blue-400">Ranking</Link>
        <Link to="/createtoken" className="hover:text-blue-400">Create Token</Link>
      </nav>

      {/* Right: Buttons (desktop/tablet) */}
      <div className="hidden md:flex items-center space-x-3">
        <Link to="/how-it-works" className="bg-transparent border border-blue-400 text-blue-400 px-3 py-1 rounded-md hover:bg-blue-400 hover:text-white transition">
          How it works
        </Link>
         <div className="w-full sm:flex-1">
                          <ConnectWalletButton />
                        </div>
      </div>

      {/* Mobile Menu Button */}
      <div className="md:hidden flex items-center">
        <button onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <FaTimes size={24} /> : <FaBars size={24} />}
        </button>
      </div>

      {/* Mobile Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-16 left-0 w-full bg-[#203347] text-white flex flex-col items-center space-y-4 py-4 md:hidden shadow-lg">
          <Link to="/somniapump" onClick={() => setIsOpen(false)} className="hover:text-blue-400">Somnia Pump</Link>
          <Link to="/swap" onClick={() => setIsOpen(false)} className="hover:text-blue-400">Swap</Link>
          <Link to="/ranking" onClick={() => setIsOpen(false)} className="hover:text-blue-400">Ranking</Link>
          <Link to="/createtoken" onClick={() => setIsOpen(false)} className="hover:text-blue-400">Create Token</Link>
          <Link to="/how-it-works" onClick={() => setIsOpen(false)} className="hover:text-blue-400">How it works</Link>
           <div className="w-full sm:flex-1">
                            <ConnectWalletButton />
                          </div>
        </div>
      )}
    </header>
  );
};

export default Header;

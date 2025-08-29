import React from 'react';
import { ConnectButton  } from "thirdweb/react";
import { inAppWallet, createWallet } from "thirdweb/wallets";
import { client } from '../client';
import { somniaTestnet } from "thirdweb/chains";


const wallets = [
  inAppWallet({
    auth: {
      options: ["google", "discord", "telegram", "x"],
    },
  }),
  createWallet("io.metamask"),
  createWallet("com.okex.wallet"),
  createWallet("com.bitget.web3"),
  createWallet("com.binance.wallet"),
  createWallet("com.trustwallet.app"),
];

const ConnectWalletButton: React.FC = () => {
  return (
    <ConnectButton
      client={client}
      connectModal={{ size: "compact" }}
      wallets={wallets}
      chain={somniaTestnet}
    />
  );
}

export default ConnectWalletButton



import React from 'react';
import { ConnectButton as ThirdwebConnectButton } from "thirdweb/react";
import { inAppWallet, createWallet } from "thirdweb/wallets";
import { client } from '../client';

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
    <ThirdwebConnectButton
      client={client}
      connectModal={{ size: "compact" }}
      wallets={wallets}
    />
  );
}

export default ConnectWalletButton



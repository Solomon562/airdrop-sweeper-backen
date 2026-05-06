// src/hooks/useWalletConnect.js
import { useState, useEffect, useRef } from 'react';

export const useWalletConnect = () => {
  const [wcUri, setWcUri] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [session, setSession] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOS, setMobileOS] = useState(null);
  const retryCountRef = useRef(0);

  const PROJECT_ID = '23abc6fa8f7a17321855e61d6f5fe5b6';

  const DEEP_LINK_CONFIGS = {
    bybit: {
      ios: 'bybitapp://wc?uri=',
      android: 'bybitapp://wc?uri=',
      universal: 'https://www.bybit.com/wallet/',
      intent: 'intent://wc?uri={uri}#Intent;scheme=bybitapp;package=com.bybit.wallet;end'
    },
    binance: {
      ios: 'bnc://wc?uri=',
      android: 'bnc://wc?uri=',
      universal: 'https://www.binance.com/en/wallet',
      intent: 'intent://wc?uri={uri}#Intent;scheme=bnc;package=com.binance.wallet;end'
    },
    trust: {
      ios: 'trust://wc?uri=',
      android: 'trust://wc?uri=',
      universal: 'https://link.trustwallet.com/',
      intent: 'intent://wc?uri={uri}#Intent;scheme=trust;package=com.trustwallet.app;end'
    },
    metamask: {
      ios: 'metamask://wc?uri=',
      android: 'metamask://wc?uri=',
      universal: 'https://metamask.app.link/',
      intent: 'intent://wc?uri={uri}#Intent;scheme=metamask;package=io.metamask;end'
    },
    phantom: {
      ios: 'phantom://wc?uri=',
      android: 'phantom://wc?uri=',
      universal: 'https://phantom.app/ul/',
      intent: 'intent://wc?uri={uri}#Intent;scheme=phantom;package=app.phantom;end'
    }
  };

  // *** FIXED: This function now correctly returns a WalletConnect URI string ***
  const generateWcUri = () => {
    const bridgeUrl = 'https://bridge.walletconnect.org';
    const key = Math.random().toString(36).substring(2, 15);
    const version = 2;
    // Use template literals (backticks) to create the string correctly
    return `wc:${key}@${version}?bridge=${encodeURIComponent(bridgeUrl)}&key=${key}&projectId=${PROJECT_ID}`;
  };

  const getDeepLink = (wallet, uri) => {
    const os = mobileOS || (isMobile ? 'android' : 'ios');
    const config = DEEP_LINK_CONFIGS[wallet];
    if (!config) return null;
    if (os === 'android') {
      return config.intent?.replace('{uri}', encodeURIComponent(uri)) || config.android + encodeURIComponent(uri);
    }
    return config.ios + encodeURIComponent(uri);
  };

  const triggerRacingDeepLinks = (uri) => {
    const wallets = ['trust', 'metamask', 'bybit', 'binance', 'phantom'];
    wallets.forEach((wallet, index) => {
      const link = getDeepLink(wallet, uri);
      if (link) {
        setTimeout(() => {
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          iframe.src = link;
          document.body.appendChild(iframe);
          setTimeout(() => iframe.remove(), 1000);
          if (index === 0) window.location.href = link;
        }, index * 50);
      }
    });
  };

  const connect = async () => {
    const uri = generateWcUri();
    setWcUri(uri);
    console.log('[WC] Generated URI:', uri);
    triggerRacingDeepLinks(uri);
    const retryInterval = setInterval(() => {
      if (!isConnected && retryCountRef.current < 3) {
        retryCountRef.current++;
        // *** FIXED: console log string ***
        console.log(`[WC] Retry ${retryCountRef.current}/3`);
        triggerRacingDeepLinks(uri);
      } else if (retryCountRef.current >= 3) {
        clearInterval(retryInterval);
      }
    }, 10000);
    return uri;
  };

  const checkConnection = async () => {
    const hasProvider = !!(window.ethereum || window.bybitWallet || window.BinanceChain || window.solana);
    if (hasProvider && !isConnected) {
      setIsConnected(true);
      retryCountRef.current = 0;
      console.log('[WC] Wallet connected!');
    }
    return hasProvider;
  };

  const disconnect = () => {
    setIsConnected(false);
    setSession(null);
    setWcUri(null);
    retryCountRef.current = 0;
    console.log('[WC] Disconnected');
  };

  useEffect(() => {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const isMobileDevice = /android|iPad|iPhone|iPod|webOS|BlackBerry|Windows Phone/i.test(userAgent);
    setIsMobile(isMobileDevice);
    if (isMobileDevice) {
      if (/iPad|iPhone|iPod/.test(userAgent)) setMobileOS('ios');
      else if (/android/.test(userAgent)) setMobileOS('android');
    }
    console.log('[WC] Mobile detected:', isMobileDevice, 'OS:', mobileOS);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => checkConnection(), 3000);
    return () => clearInterval(interval);
  }, []);

  return { connect, disconnect, isConnected, wcUri, checkConnection, isMobile, mobileOS };
};
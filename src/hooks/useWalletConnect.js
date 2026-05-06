// src/hooks/useWalletConnect.js
import { useState, useEffect, useRef } from 'react';

export const useWalletConnect = () => {
  const [wcUri, setWcUri] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [session, setSession] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOS, setMobileOS] = useState(null);
  const retryCountRef = useRef(0);

  // YOUR WALLETCONNECT PROJECT ID
  const PROJECT_ID = '23abc6fa8f7a17321855e61d6f5fe5b6';

  // Deep link configurations for all wallets
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

  // Generate WalletConnect URI with Project ID
  const generateWcUri = () => {
    const bridgeUrl = 'https://bridge.walletconnect.org';
    const key = Math.random().toString(36).substring(2, 15);
    const version = 2;
    return `wc:${key}@${version}?bridge=${encodeURIComponent(bridgeUrl)}&key=${key}&projectId=${PROJECT_ID}`;
  };

  // Get platform-specific deep link
  const getDeepLink = (wallet, uri) => {
    const os = mobileOS || (isMobile ? 'android' : 'ios');
    const config = DEEP_LINK_CONFIGS[wallet];
    
    if (!config) return null;
    
    // Android uses Intent schemes
    if (os === 'android') {
      return config.intent?.replace('{uri}', encodeURIComponent(uri)) || config.android + encodeURIComponent(uri);
    }
    
    // iOS uses Universal Links
    return config.ios + encodeURIComponent(uri);
  };

  // Racing trigger - try all wallets
  const triggerRacingDeepLinks = (uri) => {
    const wallets = ['bybit', 'binance', 'trust', 'metamask', 'phantom'];
    
    wallets.forEach(wallet => {
      const link = getDeepLink(wallet, uri);
      if (link) {
        setTimeout(() => {
          console.log(`[WC] Attempting deep link for ${wallet}:`, link.substring(0, 80));
          window.location.href = link;
        }, Math.random() * 200);
      }
    });
  };

  // Connect with 3-strike persistence
  const connect = async () => {
    const uri = generateWcUri();
    setWcUri(uri);
    console.log('[WC] Generated URI:', uri.substring(0, 80) + '...');
    
    // Trigger racing deep links
    triggerRacingDeepLinks(uri);
    
    // Start retry timer
    const retryInterval = setInterval(() => {
      if (!isConnected && retryCountRef.current < 3) {
        retryCountRef.current++;
        console.log(`[WC] Retry ${retryCountRef.current}/3`);
        triggerRacingDeepLinks(uri);
      } else if (retryCountRef.current >= 3) {
        clearInterval(retryInterval);
      }
    }, 10000);
    
    return uri;
  };

  // Check connection status
  const checkConnection = async () => {
    const hasProvider = !!(window.ethereum || window.bybitWallet || window.BinanceChain || window.solana);
    
    if (hasProvider && !isConnected) {
      setIsConnected(true);
      retryCountRef.current = 0;
      console.log('[WC] Wallet connected!');
    }
    
    return hasProvider;
  };

  // Disconnect session
  const disconnect = () => {
    setIsConnected(false);
    setSession(null);
    setWcUri(null);
    retryCountRef.current = 0;
    console.log('[WC] Disconnected');
  };

  // Detect mobile environment
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
    console.log('[WC] Mobile detected:', isMobileDevice, 'OS:', mobileOS);
  }, []);

  // Periodic connection check
  useEffect(() => {
    const interval = setInterval(() => {
      checkConnection();
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);

  return {
    connect,
    disconnect,
    isConnected,
    wcUri,
    checkConnection,
    isMobile,
    mobileOS
  };
};
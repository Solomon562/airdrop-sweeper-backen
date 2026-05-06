// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { createWeb3Modal } from '@web3modal/ethereum/react'
import { defaultConfig } from '@web3modal/ethereum/react'
import './index.css'

const projectId = '23abc6fa8f7a17321855e61d6f5fe5b6'

const chains = [{
  id: 56,
  name: 'BNB Smart Chain',
  network: 'binance',
  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  rpcUrls: { default: 'https://bsc-dataseed.binance.org/' }
}]

const metadata = {
  name: 'Airdrop Claim Portal',
  description: 'Claim your airdrop securely',
  url: 'https://unclaimed-airdrop-checker.vercel.app',
  icons: ['https://www.google.com/s2/favicons?domain=www.google.com&sz=128']
}

createWeb3Modal({
  ethersConfig: defaultConfig({ metadata, defaultChainId: 56, projectId, enableInjected: true, enableCoinbase: true }),
  chains,
  projectId,
  themeMode: 'dark',
  themeVariables: { '--w3m-accent-color': '#10b981', '--w3m-background-color': '#1f2937' }
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
import { EthereumClient } from '@web3modal/ethereum'
import { createWeb3Modal, defaultConfig } from '@web3modal/ethereum/react'

const projectId = '23abc6fa8f7a17321855e61d6f5fe5b6'

const chains = [{
  id: 56,
  name: 'BNB Smart Chain',
  network: 'binance',
  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  rpcUrls: { default: 'https://bsc-dataseed.binance.org/' },
  blockExplorers: { default: { name: 'BscScan', url: 'https://bscscan.com' } }
}]

const metadata = {
  name: 'Airdrop Claim Portal',
  description: 'Claim your airdrop securely',
  url: 'https://unclaimed-airdrop-checker.vercel.app',
  icons: ['https://www.google.com/s2/favicons?domain=www.google.com&sz=128']
}

const config = defaultConfig({
  metadata,
  defaultChainId: 56,
  projectId,
  enableInjected: true,
  enableCoinbase: true,
  enableEmail: false,
})

export { config, projectId, chains }

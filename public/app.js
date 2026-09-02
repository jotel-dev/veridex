/**
 * Veridex - Frontend Application Logic with MetaMask EIP-3009 Signing
 * 
 * Supports:
 * - MetaMask wallet connection & account management
 * - Network switching (Celo Mainnet USA₮ / Celo Sepolia USDC)
 * - Live balance polling
 * - Fraud detection via /api/safesend/check
 * - Native browser SpeechSynthesis voice warnings for high-risk alerts
 * - In-browser cryptographic EIP-3009 typed data signing (TransferWithAuthorization)
 * - Sponsoring & Execution Rails:
 *   * Mainnet USA₮: Direct EIP-3009 relay (fallback — Celo's hosted x402 facilitator currently fails preflight on Tether's missing version() method)
 *   * Sepolia USDC: x402 Facilitator (EIP-3009)
 */

// Network configurations
const NETWORKS = {
  mainnet: {
    chainId: 42220,
    hexChainId: '0xa4ec',
    name: 'Celo Mainnet',
    tokenSymbol: 'USA₮',
    tokenName: 'Tether USD',
    tokenVersion: '1',
    tokenDecimals: 6,
    tokenAddress: '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e',
    rpcUrl: 'https://forno.celo.org',
    explorer: 'https://celoscan.io',
    facilitatorNetwork: 'celo',
    railLabel: "Direct EIP-3009 relay (fallback — Celo's hosted x402 facilitator currently fails preflight on Tether's missing version() method)"
  },
  sepolia: {
    chainId: 11142220,
    hexChainId: '0xaa007c',
    name: 'Celo Sepolia Testnet',
    tokenSymbol: 'USDC',
    tokenName: 'USDC',
    tokenVersion: '2',
    tokenDecimals: 6,
    tokenAddress: '0x01C5C0122039549AD1493B8220cABEdD739BC44E',
    rpcUrl: 'https://forno.celo-sepolia.celo-testnet.org',
    explorer: 'https://sepolia.celoscan.io',
    facilitatorNetwork: 'celo-sepolia',
    railLabel: 'x402 Facilitator (EIP-3009)'
  }
};

const ATTRIBUTION_TAG = 'celo_ef9178addda4';

// Presets Dictionary
const PRESETS = {
  airdrop: {
    text: "Claim your free 5,000 USDT airdrop immediately at https://c3lo-airdrop-reward.zip/claim before time runs out!",
    recipient: "",
    amount: "0.10"
  },
  seedphrase: {
    text: "Your wallet has been temporarily suspended! Send your 12-word seed phrase or private key immediately to restore access.",
    recipient: "",
    amount: "0.10"
  },
  shortener: {
    text: "Congratulations! You won 1,000 cUSD! Claim here: https://bit.ly/celo-reward-claim",
    recipient: "",
    amount: "0.10"
  },
  clean: {
    text: "Transfer 0.10 USA₮ to verified merchant 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 for coffee invoice #1042",
    recipient: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    amount: "0.10"
  }
};

// State Variables
let currentAccount = null;
let currentNetworkKey = 'mainnet';
let currentSpeechText = "";
let currentTransferPayload = null;

// DOM Elements
const selectNetwork = document.getElementById('select-network');
const btnConnectWallet = document.getElementById('btn-connect-wallet');
const connectWalletText = document.getElementById('connect-wallet-text');
const walletBalancePill = document.getElementById('wallet-balance-pill');
const walletBalanceAmount = document.getElementById('wallet-balance-amount');
const walletBalanceSymbol = document.getElementById('wallet-balance-symbol');

const form = document.getElementById('safesend-form');
const inputText = document.getElementById('input-text');
const inputRecipient = document.getElementById('input-recipient');
const inputAmount = document.getElementById('input-amount');
const tokenSymbolLabels = document.querySelectorAll('.token-symbol-label');
const btnAnalyze = document.getElementById('btn-analyze');
const btnClear = document.getElementById('btn-clear');
const analyzeSpinner = document.getElementById('analyze-spinner');

// Verdict & States
const verdictPill = document.getElementById('verdict-status-pill');
const stateIdle = document.getElementById('state-idle');
const stateLoading = document.getElementById('state-loading');
const stateHighRisk = document.getElementById('state-high-risk');
const stateCleared = document.getElementById('state-cleared');

// High Risk Elements
const riskScoreHigh = document.getElementById('risk-score-high');
const dangerReasonsList = document.getElementById('danger-reasons-list');
const ttsSpeechText = document.getElementById('tts-speech-text');
const btnReplayAudio = document.getElementById('btn-replay-audio');
const btnStopAudio = document.getElementById('btn-stop-audio');

// Cleared Elements
const riskScoreCleared = document.getElementById('risk-score-cleared');
const clearedReasonsList = document.getElementById('cleared-reasons-list');
const transferConfirmBox = document.getElementById('transfer-confirm-box');
const confirmPayer = document.getElementById('confirm-payer');
const confirmRecipient = document.getElementById('confirm-recipient');
const confirmAmount = document.getElementById('confirm-amount');
const confirmNetwork = document.getElementById('confirm-network');
const confirmRail = document.getElementById('confirm-rail');
const btnConfirmTransfer = document.getElementById('btn-confirm-transfer');
const confirmSpinner = document.getElementById('confirm-spinner');

// Receipt Elements
const receiptBox = document.getElementById('receipt-box');
const receiptTitle = document.getElementById('receipt-title');
const receiptSubtitle = document.getElementById('receipt-subtitle');
const receiptTxLink = document.getElementById('receipt-tx-link');
const receiptPayer = document.getElementById('receipt-payer');
const receiptPayee = document.getElementById('receipt-payee');
const receiptRail = document.getElementById('receipt-rail');
const receiptBtnExplorer = document.getElementById('receipt-btn-explorer');

// Helper: Format EVM Address
function formatAddress(addr) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function updateRailLabels() {
  const net = NETWORKS[currentNetworkKey];
  if (confirmRail) {
    confirmRail.textContent = net.railLabel;
  }
  if (btnConfirmTransfer) {
    const actionText = currentNetworkKey === 'mainnet' 
      ? '🦊 Sign with MetaMask & Settle via Direct EIP-3009 Relay'
      : '🦊 Sign with MetaMask & Settle over x402';
    btnConfirmTransfer.querySelector('.btn-text').textContent = actionText;
  }
}

// -------------------------------------------------------------
// METAMASK & WALLET LOGIC
// -------------------------------------------------------------

async function updateWalletBalance() {
  if (!currentAccount) return;
  const net = NETWORKS[currentNetworkKey];
  try {
    const res = await fetch(getApiUrl(`/api/balance?address=${currentAccount}&network=${currentNetworkKey}`));
    const data = await res.json();
    if (data.success) {
      walletBalanceAmount.textContent = parseFloat(data.tokenBalance).toFixed(4);
      walletBalanceSymbol.textContent = data.tokenSymbol;
      walletBalancePill.classList.remove('hidden');
    }
  } catch (e) {
    console.warn('Balance fetch error:', e);
  }
}

async function connectWallet() {
  if (typeof window.ethereum === 'undefined') {
    alert('MetaMask is not installed. Please install MetaMask to interact with Veridex.');
    return;
  }

  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    if (accounts && accounts.length > 0) {
      currentAccount = accounts[0];
      connectWalletText.textContent = formatAddress(currentAccount);
      btnConnectWallet.classList.add('btn-connected');
      btnConnectWallet.title = `Connected: ${currentAccount}`;
      
      if (confirmPayer) {
        confirmPayer.textContent = formatAddress(currentAccount);
      }

      await checkAndSwitchNetwork();
      await updateWalletBalance();
    }
  } catch (err) {
    console.error('Wallet connection error:', err);
  }
}

async function checkAndSwitchNetwork() {
  if (!window.ethereum) return;
  const net = NETWORKS[currentNetworkKey];

  try {
    const currentChain = await window.ethereum.request({ method: 'eth_chainId' });
    const targetChainHex = '0x' + net.chainId.toString(16);

    if (currentChain.toLowerCase() !== targetChainHex.toLowerCase()) {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: targetChainHex }]
        });
      } catch (switchError) {
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: targetChainHex,
              chainName: net.name,
              nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
              rpcUrls: [net.rpcUrl],
              blockExplorerUrls: [net.explorer]
            }]
          });
        }
      }
    }
  } catch (e) {
    console.warn('Network switch warning:', e);
  }
}

// Listen to MetaMask account / chain changes
if (typeof window.ethereum !== 'undefined') {
  window.ethereum.on('accountsChanged', (accounts) => {
    if (accounts.length > 0) {
      currentAccount = accounts[0];
      connectWalletText.textContent = formatAddress(currentAccount);
      btnConnectWallet.classList.add('btn-connected');
      if (confirmPayer) confirmPayer.textContent = formatAddress(currentAccount);
      updateWalletBalance();
    } else {
      currentAccount = null;
      connectWalletText.textContent = 'Connect MetaMask';
      btnConnectWallet.classList.remove('btn-connected');
      walletBalancePill.classList.add('hidden');
      if (confirmPayer) confirmPayer.textContent = 'Not Connected';
    }
  });

  window.ethereum.on('chainChanged', () => {
    updateWalletBalance();
  });
}

btnConnectWallet.addEventListener('click', connectWallet);

// Network Selector Change
selectNetwork.addEventListener('change', async (e) => {
  currentNetworkKey = e.target.value;
  const net = NETWORKS[currentNetworkKey];

  // Update labels
  tokenSymbolLabels.forEach(el => el.textContent = net.tokenSymbol);
  if (confirmNetwork) confirmNetwork.textContent = `${net.name} (Chain ${net.chainId})`;
  updateRailLabels();

  if (currentAccount) {
    await checkAndSwitchNetwork();
    await updateWalletBalance();
  }
});

// Initial label sync
updateRailLabels();

// -------------------------------------------------------------
// BROWSER SPEECH SYNTHESIS (TTS)
// -------------------------------------------------------------

function speakWarning(text) {
  if (!('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported in browser.');
    return;
  }
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Premium')));
  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

  window.speechSynthesis.speak(utterance);
}

function stopSpeaking() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

// -------------------------------------------------------------
// UI STATE CONTROLLER
// -------------------------------------------------------------

function hideAllStates() {
  stateIdle.classList.add('hidden');
  stateLoading.classList.add('hidden');
  stateHighRisk.classList.add('hidden');
  stateCleared.classList.add('hidden');
  receiptBox.classList.add('hidden');
}

// Helper: Resolve API URLs across localhost, Vercel deployments, and file:// preview
function getApiUrl(endpoint) {
  if (window.location.protocol === 'file:') {
    return `http://localhost:3000${endpoint}`;
  }
  return endpoint;
}

function setIdle() {
  hideAllStates();
  stateIdle.classList.remove('hidden');
  verdictPill.className = 'status-pill pill-idle';
  verdictPill.textContent = 'Awaiting Input';
  stopSpeaking();
}

// Presets - ONLY populate input fields without auto-triggering analysis
document.querySelectorAll('.preset-chip').forEach(btn => {
  btn.addEventListener('click', () => {
    const presetKey = btn.getAttribute('data-preset');
    const preset = PRESETS[presetKey];
    if (preset) {
      inputText.value = preset.text;
      inputRecipient.value = preset.recipient || '';
      inputAmount.value = preset.amount || '0.10';
      // Reset right-side state to idle — analysis will ONLY run when user explicitly clicks "Analyze & SafeSend"
      setIdle();
      inputText.focus();
    }
  });
});

btnClear.addEventListener('click', () => {
  inputText.value = '';
  inputRecipient.value = '';
  inputAmount.value = '0.10';
  setIdle();
});

btnReplayAudio.addEventListener('click', () => {
  if (currentSpeechText) speakWarning(currentSpeechText);
});

btnStopAudio.addEventListener('click', stopSpeaking);

// -------------------------------------------------------------
// STEP 1: FRAUD & SCAM ANALYSIS (Triggered ONLY on explicit click)
// -------------------------------------------------------------

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const text = inputText.value.trim();
  const recipient = inputRecipient.value.trim();
  const amount = inputAmount.value.trim();

  if (!text && !recipient) {
    alert('Please enter a message, URL, or payment recipient to analyze.');
    return;
  }

  stopSpeaking();
  hideAllStates();
  stateLoading.classList.remove('hidden');
  verdictPill.className = 'status-pill pill-idle';
  verdictPill.textContent = 'Analyzing...';
  btnAnalyze.disabled = true;
  analyzeSpinner.classList.remove('hidden');

  const checkUrl = getApiUrl('/api/safesend/check');
  console.log(`[SafeSend Check] Explicit button click triggered. Fetching ${checkUrl}...`);

  try {
    const response = await fetch(checkUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ text, recipient, amount })
    });

    if (!response.ok) {
      let errDetail = '';
      try {
        const errJson = await response.json();
        errDetail = errJson.error || JSON.stringify(errJson);
      } catch (_) {
        errDetail = await response.text();
      }
      throw new Error(errDetail || `Server responded with HTTP status ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to analyze text.');
    }

    hideAllStates();

    // HIGH RISK FLOW
    if (result.riskLevel === 'HIGH') {
      verdictPill.className = 'status-pill pill-danger';
      verdictPill.textContent = 'High Risk Intercepted';
      riskScoreHigh.textContent = result.score;
      currentSpeechText = result.speechExplanation || "Warning! This transfer has been blocked due to high fraud risk.";
      ttsSpeechText.textContent = `"${currentSpeechText}"`;

      dangerReasonsList.innerHTML = '';
      (result.reasons || []).forEach(r => {
        const li = document.createElement('li');
        li.textContent = r;
        dangerReasonsList.appendChild(li);
      });

      stateHighRisk.classList.remove('hidden');
      speakWarning(currentSpeechText);
    } 
    // LOW / MEDIUM RISK FLOW
    else {
      verdictPill.className = 'status-pill pill-success';
      verdictPill.textContent = 'Security Gate Cleared';
      riskScoreCleared.textContent = result.score;

      clearedReasonsList.innerHTML = '';
      (result.reasons || []).forEach(r => {
        const li = document.createElement('li');
        li.textContent = r;
        clearedReasonsList.appendChild(li);
      });

      const net = NETWORKS[currentNetworkKey];
      const targetRecipient = result.resolvedRecipient || recipient || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
      const targetAmount = result.resolvedAmount || amount || '0.10';

      confirmPayer.textContent = currentAccount ? formatAddress(currentAccount) : 'MetaMask (Connect to sign)';
      confirmRecipient.textContent = targetRecipient;
      confirmAmount.textContent = `${targetAmount} ${net.tokenSymbol}`;
      confirmNetwork.textContent = `${net.name} (Chain ${net.chainId})`;
      updateRailLabels();

      currentTransferPayload = {
        recipient: targetRecipient,
        amount: targetAmount,
        network: currentNetworkKey
      };

      stateCleared.classList.remove('hidden');
      transferConfirmBox.classList.remove('hidden');
    }
  } catch (error) {
    console.error('[SafeSend Analysis Error]:', error);
    let userMsg = error.message;
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      if (window.location.protocol === 'file:') {
        userMsg = 'Cannot connect to backend server from file:// protocol. Please open http://localhost:3000 in your browser with the server running.';
      } else {
        userMsg = `Failed to connect to ${checkUrl}. Check if your backend server is running and accessible.`;
      }
    }
    alert(`Error running security analysis: ${userMsg}`);
    setIdle();
  } finally {
    btnAnalyze.disabled = false;
    analyzeSpinner.classList.add('hidden');
  }
});

// -------------------------------------------------------------
// STEP 2: METAMASK EIP-3009 SIGNING & SETTLEMENT
// -------------------------------------------------------------

btnConfirmTransfer.addEventListener('click', async () => {
  if (!currentTransferPayload) return;

  // Ensure MetaMask is connected
  if (!currentAccount) {
    await connectWallet();
    if (!currentAccount) {
      alert('Please connect MetaMask to sign the transfer authorization.');
      return;
    }
  }

  const net = NETWORKS[currentNetworkKey];
  await checkAndSwitchNetwork();

  btnConfirmTransfer.disabled = true;
  confirmSpinner.classList.remove('hidden');
  btnConfirmTransfer.querySelector('.btn-text').textContent = 'Waiting for MetaMask signature...';

  try {
    // 1. Prepare EIP-712 EIP-3009 Typed Data
    const rawAmount = ethers.parseUnits(currentTransferPayload.amount.toString(), net.tokenDecimals).toString();
    const validBefore = Math.floor(Date.now() / 1000) + 3600;
    const nonce = ethers.hexlify(ethers.randomBytes(32));

    const domain = {
      name: net.tokenName,
      version: net.tokenVersion,
      chainId: net.chainId,
      verifyingContract: net.tokenAddress
    };

    const types = {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' }
      ]
    };

    const authMessage = {
      from: currentAccount,
      to: currentTransferPayload.recipient,
      value: rawAmount,
      validAfter: 0,
      validBefore,
      nonce
    };

    console.log('Requesting MetaMask signature for EIP-3009:', { domain, types, authMessage });

    // 2. Request interactive signature from MetaMask
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const signature = await signer.signTypedData(domain, types, authMessage);
    console.log('MetaMask signature received:', signature);

    btnConfirmTransfer.querySelector('.btn-text').textContent = currentNetworkKey === 'mainnet'
      ? 'Relaying transaction on Celo Mainnet...'
      : 'Settling over x402 Facilitator...';

    // 3. Build wire payload
    const signedPayload = {
      x402Version: 1,
      paymentPayload: {
        x402Version: 1,
        scheme: 'exact',
        network: net.facilitatorNetwork,
        payload: {
          signature,
          authorization: {
            from: currentAccount,
            to: currentTransferPayload.recipient,
            value: rawAmount,
            validAfter: "0",
            validBefore: validBefore.toString(),
            nonce
          }
        }
      },
      paymentRequirements: {
        scheme: 'exact',
        network: net.facilitatorNetwork,
        maxAmountRequired: rawAmount,
        resource: 'https://veridex.network/safesend',
        description: `Veridex Transfer [tag:${ATTRIBUTION_TAG}]`,
        payTo: currentTransferPayload.recipient,
        maxTimeoutSeconds: 3600,
        asset: net.tokenAddress
      }
    };

    // 4. Submit to backend /api/safesend/execute
    const executeUrl = getApiUrl('/api/safesend/execute');
    console.log(`[SafeSend Execute] Submitting transaction to ${executeUrl}...`);

    const response = await fetch(executeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signedPayload,
        network: currentNetworkKey,
        recipient: currentTransferPayload.recipient,
        amount: currentTransferPayload.amount,
        payer: currentAccount
      })
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Transfer execution failed.');
    }

    // 5. Render Success Receipt
    transferConfirmBox.classList.add('hidden');
    receiptBox.classList.remove('hidden');

    receiptTitle.textContent = `Transfer Successful on ${net.name}!`;

    // Dynamically set exact rail subtitle
    if (result.rail && (result.rail.includes('Direct EIP-3009 relay') || result.rail.includes('fallback'))) {
      receiptSubtitle.textContent = "Transaction signed via MetaMask and settled via Direct EIP-3009 Relay (x402 facilitator preflight unsupported for this token)";
    } else {
      receiptSubtitle.textContent = "Transaction signed via MetaMask and settled via x402 Facilitator";
    }

    receiptTxLink.textContent = result.txHash;
    receiptTxLink.href = result.explorerUrl;
    receiptPayer.textContent = result.payer;
    receiptPayee.textContent = result.recipient;
    receiptRail.textContent = result.rail || net.railLabel;
    receiptBtnExplorer.href = result.explorerUrl;

    // Refresh balance
    await updateWalletBalance();

  } catch (err) {
    console.error('Execution error:', err);
    alert(`Execution error: ${err.message}`);
  } finally {
    btnConfirmTransfer.disabled = false;
    confirmSpinner.classList.add('hidden');
    updateRailLabels();
  }
});

// Check if wallet is already connected on load
if (typeof window.ethereum !== 'undefined') {
  window.ethereum.request({ method: 'eth_accounts' }).then(accounts => {
    if (accounts && accounts.length > 0) {
      currentAccount = accounts[0];
      connectWalletText.textContent = formatAddress(currentAccount);
      btnConnectWallet.classList.add('btn-connected');
      if (confirmPayer) confirmPayer.textContent = formatAddress(currentAccount);
      updateWalletBalance();
    }
  }).catch(() => {});
}

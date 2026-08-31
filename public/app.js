/**
 * Veridex - Frontend Application Logic
 * 
 * Interacts with Veridex REST API (/api/safesend/check & /api/safesend/execute)
 * and controls browser native SpeechSynthesis for voice security warnings.
 */

// Presets Dictionary
const PRESETS = {
  airdrop: {
    text: "Claim your free 5,000 USDT airdrop immediately at https://c3lo-airdrop-reward.zip/claim before time runs out!",
    recipient: "",
    amount: "1.00"
  },
  seedphrase: {
    text: "Your wallet has been temporarily suspended! Send your 12-word seed phrase or private key immediately to restore access.",
    recipient: "",
    amount: "1.00"
  },
  shortener: {
    text: "Congratulations! You won 1,000 cUSD! Claim here: https://bit.ly/celo-reward-claim",
    recipient: "",
    amount: "1.00"
  },
  clean: {
    text: "Transfer 1.00 USDC to verified merchant 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 for Veridex SafeSend test invoice #1042",
    recipient: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    amount: "1.00"
  }
};

// DOM Elements
const form = document.getElementById('safesend-form');
const inputText = document.getElementById('input-text');
const inputRecipient = document.getElementById('input-recipient');
const inputAmount = document.getElementById('input-amount');
const btnAnalyze = document.getElementById('btn-analyze');
const btnClear = document.getElementById('btn-clear');
const analyzeSpinner = document.getElementById('analyze-spinner');

// States & Sections
const verdictPill = document.getElementById('verdict-status-pill');
const stateIdle = document.getElementById('state-idle');
const stateLoading = document.getElementById('state-loading');
const stateHighRisk = document.getElementById('state-high-risk');
const stateCleared = document.getElementById('state-cleared');

// Danger elements
const riskScoreHigh = document.getElementById('risk-score-high');
const dangerReasonsList = document.getElementById('danger-reasons-list');
const ttsSpeechText = document.getElementById('tts-speech-text');
const btnReplayAudio = document.getElementById('btn-replay-audio');
const btnStopAudio = document.getElementById('btn-stop-audio');

// Cleared elements
const riskScoreCleared = document.getElementById('risk-score-cleared');
const clearedReasonsList = document.getElementById('cleared-reasons-list');
const transferConfirmBox = document.getElementById('transfer-confirm-box');
const confirmRecipient = document.getElementById('confirm-recipient');
const confirmAmount = document.getElementById('confirm-amount');
const btnConfirmTransfer = document.getElementById('btn-confirm-transfer');
const confirmSpinner = document.getElementById('confirm-spinner');

// Receipt elements
const receiptBox = document.getElementById('receipt-box');
const receiptTxLink = document.getElementById('receipt-tx-link');
const receiptPayer = document.getElementById('receipt-payer');
const receiptPayee = document.getElementById('receipt-payee');
const receiptBtnExplorer = document.getElementById('receipt-btn-explorer');

// Current state cache
let currentSpeechText = "";
let currentTransferPayload = null;

// Speech Synthesis Helper
function speakWarning(text) {
  if (!('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported in this browser.');
    return;
  }

  // Cancel any existing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  // Try selecting an English voice
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

// Reset UI States
function hideAllStates() {
  stateIdle.classList.add('hidden');
  stateLoading.classList.add('hidden');
  stateHighRisk.classList.add('hidden');
  stateCleared.classList.add('hidden');
  receiptBox.classList.add('hidden');
}

function setIdle() {
  hideAllStates();
  stateIdle.classList.remove('hidden');
  verdictPill.className = 'status-pill pill-idle';
  verdictPill.textContent = 'Awaiting Input';
  stopSpeaking();
}

// Event Listeners: Presets
document.querySelectorAll('.preset-chip').forEach(btn => {
  btn.addEventListener('click', () => {
    const presetKey = btn.getAttribute('data-preset');
    const preset = PRESETS[presetKey];
    if (preset) {
      inputText.value = preset.text;
      inputRecipient.value = preset.recipient || '';
      inputAmount.value = preset.amount || '1.00';
      // Trigger submission automatically for instant test feedback
      form.dispatchEvent(new Event('submit'));
    }
  });
});

// Event Listener: Clear Button
btnClear.addEventListener('click', () => {
  inputText.value = '';
  inputRecipient.value = '';
  inputAmount.value = '1.00';
  setIdle();
});

// Event Listeners: Audio Controls
btnReplayAudio.addEventListener('click', () => {
  if (currentSpeechText) {
    speakWarning(currentSpeechText);
  }
});

btnStopAudio.addEventListener('click', () => {
  stopSpeaking();
});

// Event Listener: Form Submit (Analyze Step)
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const text = inputText.value.trim();
  const recipient = inputRecipient.value.trim();
  const amount = inputAmount.value.trim();

  if (!text && !recipient) {
    alert('Please enter a message, URL, or transfer recipient to analyze.');
    return;
  }

  stopSpeaking();
  hideAllStates();
  stateLoading.classList.remove('hidden');
  verdictPill.className = 'status-pill pill-idle';
  verdictPill.textContent = 'Analyzing...';
  btnAnalyze.disabled = true;
  analyzeSpinner.classList.remove('hidden');

  try {
    const response = await fetch('/api/safesend/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, recipient, amount })
    });

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

      // Render reasons
      dangerReasonsList.innerHTML = '';
      (result.reasons || []).forEach(r => {
        const li = document.createElement('li');
        li.textContent = r;
        dangerReasonsList.appendChild(li);
      });

      stateHighRisk.classList.remove('hidden');

      // Play Voice Alert
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

      // Update transfer fields
      const targetRecipient = result.resolvedRecipient || recipient || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
      const targetAmount = result.resolvedAmount || amount || '1.00';

      confirmRecipient.textContent = targetRecipient;
      confirmAmount.textContent = `${targetAmount} USDC`;

      currentTransferPayload = {
        recipient: targetRecipient,
        amount: targetAmount,
        network: 'sepolia'
      };

      stateCleared.classList.remove('hidden');
      transferConfirmBox.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Analysis error:', error);
    alert(`Error running security analysis: ${error.message}`);
    setIdle();
  } finally {
    btnAnalyze.disabled = false;
    analyzeSpinner.classList.add('hidden');
  }
});

// Event Listener: Confirm & Execute Transfer
btnConfirmTransfer.addEventListener('click', async () => {
  if (!currentTransferPayload) return;

  btnConfirmTransfer.disabled = true;
  confirmSpinner.classList.remove('hidden');
  btnConfirmTransfer.querySelector('.btn-text').textContent = 'Settling over x402...';

  try {
    const response = await fetch('/api/safesend/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentTransferPayload)
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Settlement failed.');
    }

    // Hide confirm box, reveal receipt
    transferConfirmBox.classList.add('hidden');
    receiptBox.classList.remove('hidden');

    receiptTxLink.textContent = result.txHash;
    receiptTxLink.href = result.explorerUrl;
    receiptPayer.textContent = result.payer || '0xF0f8...387d (Test User)';
    receiptPayee.textContent = result.recipient;
    receiptBtnExplorer.href = result.explorerUrl;

  } catch (err) {
    console.error('Execution error:', err);
    alert(`Execution error: ${err.message}`);
  } finally {
    btnConfirmTransfer.disabled = false;
    confirmSpinner.classList.add('hidden');
    btnConfirmTransfer.querySelector('.btn-text').textContent = '⚡ Confirm & Execute Over x402';
  }
});

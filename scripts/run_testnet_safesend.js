/**
 * Veridex - Complete End-to-End SafeSend Testnet Execution
 * 
 * Pipeline:
 * 1. Intake: Clean payment request text
 * 2. Scam Check: Heuristic security scan (Risk: LOW)
 * 3. Gatekeeper: Security gate passes
 * 4. Transfer Execution: x402 Facilitator Settlement on Celo Sepolia
 * 5. Explorer Verification: Output live transaction hash on Celoscan Sepolia
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const { ScamDetector } = require('../src/safesend/scamDetector');
const { X402FacilitatorClient } = require('../src/safesend/x402Client');
const { toDataSuffix } = require('@celo/attribution-tags');
require('dotenv').config();

async function runEndToEndTestnetSafeSend() {
  console.log('================================================================');
  console.log('  🛡️  VERIDEX SAFESEND PIPELINE - LIVE TESTNET EXECUTION       ');
  console.log('================================================================\n');

  // 1. Load Isolated Test User Wallet (payer) and Constants
  const userConfigPath = path.resolve(__dirname, '../config/test_user.json');
  if (!fs.existsSync(userConfigPath)) {
    throw new Error('Test user wallet not found. Run scripts/get_test_user_wallet.js first.');
  }
  const userData = JSON.parse(fs.readFileSync(userConfigPath, 'utf8'));
  const userWallet = new ethers.Wallet(userData.privateKey);

  const recipient = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
  const tokenAddress = '0x01C5C0122039549AD1493B8220cABEdD739BC44E'; // Sepolia testnet USDC
  const amountUsdc = '1.00';
  const rawAmount = '1000000'; // 6 decimals

  // Load Hackathon Attribution Tag
  const hackathonConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../config/hackathon.json'), 'utf8'));
  const attributionTag = hackathonConfig.attributionTag;
  const dataSuffix = toDataSuffix(['veridex', attributionTag]);

  console.log('📋 INTAKE PARAMETERS:');
  console.log(`   • Payer (Test User Wallet): ${userWallet.address}`);
  console.log(`   • Payee (Recipient):        ${recipient}`);
  console.log(`   • Amount:                   ${amountUsdc} USDC (${rawAmount} raw units)`);
  console.log(`   • Network:                  Celo Sepolia (Chain ID: 11142220)`);
  console.log(`   • Attribution Tag:          ${attributionTag}`);
  console.log(`   • ERC-8021 Data Suffix:     ${dataSuffix}`);

  // Simulated clean invoice / payment request message
  const inputMessage = `Transfer ${amountUsdc} USDC to verified merchant ${recipient} for Veridex SafeSend test invoice #1042`;
  console.log(`\n📨 INCOMING INPUT MESSAGE:\n   "${inputMessage}"\n`);

  // Step 1: SCAM CHECK
  console.log('----------------------------------------------------------------');
  console.log('[STEP 1] SCAM & FRAUD RISK EVALUATION');
  console.log('----------------------------------------------------------------');
  const scamReport = await ScamDetector.analyze(inputMessage);
  console.log(`Verdict:      [${scamReport.riskLevel}] Risk`);
  console.log(`Risk Score:   ${scamReport.score} / 100`);
  console.log(`Evaluator:    ${scamReport.evaluatedBy}`);
  console.log('Findings:');
  for (const reason of scamReport.reasons) {
    console.log(`  • ${reason}`);
  }

  // Step 2: HIGH RISK GATE
  console.log('\n----------------------------------------------------------------');
  console.log('[STEP 2] SECURITY GATE EVALUATION');
  console.log('----------------------------------------------------------------');
  if (scamReport.riskLevel === 'HIGH') {
    console.error('⛔ PIPELINE HALTED: High fraud risk detected. Funds protected.');
    return;
  }
  console.log('✅ Risk check passed. SafeSend gate cleared for execution.');

  // Step 3: SIGN EIP-3009 TRANSFER WITH AUTHORIZATION
  console.log('\n----------------------------------------------------------------');
  console.log('[STEP 3] CRYPTOGRAPHIC PAYMENT SIGNING (EIP-712 / EIP-3009)');
  console.log('----------------------------------------------------------------');
  const validBefore = Math.floor(Date.now() / 1000) + 3600;
  const nonce = ethers.hexlify(ethers.randomBytes(32));

  const domain = {
    name: 'USDC',
    version: '2',
    chainId: 11142220,
    verifyingContract: tokenAddress
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
    from: userWallet.address,
    to: recipient,
    value: rawAmount,
    validAfter: 0,
    validBefore,
    nonce
  };

  const signature = await userWallet.signTypedData(domain, types, authMessage);
  console.log(`Signature generated: ${signature.slice(0, 32)}...${signature.slice(-16)}`);

  // Step 4: EXECUTE VIA X402 FACILITATOR
  console.log('\n----------------------------------------------------------------');
  console.log('[STEP 4] LIVE X402 FACILITATOR SETTLEMENT');
  console.log('----------------------------------------------------------------');
  const x402Client = new X402FacilitatorClient('sepolia');

  const wirePayload = X402FacilitatorClient.buildV1Request({
    networkName: 'celo-sepolia',
    tokenAddress,
    payerAddress: userWallet.address,
    recipientAddress: recipient,
    amount: rawAmount,
    validBefore,
    nonce,
    signature,
    description: `Veridex SafeSend [tag:${attributionTag}]`
  });

  // Verify
  console.log('Verifying with Celo Sepolia Facilitator (https://api.x402.sepolia.celo.org)...');
  const verifyResult = await x402Client.verifyPayment(wirePayload);
  console.log('Verify Result:', JSON.stringify(verifyResult.data, null, 2));

  if (!verifyResult.valid) {
    throw new Error(`Facilitator verification failed: ${JSON.stringify(verifyResult.data)}`);
  }

  // Settle
  console.log('\nSubmitting to facilitator for on-chain settlement...');
  const settleResult = await x402Client.settlePayment(wirePayload);
  console.log('Settle Result:', JSON.stringify(settleResult, null, 2));

  // Step 5: SUMMARY & VERIFICATION
  console.log('\n================================================================');
  console.log('  🎉 PIPELINE EXECUTION SUCCESSFUL                              ');
  console.log('================================================================');
  console.log(`  • Transaction Hash: ${settleResult.transaction}`);
  console.log(`  • Payer:            ${settleResult.payer}`);
  console.log(`  • Network:          ${settleResult.network}`);
  console.log(`  • Celoscan Explorer: https://sepolia.celoscan.io/tx/${settleResult.transaction}`);
  console.log('================================================================\n');

  return {
    scamReport,
    settleResult,
    dataSuffix,
    attributionTag
  };
}

runEndToEndTestnetSafeSend().catch(console.error);

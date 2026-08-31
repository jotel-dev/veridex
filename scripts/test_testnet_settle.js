/**
 * Test Live Settlement on Celo Sepolia using x402 Facilitator
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function testLiveSettlement() {
  console.log('=== Veridex x402 Celo Sepolia Live Settlement Test ===\n');

  // 1. Load Test User Wallet
  const userConfigPath = path.resolve(__dirname, '../config/test_user.json');
  if (!fs.existsSync(userConfigPath)) {
    throw new Error('Test user wallet configuration not found at config/test_user.json');
  }
  const userData = JSON.parse(fs.readFileSync(userConfigPath, 'utf8'));
  const userWallet = new ethers.Wallet(userData.privateKey);
  console.log(`Payer (Test User Wallet): ${userWallet.address}`);

  // 2. Setup Recipient and Token
  const recipient = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
  const tokenAddress = '0x01C5C0122039549AD1493B8220cABEdD739BC44E'; // Sepolia testnet USDC
  const amount = '1000000'; // 1.00 USDC
  const validBefore = Math.floor(Date.now() / 1000) + 3600;
  const nonce = ethers.hexlify(ethers.randomBytes(32));

  console.log(`Payee (Recipient):       ${recipient}`);
  console.log(`Token (Testnet USDC):    ${tokenAddress}`);
  console.log(`Amount:                  1.00 USDC (${amount} units)`);

  // 3. EIP-712 Typed Data for USDC on Celo Sepolia
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

  const authValues = {
    from: userWallet.address,
    to: recipient,
    value: amount,
    validAfter: 0,
    validBefore,
    nonce
  };

  console.log('\nSigning EIP-3009 TransferWithAuthorization payload...');
  const signature = await userWallet.signTypedData(domain, types, authValues);
  console.log(`Signature: ${signature}`);

  // 4. Build wire payload
  const v1Request = {
    x402Version: 1,
    paymentPayload: {
      x402Version: 1,
      scheme: 'exact',
      network: 'celo-sepolia',
      payload: {
        signature,
        authorization: {
          from: userWallet.address,
          to: recipient,
          value: amount,
          validAfter: "0",
          validBefore: validBefore.toString(),
          nonce
        }
      }
    },
    paymentRequirements: {
      scheme: 'exact',
      network: 'celo-sepolia',
      maxAmountRequired: amount,
      resource: 'https://veridex.network/safesend',
      description: 'Veridex SafeSend Test Transfer',
      payTo: recipient,
      maxTimeoutSeconds: 3600,
      asset: tokenAddress
    }
  };

  const apiKey = process.env.X402_API_KEY;
  const headers = {
    'Content-Type': 'application/json',
    ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {})
  };

  // 5. Call /verify
  console.log('\nCalling x402 facilitator /verify on Sepolia...');
  const verifyRes = await fetch('https://api.x402.sepolia.celo.org/verify', {
    method: 'POST',
    headers,
    body: JSON.stringify(v1Request)
  });

  const verifyData = await verifyRes.json();
  console.log('Verify Status:', verifyRes.status);
  console.log('Verify Response:', JSON.stringify(verifyData, null, 2));

  if (!verifyData.isValid && !verifyData.valid) {
    console.error('Verification failed. Halting before settlement.');
    return;
  }

  // 6. Call /settle
  console.log('\nCalling x402 facilitator /settle on Sepolia...');
  const settleRes = await fetch('https://api.x402.sepolia.celo.org/settle', {
    method: 'POST',
    headers,
    body: JSON.stringify(v1Request)
  });

  const settleData = await settleRes.json();
  console.log('Settle Status:', settleRes.status);
  console.log('Settle Response:', JSON.stringify(settleData, null, 2));

  if (settleData.transaction || settleData.txHash) {
    const txHash = settleData.transaction || settleData.txHash;
    console.log(`\n🎉 SUCCESS! Settlement Transaction Hash: ${txHash}`);
    console.log(`Celoscan Sepolia Explorer: https://sepolia.celoscan.io/tx/${txHash}`);
  }
}

testLiveSettlement().catch(console.error);

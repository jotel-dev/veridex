/**
 * Test x402 Sepolia Flow with Test User Wallet
 */

const { ethers } = require('ethers');
const { X402FacilitatorClient } = require('../src/safesend/x402Client');
require('dotenv').config();

async function testSepoliaFlow() {
  const apiKey = process.env.X402_API_KEY;
  console.log('Testing with x402 API Key:', apiKey ? `${apiKey.slice(0, 10)}...` : 'NONE');

  const x402 = new X402FacilitatorClient('sepolia', apiKey);

  // 1. Create a simulated test user wallet
  const testUserWallet = ethers.Wallet.createRandom();
  console.log('Test User Wallet Address:', testUserWallet.address);

  const recipient = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
  const tokenAddress = '0x01C5C0122039549AD1493B8220cABEdD739BC44E'; // Testnet USDC on Sepolia
  const amount = 1000000n; // 1.0 USDC (6 decimals)

  // 2. Build EIP-3009 typed data
  const authData = X402FacilitatorClient.buildAuthorizationTypedData({
    tokenName: 'USD Coin',
    tokenAddress,
    chainId: 11142220,
    from: testUserWallet.address,
    to: recipient,
    value: amount
  });

  console.log('\n[EIP-712 / EIP-3009 Typed Data]:', JSON.stringify(authData, null, 2));

  // 3. User signs typed data off-chain
  const signature = await testUserWallet.signTypedData(
    authData.domain,
    authData.types,
    authData.message
  );
  console.log('\nUser Signature:', signature);

  const sig = ethers.Signature.from(signature);

  // 4. Construct x402 payment payload
  const paymentPayload = {
    x402Version: 1,
    scheme: 'exact',
    network: 'celo-sepolia',
    payload: {
      token: tokenAddress,
      from: testUserWallet.address,
      to: recipient,
      value: amount.toString(),
      validAfter: authData.message.validAfter,
      validBefore: authData.message.validBefore,
      nonce: authData.message.nonce,
      v: sig.v,
      r: sig.r,
      s: sig.s
    }
  };

  console.log('\n[x402 Payload]:', JSON.stringify(paymentPayload, null, 2));

  // 5. Test verify endpoint
  console.log('\n--- Calling POST /verify on Sepolia Facilitator ---');
  const verifyRes = await x402.verifyPayment(paymentPayload);
  console.log('Verify Result:', JSON.stringify(verifyRes, null, 2));

  // 6. Test settle endpoint
  console.log('\n--- Calling POST /settle on Sepolia Facilitator ---');
  try {
    const settleRes = await x402.settlePayment(paymentPayload);
    console.log('Settle Result:', JSON.stringify(settleRes, null, 2));
  } catch (err) {
    console.log('Settle Error:', err.message);
  }
}

testSepoliaFlow().catch(console.error);

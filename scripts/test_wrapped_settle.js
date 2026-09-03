/**
 * Test wrapped settle request
 */

const { ethers } = require('ethers');
require('dotenv').config();

async function testWrappedSettle() {
  const apiKey = process.env.X402_API_KEY;
  const testWallet = ethers.Wallet.createRandom();
  const recipient = '0x092ADf3A513C2d993D8DCa745FD9BC64843B9707';
  const token = '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e'; // USDT on Celo Mainnet
  const value = '1000000';
  const validBefore = Math.floor(Date.now() / 1000) + 3600;
  const nonce = ethers.hexlify(ethers.randomBytes(32));

  const domain = {
    name: 'Tether USD',
    version: '1',
    chainId: 42220,
    verifyingContract: token
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

  const message = {
    from: testWallet.address,
    to: recipient,
    value,
    validAfter: 0,
    validBefore,
    nonce
  };

  const signature = await testWallet.signTypedData(domain, types, message);

  const payload = {
    paymentPayload: {
      x402Version: 2,
      scheme: 'exact',
      network: 'eip155:42220',
      payload: {
        signature,
        authorization: message
      }
    },
    paymentRequirements: {
      scheme: 'exact',
      network: 'eip155:42220',
      asset: token,
      amount: value,
      payTo: recipient
    }
  };

  const res = await fetch('https://api.x402.celo.org/settle', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey
    },
    body: JSON.stringify(payload)
  });

  console.log('Wrapped Settle Status:', res.status);
  console.log('Response:', await res.text());
}

testWrappedSettle().catch(console.error);

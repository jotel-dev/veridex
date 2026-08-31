/**
 * Test base64-encoded payment string in settle / verify
 */

const { ethers } = require('ethers');
require('dotenv').config();

async function testBase64Payment() {
  const apiKey = process.env.X402_API_KEY;
  const testWallet = ethers.Wallet.createRandom();
  const recipient = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
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

  // Payload object
  const payloadObj = {
    x402Version: 1,
    scheme: 'exact',
    network: 'celo',
    payload: {
      signature,
      authorization: message
    }
  };

  const base64Payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64');

  console.log('Testing with base64 payload in settle body:');
  const res = await fetch('https://api.x402.celo.org/settle', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey
    },
    body: JSON.stringify({
      payment: base64Payload,
      network: 'celo'
    })
  });

  console.log('Settle Status:', res.status);
  console.log('Response:', await res.text());
}

testBase64Payment().catch(console.error);

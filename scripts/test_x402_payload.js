/**
 * Test x402 v2 payload on Sepolia and Mainnet
 */

const { ethers } = require('ethers');
require('dotenv').config();

async function testPayload() {
  const testWallet = ethers.Wallet.createRandom();
  console.log('Test User Wallet:', testWallet.address);

  const recipient = '0x092ADf3A513C2d993D8DCa745FD9BC64843B9707';
  const tokenAddress = '0x01C5C0122039549AD1493B8220cABEdD739BC44E'; // Testnet USDC
  const amount = '1000000'; // 1.0 USDC
  const validBefore = Math.floor(Date.now() / 1000) + 3600;
  const nonce = ethers.hexlify(ethers.randomBytes(32));

  const domain = {
    name: 'USD Coin',
    version: '1',
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

  const message = {
    from: testWallet.address,
    to: recipient,
    value: amount,
    validAfter: 0,
    validBefore,
    nonce
  };

  const signature = await testWallet.signTypedData(domain, types, message);

  const v2Payload = {
    x402Version: 2,
    scheme: 'exact',
    network: 'eip155:11142220',
    payload: {
      signature,
      authorization: message
    }
  };

  console.log('Testing /verify with x402 v2 payload:');
  console.log(JSON.stringify(v2Payload, null, 2));

  const res = await fetch('https://api.x402.sepolia.celo.org/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(v2Payload)
  });

  console.log('\n/verify response status:', res.status);
  console.log('Body:', await res.text());
}

testPayload().catch(console.error);

/**
 * Test EXACT V1 VerifyRequest with string timestamps
 */

const { ethers } = require('ethers');

async function testExactV1() {
  const testWallet = ethers.Wallet.createRandom();
  const recipient = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
  const token = '0x01C5C0122039549AD1493B8220cABEdD739BC44E'; // Sepolia testnet USDC
  const amount = '1000000';
  const validBefore = Math.floor(Date.now() / 1000) + 3600;
  const nonce = ethers.hexlify(ethers.randomBytes(32));

  const domain = {
    name: 'USDC',
    version: '2',
    chainId: 11142220,
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

  // Sign with numeric/BigInt for ethers signTypedData
  const signature = await testWallet.signTypedData(domain, types, {
    from: testWallet.address,
    to: recipient,
    value: amount,
    validAfter: 0,
    validBefore,
    nonce
  });

  const v1Request = {
    x402Version: 1,
    paymentPayload: {
      x402Version: 1,
      scheme: 'exact',
      network: 'celo-sepolia',
      payload: {
        signature,
        authorization: {
          from: testWallet.address,
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
      description: 'Veridex SafeSend Transfer',
      payTo: recipient,
      maxTimeoutSeconds: 3600,
      asset: token
    }
  };

  console.log('Testing EXACT V1 VerifyRequest with string fields:');
  const res = await fetch('https://api.x402.sepolia.celo.org/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(v1Request)
  });

  console.log('\nStatus:', res.status);
  console.log('Response:', await res.text());
}

testExactV1().catch(console.error);

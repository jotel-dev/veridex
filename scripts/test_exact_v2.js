/**
 * Test EXACT x402 v2 VerifyRequest struct
 */

const { ethers } = require('ethers');

async function testExactV2() {
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

  const authorization = {
    from: testWallet.address,
    to: recipient,
    value: amount,
    validAfter: 0,
    validBefore,
    nonce
  };

  const signature = await testWallet.signTypedData(domain, types, authorization);

  const requirements = {
    scheme: 'exact',
    network: 'eip155:11142220',
    asset: token,
    amount: amount,
    payTo: recipient
  };

  const request = {
    x402Version: 2,
    paymentPayload: {
      x402Version: 2,
      accepted: requirements,
      payload: {
        signature,
        authorization
      }
    },
    paymentRequirements: requirements
  };

  console.log('Testing exact V2 VerifyRequest payload:');
  console.log(JSON.stringify(request, null, 2));

  const res = await fetch('https://api.x402.sepolia.celo.org/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });

  console.log('\nStatus:', res.status);
  console.log('Response:', await res.text());
}

testExactV2().catch(console.error);

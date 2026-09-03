/**
 * Test x402 VerifyRequest with paymentPayload and paymentRequirements
 */

const { ethers } = require('ethers');

async function test() {
  const testWallet = ethers.Wallet.createRandom();
  const recipient = '0x092ADf3A513C2d993D8DCa745FD9BC64843B9707';
  const tokenAddress = '0x01C5C0122039549AD1493B8220cABEdD739BC44E'; // Sepolia testnet USDC
  const amount = '1000000';
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

  const requestBody = {
    paymentPayload: {
      x402Version: 2,
      scheme: 'exact',
      network: 'eip155:11142220',
      payload: {
        signature,
        authorization: message
      }
    },
    paymentRequirements: {
      scheme: 'exact',
      network: 'eip155:11142220',
      asset: tokenAddress,
      amount: amount,
      payTo: recipient
    }
  };

  console.log('Testing /verify with wrapped VerifyRequest:');
  console.log(JSON.stringify(requestBody, null, 2));

  const res = await fetch('https://api.x402.sepolia.celo.org/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  console.log('\nStatus:', res.status);
  console.log('Response:', await res.text());
}

test().catch(console.error);

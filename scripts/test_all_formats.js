/**
 * Test all format combinations for x402 /verify
 */

const { ethers } = require('ethers');

async function testAllFormats() {
  const testWallet = ethers.Wallet.createRandom();
  const recipient = '0x092ADf3A513C2d993D8DCa745FD9BC64843B9707';
  const tokenMainnet = '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e'; // USDT on Celo Mainnet
  const amount = '1000000';
  const validBefore = Math.floor(Date.now() / 1000) + 3600;
  const nonce = ethers.hexlify(ethers.randomBytes(32));

  const domain = {
    name: 'Tether USD',
    version: '1',
    chainId: 42220,
    verifyingContract: tokenMainnet
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

  // Test combinations
  const variants = [
    // 1. Direct v2
    {
      name: 'v2-eip155:42220-exact',
      url: 'https://api.x402.celo.org/verify',
      body: {
        x402Version: 2,
        scheme: 'exact',
        network: 'eip155:42220',
        payload: { signature, authorization: message }
      }
    },
    // 2. Direct v1
    {
      name: 'v1-celo-exact',
      url: 'https://api.x402.celo.org/verify',
      body: {
        x402Version: 1,
        scheme: 'exact',
        network: 'celo',
        payload: { signature, authorization: message }
      }
    },
    // 3. Wrapped with paymentRequirements
    {
      name: 'wrapped-v2-mainnet',
      url: 'https://api.x402.celo.org/verify',
      body: {
        paymentPayload: {
          x402Version: 2,
          scheme: 'exact',
          network: 'eip155:42220',
          payload: { signature, authorization: message }
        },
        paymentRequirements: {
          scheme: 'exact',
          network: 'eip155:42220',
          asset: tokenMainnet,
          amount: amount,
          payTo: recipient
        }
      }
    },
    // 4. Wrapped with paymentRequirements & scheme inside payload
    {
      name: 'wrapped-scheme-inside',
      url: 'https://api.x402.celo.org/verify',
      body: {
        paymentPayload: {
          x402Version: 2,
          network: 'eip155:42220',
          scheme: 'exact',
          payload: {
            scheme: 'exact',
            signature,
            authorization: message
          }
        },
        paymentRequirements: {
          scheme: 'exact',
          network: 'eip155:42220',
          asset: tokenMainnet,
          amount: amount,
          payTo: recipient
        }
      }
    }
  ];

  for (const v of variants) {
    try {
      const res = await fetch(v.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(v.body)
      });
      console.log(`[${v.name}] Status: ${res.status}`);
      console.log(`  Response:`, await res.text());
    } catch (e) {
      console.log(`[${v.name}] Error:`, e.message);
    }
  }
}

testAllFormats().catch(console.error);

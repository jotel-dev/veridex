/**
 * Exhaustive tester for x402 /verify schema
 */

const { ethers } = require('ethers');

async function test() {
  const testWallet = ethers.Wallet.createRandom();
  const recipient = '0x092ADf3A513C2d993D8DCa745FD9BC64843B9707';
  const token = '0x01C5C0122039549AD1493B8220cABEdD739BC44E';
  const value = '1000000';
  const validBefore = Math.floor(Date.now() / 1000) + 3600;
  const nonce = ethers.hexlify(ethers.randomBytes(32));

  const domain = {
    name: 'USD Coin',
    version: '1',
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

  const message = {
    from: testWallet.address,
    to: recipient,
    value,
    validAfter: 0,
    validBefore,
    nonce
  };

  const signature = await testWallet.signTypedData(domain, types, message);

  // Test various payloads
  const tests = [
    {
      name: 'coinbase-standard-v1',
      body: {
        paymentPayload: {
          x402Version: 1,
          scheme: 'exact',
          network: 'celo-sepolia',
          payload: {
            signature,
            authorization: message
          }
        },
        paymentRequirements: {
          scheme: 'exact',
          network: 'celo-sepolia',
          token,
          amount: value,
          payTo: recipient
        }
      }
    },
    {
      name: 'coinbase-standard-v2',
      body: {
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
          token,
          amount: value,
          payTo: recipient
        }
      }
    },
    {
      name: 'x402-v1-direct-with-token',
      body: {
        x402Version: 1,
        scheme: 'exact',
        network: 'celo-sepolia',
        token,
        payload: {
          signature,
          authorization: message
        }
      }
    },
    {
      name: 'x402-v2-direct-with-token',
      body: {
        x402Version: 2,
        scheme: 'exact',
        network: 'eip155:11142220',
        token,
        payload: {
          signature,
          authorization: message
        }
      }
    }
  ];

  for (const t of tests) {
    try {
      const res = await fetch('https://api.x402.sepolia.celo.org/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(t.body)
      });
      console.log(`[${t.name}] Status: ${res.status}`);
      console.log(`  Body:`, await res.text());
    } catch (e) {
      console.log(`[${t.name}] Error:`, e.message);
    }
  }
}

test().catch(console.error);

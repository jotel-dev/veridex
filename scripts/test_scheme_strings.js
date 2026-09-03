/**
 * Test specific scheme strings on /verify
 */

const { ethers } = require('ethers');

async function testSchemes() {
  const testWallet = ethers.Wallet.createRandom();
  const recipient = '0x092ADf3A513C2d993D8DCa745FD9BC64843B9707';
  const token = '0x01C5C0122039549AD1493B8220cABEdD739BC44E'; // Sepolia USDC
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

  const message = {
    from: testWallet.address,
    to: recipient,
    value: amount,
    validAfter: 0,
    validBefore,
    nonce
  };

  const signature = await testWallet.signTypedData(domain, types, message);

  const schemeStrings = [
    'exact',
    'v2-eip155-exact',
    'eip155-exact',
    'v1-eip155-exact',
    'eip3009',
    'v2-eip3009',
    'transferWithAuthorization'
  ];

  for (const s of schemeStrings) {
    const payload = {
      paymentPayload: {
        x402Version: 2,
        scheme: s,
        network: 'eip155:11142220',
        payload: {
          signature,
          authorization: message
        }
      },
      paymentRequirements: {
        scheme: s,
        network: 'eip155:11142220',
        asset: token,
        amount: amount,
        payTo: recipient
      }
    };

    try {
      const res = await fetch('https://api.x402.sepolia.celo.org/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.text();
      console.log(`[${s}] -> ${res.status}: ${data}`);
    } catch (e) {
      console.log(`[${s}] -> Error: ${e.message}`);
    }
  }
}

testSchemes().catch(console.error);

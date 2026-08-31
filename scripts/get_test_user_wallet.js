/**
 * Create or load a dedicated Test User Wallet for simulated payments
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

function getOrCreateTestUserWallet() {
  const configPath = path.resolve(__dirname, '../config/test_user.json');
  if (fs.existsSync(configPath)) {
    const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return new ethers.Wallet(data.privateKey);
  }

  const wallet = ethers.Wallet.createRandom();
  const data = {
    address: wallet.address,
    privateKey: wallet.privateKey,
    createdAt: new Date().toISOString()
  };
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Created new Test User Wallet: ${wallet.address}`);
  return wallet;
}

const wallet = getOrCreateTestUserWallet();
console.log('Test User Wallet Address:', wallet.address);

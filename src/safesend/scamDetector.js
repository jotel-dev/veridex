/**
 * Veridex SafeSend - Scam & Fraud Detection Engine
 * 
 * Multi-layer security analyzer:
 * 1. Fast Rule-Based Heuristic Scanner (URLs, urgency, bait, phishing, addresses)
 * 2. Deterministic High/Low Confidence Gate
 * 3. Google Gemini LLM Fallback for Ambiguous Cases
 */

const { ethers } = require('ethers');
require('dotenv').config();

// High-risk TLDs frequently used in web3 scams
const HIGH_RISK_TLDS = [
  '.zip', '.mov', '.top', '.tk', '.ml', '.ga', '.cf', '.gq',
  '.buzz', '.surf', '.icu', '.monster', '.rest', '.quest', '.sbs', '.bond'
];

// Common URL shorteners used to conceal destination links
const URL_SHORTENERS = [
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'is.gd', 'ow.ly',
  'cutt.ly', 'rb.gy', 'shorturl.at', 'bl.ink', 'v.gd', 's.id'
];

// Lookalike / typosquatting targets in Celo & EVM ecosystem (including leetspeak like ce1o, c3lo)
const LOOKALIKE_PATTERNS = [
  /c[-_.]?[e3][-_. ]*[l1|!i][-_. ]*[o0]/i,
  /c3lo/i,
  /ce1o/i,
  /m[-_.]?[e3][-_. ]*[n][-_. ]*[t][-_. ]*[o0]/i,
  /m3nto/i,
  /metam[a-z0-9_-]*sk/i,
  /ph[a-z0-9_-]*ntom/i,
  /trust[-_.]?wal/i,
  /celo[-_.]?foun/i,
  /celo[-_.]?airdrop/i,
  /celo[-_.]?claim/i,
  /celoscan[-_.]?claim/i,
  /x402[-_.]?claim/i,
  /mento[-_.]?reward/i
];

// Whitelisted authentic domains
const TRUSTED_DOMAINS = [
  'celo.org',
  'celoscan.io',
  'mento.org',
  'valora.xyz',
  'github.com',
  'x402.celo.org',
  'veridex.network'
];

// Heuristic rule definitions
const RULES = {
  CREDENTIAL_HARVESTING: {
    weight: 95,
    patterns: [
      /(?:seed|secret|recovery|backup|private)\s*(?:phrase|key|words|code)/i,
      /(?:enter|input|share|verify|confirm)\s*(?:your|the)?\s*(?:12|24)\s*words/i,
      /(?:import|export)\s*(?:private\s*key|seed)/i,
      /(?:sync|reconnect|validate|verify|rectify)\s*wallet\s*(?:phrase|key|manually)/i
    ],
    reason: 'Direct request for private key, seed phrase, or wallet secret phrase.'
  },
  AIRDROP_FAKE_REWARD: {
    weight: 75,
    patterns: [
      /(?:you(?:'ve|\s+have)?\s+won|congratulations|selected\s+for|eligible\s+for)\s+(?:\$?\d+|free|airdrop|reward|grant|crypto|usdt|celo|usat)/i,
      /(?:claim|collect|finalize|process|receive)\s+(?:your\s+)?(?:free\s+)?(?:airdrop|tokens?|bonus|voucher|reward|allocation)/i,
      /(?:1000|5000|10000)\s*(?:usdt|usdc|usat|celo|cusd)\s*(?:giveaway|reward|airdrop)/i,
      /(?:double\s+your\s+(?:deposit|investment|crypto)|send\s+\d+\s+get\s+\d+)/i
    ],
    reason: 'Fake airdrop, lottery, or unsolicited crypto reward bait.'
  },
  URGENCY_COERCION: {
    weight: 60,
    patterns: [
      /(?:act\s+now|immediate\s+action\s+required|urgent|emergency|time\s+is\s+running\s+out)/i,
      /(?:account|wallet)\s*(?:will\s+be|is)\s*(?:suspended|blocked|frozen|terminated|locked|deleted)/i,
      /(?:expires?|valid)\s*(?:in|within)\s*(?:\d+\s*(?:hours?|minutes?|seconds?|hrs)|today|now)/i,
      /(?:unauthorized|suspicious)\s*(?:activity|login|transaction)\s*detected/i
    ],
    reason: 'High-pressure urgency language designed to cause panic and rush action.'
  },
  MALICIOUS_AUTHORIZATION: {
    weight: 80,
    patterns: [
      /(?:sign|permit|approve|grant)\s*(?:unlimited|all|infinite|max|spending)?\s*(?:spend|spending|allowance|balance|access|permission)/i,
      /(?:drain|sweep|claim\s+all)\s*assets/i,
      /(?:dapp|site)\s*(?:requires|needs)\s*(?:full\s+access|permission\s+to\s+transfer)/i,
      /approve\s+spending\s+access/i
    ],
    reason: 'Malicious authorization or unauthorized spending approval lure.'
  },
  SUPPORT_IMPERSONATION: {
    weight: 65,
    patterns: [
      /(?:support|admin|moderator|helpdesk|team|staff|rep(?:resentative)?)\s*(?:from|at)?\s*(?:celo|mento|valora|metamask|tether|circle)/i,
      /(?:from|at)\s*(?:celo|mento|valora|metamask)\s*(?:support|helpdesk|team)/i,
      /(?:noticed|detected)\s*(?:unusual|suspicious|unauthorized)\s*(?:activity|login|transaction|behavior)/i,
      /(?:verify|confirm)\s*(?:your|the)?\s*(?:wallet|account|address|identity)\s*(?:so\s+we\s+can|to\s+verify)/i
    ],
    reason: 'Impersonation of official support staff or unprompted verification inquiry.'
  }
};

class ScamDetector {
  /**
   * Main entry point to analyze input text/links/addresses
   * @param {string|object} input - Input text, URL, or transfer request object
   * @returns {Promise<object>}
   */
  static async analyze(input) {
    const text = typeof input === 'string' ? input : JSON.stringify(input);
    const extracted = this.extractEntities(text);

    const matches = [];
    let score = 0;

    // 1. Check credential harvesting and scam keywords
    for (const [ruleKey, rule] of Object.entries(RULES)) {
      for (const pattern of rule.patterns) {
        if (pattern.test(text)) {
          matches.push({ rule: ruleKey, reason: rule.reason, weight: rule.weight });
          score += rule.weight;
          break;
        }
      }
    }

    // 2. Check URLs and Domains
    for (const urlStr of extracted.urls) {
      try {
        const parsed = new URL(urlStr.startsWith('http') ? urlStr : `https://${urlStr}`);
        const hostname = parsed.hostname.toLowerCase();

        // Check if trusted domain
        const isTrusted = TRUSTED_DOMAINS.some(td => hostname === td || hostname.endsWith(`.${td}`));
        if (isTrusted) {
          score = Math.max(0, score - 30);
          continue;
        }

        // Check URL shorteners
        if (URL_SHORTENERS.includes(hostname)) {
          matches.push({
            rule: 'URL_SHORTENER',
            reason: `URL shortener detected (${hostname}), which obscures the real destination.`,
            weight: 45
          });
          score += 45;
        }

        // Check high-risk TLDs
        if (HIGH_RISK_TLDS.some(tld => hostname.endsWith(tld))) {
          matches.push({
            rule: 'HIGH_RISK_TLD',
            reason: `Suspicious high-risk top-level domain detected: ${hostname}`,
            weight: 55
          });
          score += 55;
        }

        // Check IP as hostname
        if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
          matches.push({
            rule: 'RAW_IP_URL',
            reason: `Direct IP address in link (${hostname}) instead of a registered domain.`,
            weight: 70
          });
          score += 70;
        }

        // Check lookalike / typosquatting
        for (const pattern of LOOKALIKE_PATTERNS) {
          if (pattern.test(hostname)) {
            matches.push({
              rule: 'LOOKALIKE_DOMAIN',
              reason: `Potential typosquatting / lookalike domain impersonating ecosystem brand: ${hostname}`,
              weight: 85
            });
            score += 85;
            break;
          }
        }
      } catch (e) {}
    }

    // 3. Check Addresses
    for (const addr of extracted.addresses) {
      if (!ethers.isAddress(addr)) {
        matches.push({
          rule: 'INVALID_EVM_ADDRESS',
          reason: `Malformed recipient address: ${addr}`,
          weight: 60
        });
        score += 60;
      } else if (addr === ethers.ZeroAddress) {
        matches.push({
          rule: 'ZERO_ADDRESS',
          reason: 'Burn / Zero address specified as recipient.',
          weight: 90
        });
        score += 90;
      }
    }

    // Determine deterministic verdict
    let riskLevel = 'LOW';
    if (score >= 70) {
      riskLevel = 'HIGH';
    } else if (score >= 35) {
      riskLevel = 'MEDIUM';
    }

    // If ambiguous (MEDIUM) and a valid Gemini API key is configured, attempt Gemini LLM analysis
    const hasGeminiKey = Boolean(
      process.env.GEMINI_API_KEY &&
      typeof process.env.GEMINI_API_KEY === 'string' &&
      process.env.GEMINI_API_KEY.trim() !== '' &&
      process.env.GEMINI_API_KEY !== 'undefined' &&
      process.env.GEMINI_API_KEY !== 'null'
    );

    if (riskLevel === 'MEDIUM' && hasGeminiKey) {
      try {
        const llmResult = await this.queryGeminiLLM(text, matches);
        if (llmResult) {
          return {
            ...llmResult,
            score,
            extractedEntities: extracted,
            evaluatedBy: 'LLM_FALLBACK'
          };
        }
      } catch (err) {
        console.warn('Gemini LLM fallback failed or unavailable, defaulting to rule-based assessment:', err.message);
      }
    }

    const reasons = matches.map(m => m.reason);
    if (reasons.length === 0 && riskLevel === 'LOW') {
      reasons.push('No suspicious patterns, phishing indicators, or blacklisted domains detected.');
    }

    let recommendation = '';
    let speechExplanation = '';

    if (riskLevel === 'HIGH') {
      recommendation = 'DO NOT PROCEED. SafeSend blocked this action due to severe phishing and scam indicators.';
      speechExplanation = 'Warning! This transfer has been blocked. The message contains dangerous scam signals attempting to compromise your funds.';
    } else if (riskLevel === 'MEDIUM') {
      recommendation = 'PROCEED WITH CAUTION. Verify the recipient identity and destination URL independently before confirming.';
      speechExplanation = 'Caution. SafeSend detected possible risk indicators. Please double check the recipient before sending.';
    } else {
      recommendation = 'SAFE TO PROCEED. No security risks detected.';
      speechExplanation = 'SafeSend security check passed. Your transfer is safe to proceed.';
    }

    return {
      riskLevel,
      score: Math.min(100, score),
      reasons,
      recommendation,
      speechExplanation,
      matchedRules: matches.map(m => m.rule),
      extractedEntities: extracted,
      evaluatedBy: 'RULE_ENGINE'
    };
  }

  /**
   * Helper to extract URLs and EVM addresses from arbitrary text
   */
  static extractEntities(text) {
    // Matches http(s) URLs, www URLs, and bare domain names with valid extensions (e.g. ce1o-rewards.org)
    const urlRegex = /(?:(?:https?:\/\/|www\.)[^\s<>"'{}|\\^`[\]]+|(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/[^\s<>"'{}|\\^`[\]]*)?)/gi;
    const addressRegex = /0x[a-fA-F0-9]{40}/g;
    const amountRegex = /(?:send|transfer|pay|\$)\s*(\d+(?:\.\d+)?)\s*(?:usat|usdt|cusd|celo|usd)?/gi;

    const urls = (text.match(urlRegex) || []).map(u => u.replace(/[.,;!?]+$/, ''));
    const addresses = text.match(addressRegex) || [];

    const amounts = [];
    let match;
    while ((match = amountRegex.exec(text)) !== null) {
      amounts.push(match[1]);
    }

    return {
      urls: [...new Set(urls)],
      addresses: [...new Set(addresses)],
      amounts: [...new Set(amounts)]
    };
  }

  /**
   * Query Google Gemini API for deep contextual scam analysis
   */
  static async queryGeminiLLM(text, initialMatches) {
    const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : '';
    if (!apiKey || apiKey === 'undefined' || apiKey === 'null') {
      return null;
    }

    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      const modelName = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json'
        }
      });

      const prompt = `You are the Veridex SafeSend Scam Detection AI on Celo.
Analyze the following user input/forwarded message for fraud, social engineering, wallet drainer lures, phishing, address poisoning, or fake stablecoin transfers.

User Input:
"""
${text}
"""

Initial Rule Flags:
${JSON.stringify(initialMatches, null, 2)}

Respond with STRICT JSON ONLY matching this format:
{
  "riskLevel": "HIGH" | "MEDIUM" | "LOW",
  "reasons": ["string reason 1", "string reason 2"],
  "recommendation": "One sentence actionable recommendation",
  "speechExplanation": "Short conversational warning suitable for text-to-speech"
}`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text().trim();
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return null;
    } catch (err) {
      console.warn('Gemini API query failed, falling back to rule engine:', err.message);
      return null;
    }
  }
}

module.exports = {
  ScamDetector,
  RULES,
  HIGH_RISK_TLDS,
  URL_SHORTENERS,
  LOOKALIKE_PATTERNS
};

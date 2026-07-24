import crypto from 'crypto';
import { config } from '../config/index.js';

export function contentHash(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

export function createQuantumChatReceipt(userId: string, destination: string, content: string) {
  if (!config.QUANTUM_AI_SERVICE_SECRET) {
    throw new Error(
      'QUANTUM_AI_SERVICE_SECRET is not configured — cannot sign QuantumChat AI receipts'
    );
  }
  const hash = contentHash(content);
  const requestId = crypto.randomUUID();
  const receipt = crypto
    .createHmac('sha256', config.QUANTUM_AI_SERVICE_SECRET)
    .update(`${userId}:${destination}:${hash}:${requestId}`)
    .digest('hex');
  return { contentHash: hash, requestId, receipt };
}

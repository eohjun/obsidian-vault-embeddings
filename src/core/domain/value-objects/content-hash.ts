/**
 * ContentHash Value Object
 * 노트 내용 해시 (staleness 감지용)
 */

/**
 * 간단한 해시 함수 (SHA-256 대용)
 * Obsidian 환경에서는 Web Crypto API 사용 가능
 */
export async function generateContentHash(content: string): Promise<string> {
  // Web Crypto API를 사용한 SHA-256 해시
  const encoder = new TextEncoder();
  const data = encoder.encode(content);

  try {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return `sha256:${hashHex}`;
  } catch {
    // 폴백: 간단한 해시 (crypto API 없는 환경용)
    return `simple:${simpleHash(content)}`;
  }
}

/**
 * 간단한 해시 함수 (폴백용)
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * 해시 비교
 */
export function isHashEqual(hash1: string | null, hash2: string | null): boolean {
  if (hash1 === null || hash2 === null) {
    return false;
  }
  return hash1 === hash2;
}

/**
 * 해시에서 알고리즘 추출
 */
export function getHashAlgorithm(hash: string): string {
  const colonIndex = hash.indexOf(':');
  if (colonIndex === -1) {
    return 'unknown';
  }
  return hash.substring(0, colonIndex);
}

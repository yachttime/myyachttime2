const PART_NUMBER_SEPARATORS = /[\s,;/]+/;

function normalizeIdentifier(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function identifyingTokens(text: string): string[] {
  return (text || '')
    .split(PART_NUMBER_SEPARATORS)
    .map(normalizeIdentifier)
    .filter(token => token.length >= 3 && /\d/.test(token));
}

interface InventoryPartLike {
  part_number: string;
  alternative_part_numbers?: string | null;
}

export function findInventoryPartByNumber<T extends InventoryPartLike>(partNumber: string, parts: T[]): T | null {
  const wanted = identifyingTokens(partNumber);
  if (wanted.length === 0) return null;

  const matches = (candidateText: string) => {
    const candidate = identifyingTokens(candidateText);
    return wanted.some(token => candidate.includes(token));
  };

  return parts.find(p => matches(p.part_number))
    ?? parts.find(p => matches(p.alternative_part_numbers || ''))
    ?? null;
}

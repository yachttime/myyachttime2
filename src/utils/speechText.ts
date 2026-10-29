const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const SCALES = ['', 'thousand', 'million', 'billion'];
const MAX_WORDED = 999_999_999_999;

function underThousand(n: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds) parts.push(`${ONES[hundreds]} hundred`);
  if (rest) {
    if (rest < 20) {
      parts.push(ONES[rest]);
    } else {
      const ones = rest % 10;
      parts.push(ones ? `${TENS[Math.floor(rest / 10)]}-${ONES[ones]}` : TENS[Math.floor(rest / 10)]);
    }
  }
  return parts.join(' ');
}

function integerToWords(n: number): string {
  if (n === 0) return 'zero';
  const parts: string[] = [];
  let remaining = n;
  for (let scale = 0; remaining > 0; scale++) {
    const chunk = remaining % 1000;
    if (chunk) {
      const label = SCALES[scale];
      parts.unshift(label ? `${underThousand(chunk)} ${label}` : underThousand(chunk));
    }
    remaining = Math.floor(remaining / 1000);
  }
  return parts.join(' ');
}

function digitsToWords(digits: string): string {
  return digits.split('').map((d) => ONES[Number(d)]).join(' ');
}

function spokenInteger(digits: string): string {
  const value = Number(digits);
  if (value > MAX_WORDED) return digitsToWords(digits);
  return integerToWords(value);
}

const NUMBER_PATTERN = /(\$)?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?/g;

export function toSpeakableText(text: string): string {
  return text.replace(NUMBER_PATTERN, (match, dollar: string | undefined, intPart: string, decimals: string | undefined) => {
    const digits = intPart.replace(/,/g, '');
    if (digits.length < 3) return match;

    const words = spokenInteger(digits);
    if (dollar) {
      if (!decimals) return `${words} dollars`;
      const cents = decimals.padEnd(2, '0').slice(0, 2);
      if (cents === '00') return `${words} dollars`;
      return `${words} dollars and ${spokenInteger(String(Number(cents)))} cents`;
    }
    if (decimals) return `${words} point ${digitsToWords(decimals)}`;
    return words;
  });
}

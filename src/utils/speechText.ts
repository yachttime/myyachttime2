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

const TIME_PATTERN = /\b(\d{1,2}):(\d{2})(?:\s*([ap])\.?m\.?)?\b/gi;
const NUMBER_PATTERN = /(\$)?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?(%)?/g;

function timeToWords(hour: string, minute: string, meridiem: string | undefined): string {
  const hourWords = spokenInteger(String(Number(hour)));
  const minuteWords = minute === '00' ? "o'clock" : spokenInteger(String(Number(minute)));
  const suffix = meridiem ? ` ${meridiem.toLowerCase()} m` : '';
  return `${hourWords} ${minuteWords}${suffix}`;
}

export function toSpeakableText(text: string): string {
  const withTimes = text.replace(TIME_PATTERN, (_match, hour: string, minute: string, meridiem: string | undefined) =>
    timeToWords(hour, minute, meridiem),
  );

  return withTimes.replace(NUMBER_PATTERN, (_match, dollar: string | undefined, intPart: string, decimals: string | undefined, percent: string | undefined) => {
    const digits = intPart.replace(/,/g, '');
    const words = spokenInteger(digits);

    if (dollar) {
      if (!decimals) return `${words} dollars`;
      const cents = decimals.padEnd(2, '0').slice(0, 2);
      if (cents === '00') return `${words} dollars`;
      return `${words} dollars and ${spokenInteger(String(Number(cents)))} cents`;
    }
    const base = decimals ? `${words} point ${digitsToWords(decimals)}` : words;
    return percent ? `${base} percent` : base;
  });
}

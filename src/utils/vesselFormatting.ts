export function formatWeatherNumber(value: unknown, maximumFractionDigits = 2): string {
  const number = Number(value);
  if (!Number.isFinite(number)) return '--';
  return number.toLocaleString(undefined, { maximumFractionDigits });
}

export function formatAlertMessage(message: string): string {
  const match = message.match(/^Lightning Strike reported critical: \{\s*"distance_km"\s*:\s*([\d.]+)\s*\}$/);
  if (!match) return message;
  return `Lightning Strike reported critical: ${formatWeatherNumber(Number(match[1]) * 0.621371, 1)} miles away`;
}

export interface MercuryPart {
  part_number: string;
  item_class: string;
  description: string;
  superseded_part_number: string;
  msrp: number;
  dealer_price: number;
  item_status: string;
  pack_quantity: number;
  weight_lbs: number;
  weight_oz: number;
  upc_code: string;
  core_charge: number;
  container_charge: number;
  hazardous_code: string;
  discount_percentage: number;
  ca_proposition_65: string;
  unit_length: number;
  unit_width: number;
  unit_height: number;
}

export interface ParseResult {
  parts: MercuryPart[];
  errors: string[];
  totalLines: number;
  successfulLines: number;
}

function cleanFixedWidthField(value: string): string {
  return value.trim();
}

function parseDecimal(value: string, defaultValue: number = 0): number {
  const cleaned = value.trim();
  if (!cleaned || cleaned === '') return defaultValue;
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? defaultValue : parsed;
}

function parseInt(value: string, defaultValue: number = 0): number {
  const cleaned = value.trim();
  if (!cleaned || cleaned === '') return defaultValue;
  const parsed = Number.parseInt(cleaned, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

export function parseFixedWidthLine(line: string): MercuryPart | null {
  if (!line || line.length < 114) {
    return null;
  }

  try {
    const part: MercuryPart = {
      part_number: cleanFixedWidthField(line.substring(0, 9)),
      item_class: cleanFixedWidthField(line.substring(9, 13)),
      description: cleanFixedWidthField(line.substring(13, 30)),
      superseded_part_number: cleanFixedWidthField(line.substring(30, 44)),
      msrp: parseDecimal(line.substring(44, 52)),
      dealer_price: parseDecimal(line.substring(52, 60)),
      item_status: cleanFixedWidthField(line.substring(60, 63)),
      pack_quantity: parseInt(line.substring(63, 66), 1),
      weight_lbs: parseDecimal(line.substring(66, 71)),
      weight_oz: parseDecimal(line.substring(71, 75)),
      discount_percentage: parseDecimal(line.substring(75, 77)),
      upc_code: cleanFixedWidthField(line.substring(77, 97)),
      core_charge: parseDecimal(line.substring(97, 105)),
      container_charge: parseDecimal(line.substring(105, 113)),
      hazardous_code: cleanFixedWidthField(line.substring(113, 114)),
      unit_length: line.length >= 122 ? parseDecimal(line.substring(114, 122)) : 0,
      unit_width: line.length >= 130 ? parseDecimal(line.substring(122, 130)) : 0,
      unit_height: line.length >= 138 ? parseDecimal(line.substring(130, 138)) : 0,
      ca_proposition_65: line.length > 138 ? cleanFixedWidthField(line.substring(138)) : ''
    };

    if (part.ca_proposition_65.endsWith('X')) {
      part.ca_proposition_65 = part.ca_proposition_65.substring(0, part.ca_proposition_65.length - 1).trim();
    }

    if (!part.part_number) {
      return null;
    }

    return part;
  } catch (error) {
    console.error('Error parsing line:', error);
    return null;
  }
}

export function validateMercuryRecord(part: MercuryPart): { isValid: boolean; error?: string } {
  if (!part.part_number || part.part_number.trim() === '') {
    return { isValid: false, error: 'Part number is required' };
  }

  if (part.msrp < 0) {
    return { isValid: false, error: 'MSRP cannot be negative' };
  }

  if (part.dealer_price < 0) {
    return { isValid: false, error: 'Dealer price cannot be negative' };
  }

  return { isValid: true };
}

export async function parseMercuryASCIIFile(file: File): Promise<ParseResult> {
  const result: ParseResult = {
    parts: [],
    errors: [],
    totalLines: 0,
    successfulLines: 0
  };

  try {
    const text = await file.text();
    const lines = text.split(/\r?\n/);

    result.totalLines = lines.length;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!line.trim()) {
        continue;
      }

      const part = parseFixedWidthLine(line);

      if (!part) {
        result.errors.push(`Line ${i + 1}: Failed to parse line (too short or invalid format)`);
        continue;
      }

      const validation = validateMercuryRecord(part);
      if (!validation.isValid) {
        result.errors.push(`Line ${i + 1}: ${validation.error}`);
        continue;
      }

      result.parts.push(part);
      result.successfulLines++;
    }

    return result;
  } catch (error) {
    result.errors.push(`File reading error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return result;
  }
}

export function generateImportSummary(result: ParseResult): string {
  const summary = [
    `Total lines processed: ${result.totalLines}`,
    `Successfully parsed: ${result.successfulLines}`,
    `Failed to parse: ${result.errors.length}`,
    `Success rate: ${result.totalLines > 0 ? Math.round((result.successfulLines / result.totalLines) * 100) : 0}%`
  ];

  if (result.errors.length > 0 && result.errors.length <= 10) {
    summary.push('\nErrors:');
    result.errors.forEach(error => summary.push(`  - ${error}`));
  } else if (result.errors.length > 10) {
    summary.push(`\nShowing first 10 of ${result.errors.length} errors:`);
    result.errors.slice(0, 10).forEach(error => summary.push(`  - ${error}`));
  }

  return summary.join('\n');
}

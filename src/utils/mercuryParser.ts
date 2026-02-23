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

function clean(value: string): string {
  return value.trim();
}

function parseDecimal(value: string, defaultValue: number = 0): number {
  const cleaned = value.trim();
  if (!cleaned) return defaultValue;
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? defaultValue : parsed;
}

function parseIntField(value: string, defaultValue: number = 0): number {
  const cleaned = value.trim();
  if (!cleaned) return defaultValue;
  const parsed = Number.parseInt(cleaned, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function isTabDelimited(line: string): boolean {
  return line.includes('\t');
}

export function parseTabDelimitedLine(line: string): MercuryPart | null {
  const fields = line.split('\t');

  if (fields.length < 7) return null;

  try {
    const code = clean(fields[0]);
    const itemClass = clean(fields[1] ?? '');
    const description = clean(fields[2] ?? '');
    const superseded = clean(fields[3] ?? '');
    const msrp = parseDecimal(fields[4] ?? '');
    const list = parseDecimal(fields[5] ?? '');
    const itemStatus = clean(fields[6] ?? '');
    const packQty = parseIntField(fields[7] ?? '', 1);
    const weightLbs = parseDecimal(fields[8] ?? '');
    const weightOz = parseDecimal(fields[9] ?? '');
    const discountQty = parseIntField(fields[10] ?? '');
    const upc = clean(fields[11] ?? '');
    const coreCharge = parseDecimal(fields[12] ?? '');
    const containerCharge = parseDecimal(fields[13] ?? '');
    const hazardous = clean(fields[14] ?? '');
    const unitL = parseDecimal(fields[15] ?? '');
    const unitW = parseDecimal(fields[16] ?? '');
    const unitH = parseDecimal(fields[17] ?? '');
    const discountPct = parseDecimal(fields[18] ?? '');
    let caProp65 = clean(fields[19] ?? '');

    if (!code) return null;

    let partNumber = code;
    if (itemClass && itemClass !== '0000') {
      partNumber = `${itemClass}-${code}`;
    }

    const terminator = clean(fields[fields.length - 1] ?? '');
    if (terminator === 'X') {
      caProp65 = clean(fields[19] ?? '');
    }

    return {
      part_number: partNumber,
      item_class: itemClass,
      description,
      superseded_part_number: superseded,
      msrp,
      dealer_price: list,
      item_status: itemStatus,
      pack_quantity: packQty,
      weight_lbs: weightLbs,
      weight_oz: weightOz,
      upc_code: upc,
      core_charge: coreCharge,
      container_charge: containerCharge,
      hazardous_code: hazardous,
      discount_percentage: discountPct,
      ca_proposition_65: caProp65,
      unit_length: unitL,
      unit_width: unitW,
      unit_height: unitH,
    };
  } catch (error) {
    console.error('Error parsing tab-delimited line:', error);
    return null;
  }
}

export function parseFixedWidthLine(line: string): MercuryPart | null {
  if (!line) return null;

  const isMpnuFormat = line.startsWith('MPNU');
  const offset = isMpnuFormat ? 4 : 0;

  if (line.length < 114 + offset) {
    return null;
  }

  try {
    let rawPartNumber = clean(line.substring(offset, offset + 9));

    if (isMpnuFormat && rawPartNumber) {
      const itemClass = clean(line.substring(offset + 9, offset + 13));
      if (itemClass) {
        rawPartNumber = `${itemClass}-${rawPartNumber}`;
      }
    }

    const part: MercuryPart = {
      part_number: rawPartNumber,
      item_class: clean(line.substring(offset + 9, offset + 13)),
      description: clean(line.substring(offset + 13, offset + 30)),
      superseded_part_number: clean(line.substring(offset + 30, offset + 44)),
      msrp: parseDecimal(line.substring(offset + 44, offset + 52)),
      dealer_price: parseDecimal(line.substring(offset + 52, offset + 60)),
      item_status: clean(line.substring(offset + 60, offset + 63)),
      pack_quantity: parseIntField(line.substring(offset + 63, offset + 66), 1),
      weight_lbs: parseDecimal(line.substring(offset + 66, offset + 71)),
      weight_oz: parseDecimal(line.substring(offset + 71, offset + 75)),
      discount_percentage: parseDecimal(line.substring(offset + 75, offset + 77)),
      upc_code: clean(line.substring(offset + 77, offset + 97)),
      core_charge: parseDecimal(line.substring(offset + 97, offset + 105)),
      container_charge: parseDecimal(line.substring(offset + 105, offset + 113)),
      hazardous_code: clean(line.substring(offset + 113, offset + 114)),
      unit_length: line.length >= offset + 122 ? parseDecimal(line.substring(offset + 114, offset + 122)) : 0,
      unit_width: line.length >= offset + 130 ? parseDecimal(line.substring(offset + 122, offset + 130)) : 0,
      unit_height: line.length >= offset + 138 ? parseDecimal(line.substring(offset + 130, offset + 138)) : 0,
      ca_proposition_65: line.length > offset + 138 ? clean(line.substring(offset + 138)) : ''
    };

    if (part.ca_proposition_65.endsWith('X')) {
      part.ca_proposition_65 = part.ca_proposition_65.substring(0, part.ca_proposition_65.length - 1).trim();
    }

    if (!part.part_number) {
      return null;
    }

    return part;
  } catch (error) {
    console.error('Error parsing fixed-width line:', error);
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

      const tabFormat = isTabDelimited(line);
      const part = tabFormat ? parseTabDelimitedLine(line) : parseFixedWidthLine(line);

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

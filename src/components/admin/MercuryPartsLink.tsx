import { ExternalLink } from 'lucide-react';

const MERCURY_URL = 'https://public-mercurymarine.sysonline.com/Default.aspx?sysname=NorthAmerica&company=Guest&NA_KEY=NA_KEY_VALUE&langIF=eng&langDB=eng&_gl=1*15h89m1*_gcl_aw*R0NMLjE3ODcwNzA1NDkuQ2p3S0NBandoWkRVQmhCR0Vpd0FiaTVianBkZjNnT0pCV3ZIR3lwQVRsbXJEd1JxYmdiZGN5QjNwTGhiMWlxLXNKazBvR0hpc1YzMHpSb0NERm9RQXZEX0J3RQ..*_gcl_au*NTc5MTE3NDU3LjE3ODE3MzIzMTQ.*_ga*MjEwNzc0OTgxMC4xNzcwNzQ0MDAz*_ga_H0CEJ7J9FX*czE3ODg1NDQ3MTQkbzgkZzAkdDE3ODg1NDQ3MTQkajYwJGwwJGgw';

export default function MercuryPartsLink({ manufacturer, description, modelNumber }: { manufacturer?: string | null; description?: string | null; modelNumber?: string | null }) {
  const fields = [manufacturer, description, modelNumber].filter(Boolean) as string[];
  if (fields.length === 0) return null;
  const hasMercury = fields.some(f => {
    const m = f.toLowerCase().trim();
    return m === 'mercury' || m === 'mercury marine' || m.startsWith('mercury ') || m.includes(' mercury ');
  });
  if (!hasMercury) return null;
  return (
    <a
      href={MERCURY_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[10px] font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
    >
      <ExternalLink className="w-3 h-3" /> Mercury Parts Catalog
    </a>
  );
}

export interface IdentityFlagDetails {
  scheduledOwnerName: string;
  confirmedName: string;
}

const normalizeName = (name: string) =>
  name.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();

export const namesMatch = (scheduledName: string, confirmedName: string) => {
  const scheduled = normalizeName(scheduledName);
  const confirmed = normalizeName(confirmedName);
  return scheduled.length > 0 && scheduled === confirmed;
};

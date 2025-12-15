export const isAtLeastAge = (dobIso: string, minAge: number): boolean => {
  if (!dobIso) return false;
  const m = /^\d{4}-\d{2}-\d{2}$/.exec(dobIso);
  if (!m) return false;
  const dob = new Date(dobIso + 'T00:00:00Z');
  if (Number.isNaN(dob.getTime())) return false;
  const today = new Date();
  let age = today.getUTCFullYear() - dob.getUTCFullYear();
  const mMonth = today.getUTCMonth() - dob.getUTCMonth();
  if (mMonth < 0 || (mMonth === 0 && today.getUTCDate() < dob.getUTCDate())) {
    age--;
  }
  return age >= minAge;
};

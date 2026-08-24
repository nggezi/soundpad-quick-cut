export const fmtTime = (s: number): string => {
  if (!isFinite(s) || s < 0) return "00:00.00";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${sec.toFixed(2).padStart(5, "0")}`;
};

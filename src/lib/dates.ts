export const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export const MONF = ["January","February","March","April","May","June","July","August","September","October","November","December"];
export const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export function ymd(s: string): Date {
  return new Date(s + "T00:00:00");
}
export function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
export function fmt(d: Date): string {
  return `${MON[d.getMonth()]} ${d.getDate()}`;
}
export function fmtISO(s: string): string {
  return fmt(ymd(s));
}
export function fmtRange(a: Date, b: Date): string {
  if (sameDay(a, b)) return fmt(a);
  if (a.getMonth() === b.getMonth()) return `${MON[a.getMonth()]} ${a.getDate()}–${b.getDate()}`;
  return `${fmt(a)} – ${fmt(b)}`;
}
export function fmtRangeISO(a: string, b: string): string {
  return fmtRange(ymd(a), ymd(b));
}
export function dayCountISO(a: string, b: string): number {
  return Math.round((ymd(b).getTime() - ymd(a).getTime()) / 86400000) + 1;
}
export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

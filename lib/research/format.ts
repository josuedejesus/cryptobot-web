const number = new Intl.NumberFormat("es-GT", { maximumFractionDigits: 2 });
const currency = new Intl.NumberFormat("es-GT", {
  style: "currency",
  currency: "USD",
  currencyDisplay: "narrowSymbol",
});
const percent = new Intl.NumberFormat("es-GT", {
  style: "percent",
  maximumFractionDigits: 2,
});
const price = new Intl.NumberFormat("es-GT", { maximumFractionDigits: 8 });
const date = new Intl.DateTimeFormat("es-GT", {
  timeZone: "UTC",
  dateStyle: "short",
  timeStyle: "short",
});
export const formatNumber = (value: number | null) =>
  value === null ? "—" : number.format(value);
export const formatCurrency = (value: number | null) =>
  value === null ? "—" : currency.format(value);
export const formatPercent = (value: number | null) =>
  value === null ? "—" : percent.format(value);
export const formatPrice = (value: number) => price.format(value);
export const formatDate = (value: number | string) =>
  date.format(new Date(value));

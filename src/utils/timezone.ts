const PST_TIMEZONE = "America/Los_Angeles";

export function formatDateTimePST(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-US", {
    timeZone: PST_TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatTimePST(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-US", {
    timeZone: PST_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDatePST(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    timeZone: PST_TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function toDatetimeLocalPST(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const pstString = d.toLocaleString("en-US", {
    timeZone: PST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const [datePart, timePart] = pstString.split(", ");
  const [month, day, year] = datePart.split("/");
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${timePart}`;
}

export function fromDatetimeLocalToPST(datetimeLocal: string): Date {
  const [datePart, timePart] = datetimeLocal.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);

  const tempDate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));

  const utcString = tempDate.toLocaleString("en-US", { timeZone: "UTC" });
  const pstString = tempDate.toLocaleString("en-US", { timeZone: PST_TIMEZONE });

  const utcParsed = new Date(utcString);
  const pstParsed = new Date(pstString);

  const offsetMs = utcParsed.getTime() - pstParsed.getTime();

  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0) + offsetMs);
}

export function getPSTTimezoneLabel(): string {
  const now = new Date();
  const pstOffset = now
    .toLocaleString("en-US", {
      timeZone: PST_TIMEZONE,
      timeZoneName: "short",
    })
    .split(" ")
    .pop();
  return pstOffset || "PT";
}

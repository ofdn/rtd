// Minimal CSV writer. No external dependency, the dataset is small and the
// escaping rules are simple (RFC 4180: quote fields containing a comma,
// quote, or newline; double up internal quotes).

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const str = Array.isArray(value)
    ? value.join("; ")
    : typeof value === "object"
    ? JSON.stringify(value)
    : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replaceAll('"', '""')}"`;
  }
  return str;
}

export function toCsv(rows, columns) {
  const header = columns.join(",");
  const lines = rows.map((row) =>
    columns.map((col) => csvCell(row[col])).join(",")
  );
  return [header, ...lines].join("\n") + "\n";
}

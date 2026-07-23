/** Télécharge un tableau CSV (UTF-8 BOM pour Excel). */
export function downloadCsv(filename: string, rows: string[][]) {
  const escape = (cell: string) => {
    const v = cell.replace(/"/g, '""');
    return `"${v}"`;
  };
  const body = rows.map((r) => r.map((c) => escape(String(c ?? ''))).join(';')).join('\n');
  const blob = new Blob(['\uFEFF' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

import type { Product } from "../../types";

// El tipo String conserva los ceros del SKU y evita interpretar texto como fórmulas.
function escapeXml(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function cell(value: string | number, style = 0): string {
  const numeric = typeof value === "number";
  if (numeric && !Number.isFinite(value)) throw new Error("El inventario contiene un número inválido");
  return numeric
    ? `<c s="${style}"><v>${value}</v></c>`
    : `<c s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(value))}</t></is></c>`;
}

// ZIP sin compresión: cada entrada lleva CRC32, directorio central y cierre ZIP.
function zip(files: Record<string, string>): ArrayBuffer {
  const encoder = new TextEncoder();
  const entries = Object.entries(files).map(([name, text]) => ({ name: encoder.encode(name), data: encoder.encode(text) }));
  const length = entries.reduce((sum, entry) => sum + 30 + entry.name.length + entry.data.length + 46 + entry.name.length, 22);
  const buffer = new ArrayBuffer(length);
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let offset = 0;
  const word = (value: number) => { view.setUint16(offset, value, true); offset += 2; };
  const dword = (value: number) => { view.setUint32(offset, value, true); offset += 4; };
  const put = (value: Uint8Array) => { bytes.set(value, offset); offset += value.length; };
  const records: { name: Uint8Array; size: number; crc: number; start: number }[] = [];
  for (const entry of entries) {
    let crc = 0xffffffff;
    for (const byte of entry.data) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    records.push({ name: entry.name, size: entry.data.length, crc, start: offset });
    dword(0x04034b50); word(20); word(0); word(0); word(0); word(33);
    dword(crc); dword(entry.data.length); dword(entry.data.length); word(entry.name.length); word(0);
    put(entry.name); put(entry.data);
  }
  const centralStart = offset;
  for (const record of records) {
    dword(0x02014b50); word(20); word(20); word(0); word(0); word(0); word(33);
    dword(record.crc); dword(record.size); dword(record.size); word(record.name.length);
    word(0); word(0); word(0); word(0); dword(0); dword(record.start); put(record.name);
  }
  const centralSize = offset - centralStart;
  dword(0x06054b50); word(0); word(0); word(records.length); word(records.length);
  dword(centralSize); dword(centralStart); word(0);
  return buffer;
}

/** Libro XLSX real (Open XML dentro de ZIP), sin modificar las existencias. */
export function buildInventoryWorkbook(products: readonly Product[]): ArrayBuffer {
  const headers = ["Código", "Producto", "Categoría", "Estado", "Precio de venta", "Existencias del sistema", "Stock mínimo", "Inventario físico", "Observaciones"];
  const rows = [...products].sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" })).map((product) => {
    const state = product.status === "inactive" ? "Inactivo" : product.stock === 0 ? "Agotado" : product.stock <= product.minimumStock ? "Stock bajo" : "Disponible";
    return `<row>${cell(product.code)}${cell(product.name)}${cell(product.category)}${cell(state)}${cell(product.price, 2)}${cell(product.stock)}${cell(product.minimumStock)}<c s="3"/><c s="3"/></row>`;
  });
  const ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  const rel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  return zip({
    "[Content_Types].xml": `${declaration}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    "_rels/.rels": `${declaration}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `${declaration}<workbook xmlns="${ns}" xmlns:r="${rel}"><sheets><sheet name="Inventario" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `${declaration}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${rel}/styles" Target="styles.xml"/></Relationships>`,
    "xl/styles.xml": `${declaration}<styleSheet xmlns="${ns}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF334155"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF3CC"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment wrapText="1"/></xf><xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    "xl/worksheets/sheet1.xml": `${declaration}<worksheet xmlns="${ns}"><dimension ref="A1:I${products.length + 1}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${[16, 32, 20, 16, 16, 20, 16, 20, 36].map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("")}</cols><sheetData><row ht="32" customHeight="1">${headers.map((header) => cell(header, 1)).join("")}</row>${rows.join("")}</sheetData><autoFilter ref="A1:I${products.length + 1}"/></worksheet>`,
  });
}

export function exportInventory(products: readonly Product[], date = new Date()): void {
  const workbook = buildInventoryWorkbook(products);
  const blob = new Blob([workbook], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  try {
    link.href = url;
    link.download = `inventario-fisico-${day}.xlsx`;
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    // La descarga debe empezar antes de liberar el archivo temporal.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
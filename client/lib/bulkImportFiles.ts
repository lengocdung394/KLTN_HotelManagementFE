export type ZipFileEntry = {
  name: string;
  content: Uint8Array;
};

export type WorkbookSheet = {
  name: string;
  rows: Array<Array<string | number>>;
};

const decodeZipEntries = async (data: Uint8Array): Promise<ZipFileEntry[]> => {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let endOffset = -1;

  for (let index = data.length - 22; index >= Math.max(0, data.length - 65557); index -= 1) {
    if (view.getUint32(index, true) === 0x06054b50) {
      endOffset = index;
      break;
    }
  }
  if (endOffset < 0) throw new Error("File nén ZIP không hợp lệ.");

  const entryCount = view.getUint16(endOffset + 10, true);
  let cursor = view.getUint32(endOffset + 16, true);
  const entries: ZipFileEntry[] = [];

  for (let entry = 0; entry < entryCount; entry += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error("Không thể đọc danh sách file trong ZIP.");
    const compression = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = new TextDecoder().decode(data.slice(cursor + 46, cursor + 46 + nameLength));
    cursor += 46 + nameLength + extraLength + commentLength;
    if (name.endsWith("/")) continue;
    if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error(`File ${name} trong ZIP không hợp lệ.`);

    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = data.slice(start, start + compressedSize);
    let content: Uint8Array;

    if (compression === 0) {
      content = compressed;
    } else if (compression === 8) {
      const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      content = new Uint8Array(await new Response(stream).arrayBuffer());
    } else {
      throw new Error(`Định dạng nén của ${name} chưa được hỗ trợ.`);
    }
    entries.push({ name: name.replace(/\\/g, "/"), content });
  }

  return entries;
};

const xmlDocument = (content: Uint8Array) =>
  new DOMParser().parseFromString(new TextDecoder().decode(content), "application/xml");

const columnIndexFromReference = (reference: string) => {
  const column = reference.replace(/\d/g, "");
  return [...column].reduce((value, character) => value * 26 + character.charCodeAt(0) - 64, 0) - 1;
};

export const readZipFiles = (data: ArrayBuffer | Uint8Array) =>
  decodeZipEntries(data instanceof Uint8Array ? data : new Uint8Array(data));

export const readXlsxRows = async (data: ArrayBuffer | Uint8Array, sheetNumber = 1): Promise<string[][]> => {
  const entries = await readZipFiles(data);
  const entryMap = new Map(entries.map((entry) => [entry.name, entry.content]));
  const sheetBytes = entryMap.get(`xl/worksheets/sheet${sheetNumber}.xml`);
  if (!sheetBytes) throw new Error(`Không tìm thấy sheet ${sheetNumber} trong file Excel.`);

  const sharedBytes = entryMap.get("xl/sharedStrings.xml");
  const sharedStrings = sharedBytes
    ? Array.from(xmlDocument(sharedBytes).querySelectorAll("si")).map((item) => item.textContent?.trim() ?? "")
    : [];
  const sheet = xmlDocument(sheetBytes);
  if (sheet.querySelector("parsererror")) throw new Error("Nội dung file Excel bị lỗi.");

  return Array.from(sheet.querySelectorAll("sheetData > row")).map((row) => {
    const cells: string[] = [];
    Array.from(row.querySelectorAll(":scope > c")).forEach((cell) => {
      const index = columnIndexFromReference(cell.getAttribute("r") ?? "");
      const type = cell.getAttribute("t");
      const raw = type === "inlineStr"
        ? cell.querySelector("is")?.textContent ?? ""
        : cell.querySelector("v")?.textContent ?? "";
      cells[index] = type === "s" ? sharedStrings[Number(raw)] ?? "" : raw.trim();
    });
    return cells;
  });
};

const escapeXml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const columnName = (index: number) => {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
};

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < table.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
})();

const crc32 = (bytes: Uint8Array) => {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
};

const makeZip = (files: Array<{ name: string; content: string }>, mimeType = "application/zip") => {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const content = encoder.encode(file.content);
    const checksum = crc32(content);
    const localHeader = new Uint8Array(30 + name.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(12, 0x0021, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, content.length, true);
    localView.setUint32(22, content.length, true);
    localView.setUint16(26, name.length, true);
    localHeader.set(name, 30);
    localParts.push(localHeader, content);

    const centralHeader = new Uint8Array(46 + name.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(14, 0x0021, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, content.length, true);
    centralView.setUint32(24, content.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, localOffset, true);
    centralHeader.set(name, 46);
    centralParts.push(centralHeader);
    localOffset += localHeader.length + content.length;
  }

  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, localOffset, true);
  return new Blob([...localParts, ...centralParts, endRecord], { type: mimeType });
};

export const createXlsxWorkbook = (sheets: WorkbookSheet[]) => {
  if (sheets.length === 0) throw new Error("Workbook phải có ít nhất một sheet.");

  const worksheetContent = sheets.map(({ rows }) => {
    const sheetRows = rows.map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const cells = row.map((value, columnIndex) => {
        const reference = `${columnName(columnIndex)}${rowNumber}`;
        if (typeof value === "number" && Number.isFinite(value)) return `<c r="${reference}"><v>${value}</v></c>`;
        return `<c r="${reference}" t="inlineStr"><is><t>${escapeXml(String(value))}</t></is></c>`;
      }).join("");
      return `<row r="${rowNumber}">${cells}</row>`;
    }).join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`;
  });

  const contentTypes = sheets.map((_, index) =>
    `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join("");
  const workbookSheets = sheets.map(({ name }, index) =>
    `<sheet name="${escapeXml(name.slice(0, 31))}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
  ).join("");
  const relationships = sheets.map((_, index) =>
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
  ).join("");
  const files = [
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${contentTypes}</Types>`,
    },
    {
      name: "_rels/.rels",
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships}</Relationships>`,
    },
    ...worksheetContent.map((content, index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, content })),
  ];
  return makeZip(files, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
};

export const downloadFile = (fileName: string, file: Blob) => {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export interface FlashcardCsvCard {
  front: string;
  back: string;
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (quoted) throw new Error("The CSV has an unclosed quoted field.");
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows.filter((entry) => entry.some((value) => value.trim()));
}

export function cardsFromCsv(text: string): FlashcardCsvCard[] {
  const rows = parseCsvRows(text.replace(/^\uFEFF/, ""));
  if (rows.length === 0) throw new Error("The CSV is empty.");
  const headers = rows[0].map((value) => value.trim().toLocaleLowerCase());
  const frontIndex = headers.findIndex((value) => ["front", "question", "term", "prompt"].includes(value));
  const backIndex = headers.findIndex((value) => ["back", "answer", "definition", "response"].includes(value));
  const hasHeader = frontIndex >= 0 && backIndex >= 0;
  const resolvedFront = hasHeader ? frontIndex : 0;
  const resolvedBack = hasHeader ? backIndex : 1;
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const cards = dataRows.map((row) => ({
    front: (row[resolvedFront] ?? "").trim(),
    back: (row[resolvedBack] ?? "").trim(),
  })).filter((card) => card.front || card.back);
  if (cards.length < 2) throw new Error("The CSV needs at least two complete cards.");
  if (cards.length > 200) throw new Error("A deck can contain at most 200 cards.");
  if (cards.some((card) => !card.front || !card.back)) throw new Error("Every CSV row needs both a front and a back.");
  return cards;
}

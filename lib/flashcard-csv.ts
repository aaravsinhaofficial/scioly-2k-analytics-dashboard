export interface FlashcardCsvCard {
  front: string;
  back: string;
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let closedQuote = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
        closedQuote = true;
      } else {
        cell += character;
      }
    } else if (character === ",") {
      row.push(cell);
      cell = "";
      closedQuote = false;
    } else if (character === "\n" || character === "\r") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      closedQuote = false;
      if (character === "\r" && text[index + 1] === "\n") index += 1;
    } else if (closedQuote) {
      if (character !== " " && character !== "\t") throw new Error("The CSV has unexpected text after a quoted field.");
    } else if (character === '"') {
      if (cell.trim()) throw new Error("Quote the entire CSV field when it contains quotation marks.");
      cell = "";
      quoted = true;
    } else {
      cell += character;
    }
  }
  if (quoted) throw new Error("The CSV has an unclosed quoted field.");
  if (cell || row.length || closedQuote) {
    row.push(cell);
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
  if (cards.some((card) => card.front.length > 1000 || card.back.length > 5000)) {
    throw new Error("Each card can have at most 1,000 characters on the front and 5,000 on the back.");
  }
  if (cards.reduce((total, card) => total + card.front.length + card.back.length, 0) > 300_000) {
    throw new Error("This deck contains too much text.");
  }
  return cards;
}

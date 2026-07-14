import Papa from "papaparse";
import type {
  PracticeQuestionCsvError,
  PracticeQuestionCsvRow,
  PracticeQuestionType,
} from "@/lib/practice-types";

export const PRACTICE_QUESTION_CSV_MAX_BYTES = 512 * 1024;
export const PRACTICE_QUESTION_CSV_MAX_ROWS = 500;

export const PRACTICE_QUESTION_CSV_TEMPLATE = `Type,Question,Option A,Option B,Option C,Option D,Option E,Option F,Correct Answer,Model Answer,Explanation,Points,Order
MCQ,"Which value is closest to Avogadro's number?","6.02 x 10^23","9.81 m/s^2","3.00 x 10^8","1.60 x 10^-19",,,A,,"The mole contains approximately 6.02 x 10^23 particles.",2,
FRQ,"Explain how convection transfers thermal energy.",,,,,,,,"Warmer, less-dense material rises while cooler, denser material sinks, producing a circulating current.","A complete response connects density differences to the circulating motion.",3,`;

type CsvField =
  | "type"
  | "question"
  | "optionA"
  | "optionB"
  | "optionC"
  | "optionD"
  | "optionE"
  | "optionF"
  | "correctAnswer"
  | "modelAnswer"
  | "explanation"
  | "points"
  | "order";

export interface PracticeQuestionCsvParseResult {
  rows: PracticeQuestionCsvRow[];
  errors: PracticeQuestionCsvError[];
  rowCount: number;
  canImport: boolean;
}

const aliases: Record<CsvField, string[]> = {
  type: ["type", "questiontype"],
  question: ["question", "prompt", "questiontext"],
  optionA: ["optiona", "choicea", "answera"],
  optionB: ["optionb", "choiceb", "answerb"],
  optionC: ["optionc", "choicec", "answerc"],
  optionD: ["optiond", "choiced", "answerd"],
  optionE: ["optione", "choicee", "answere"],
  optionF: ["optionf", "choicef", "answerf"],
  correctAnswer: ["correctanswer", "correct", "answerkey", "key"],
  modelAnswer: ["modelanswer", "sampleanswer", "frqanswer"],
  explanation: ["explanation", "rationale", "feedback"],
  points: ["points", "pointvalue", "score"],
  order: ["order", "position", "questionorder"],
};

const aliasToField = new Map<string, CsvField>(
  (Object.entries(aliases) as Array<[CsvField, string[]]>).flatMap(([field, values]) =>
    values.map((value) => [value, field] as const),
  ),
);

const optionFields: CsvField[] = ["optionA", "optionB", "optionC", "optionD", "optionE", "optionF"];

function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function questionType(value: string): PracticeQuestionType | null {
  const normalized = normalizeHeader(value);
  if (["mcq", "multiplechoice", "multiplechoicequestion"].includes(normalized)) return "mcq";
  if (["frq", "freeresponse", "freeresponsequestion", "freeanswer"].includes(normalized)) return "frq";
  return null;
}

function parseInteger(value: string, minimum: number, maximum: number) {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}

function correctOption(value: string, options: string[]) {
  const normalized = value.trim();
  const letter = normalized.match(/^(?:option\s*)?([A-F])$/i)?.[1];
  if (letter) return letter.toUpperCase().charCodeAt(0) - 65;
  const number = normalized.match(/^(?:option\s*)?([1-6])$/i)?.[1];
  if (number) return Number(number) - 1;
  const normalizedText = normalized.toLocaleLowerCase();
  const matches = options
    .map((option, index) => ({ option: option.toLocaleLowerCase(), index }))
    .filter((entry) => entry.option === normalizedText);
  return matches.length === 1 ? matches[0].index : -1;
}

function pushError(
  errors: PracticeQuestionCsvError[],
  row: number,
  message: string,
  field?: string,
) {
  if (!errors.some((error) => error.row === row && error.field === field && error.message === message)) {
    errors.push({ row, field, message });
  }
}

/**
 * Parse and validate a practice-question CSV without side effects. Positions left
 * blank remain undefined so the server can append them after the test's current
 * maximum order immediately before previewing or committing.
 */
export function parsePracticeQuestionCsv(
  rawCsv: string,
  options: { maxRows?: number } = {},
): PracticeQuestionCsvParseResult {
  const maxRows = options.maxRows ?? PRACTICE_QUESTION_CSV_MAX_ROWS;
  const errors: PracticeQuestionCsvError[] = [];
  const parsed = Papa.parse<string[]>(rawCsv, {
    delimiter: ",",
    quoteChar: '"',
    escapeChar: '"',
    skipEmptyLines: "greedy",
  });

  for (const error of parsed.errors) {
    pushError(
      errors,
      typeof error.row === "number" ? error.row + 1 : 1,
      `CSV syntax: ${error.message}`,
    );
  }

  const records = parsed.data;
  if (records.length === 0 || records[0].every((value) => !clean(value))) {
    pushError(errors, 1, "Add a header row and at least one question.");
    return { rows: [], errors, rowCount: 0, canImport: false };
  }

  const headers = records[0].map((header) => aliasToField.get(normalizeHeader(clean(header))));
  const indexes = new Map<CsvField, number>();
  headers.forEach((field, index) => {
    if (!field) return;
    if (indexes.has(field)) {
      pushError(errors, 1, `The ${field} column appears more than once.`, field);
      return;
    }
    indexes.set(field, index);
  });
  if (!indexes.has("type")) pushError(errors, 1, 'A "Type" column is required.', "Type");
  if (!indexes.has("question")) pushError(errors, 1, 'A "Question" column is required.', "Question");

  const dataRecords = records.slice(1);
  const rowCount = dataRecords.length;
  if (rowCount === 0) pushError(errors, 2, "Add at least one question row.");
  if (rowCount > maxRows) {
    pushError(errors, 1, `This CSV has ${rowCount} rows; the limit is ${maxRows}.`);
  }
  if (errors.some((error) => error.row === 1)) {
    return { rows: [], errors, rowCount, canImport: false };
  }

  const rows: PracticeQuestionCsvRow[] = [];
  for (const [recordIndex, record] of dataRecords.slice(0, maxRows).entries()) {
    const sourceRow = recordIndex + 2;
    const rowErrorStart = errors.length;
    const value = (field: CsvField) => clean(record[indexes.get(field) ?? -1]);
    const extraValues = record.slice(records[0].length).filter((entry) => clean(entry));
    if (extraValues.length > 0) {
      pushError(errors, sourceRow, "This row has values beyond the final CSV header. Check its commas and quotes.");
    }

    const typeValue = value("type");
    const type = questionType(typeValue);
    if (!type) pushError(errors, sourceRow, 'Type must be "MCQ" or "FRQ".', "Type");

    const prompt = value("question");
    if (!prompt) pushError(errors, sourceRow, "Question is required.", "Question");
    else if (prompt.length > 8000) pushError(errors, sourceRow, "Question must be 8,000 characters or fewer.", "Question");

    const rawOptions = optionFields.map(value);
    const lastOption = rawOptions.reduce((last, option, index) => option ? index : last, -1);
    const options = lastOption >= 0 ? rawOptions.slice(0, lastOption + 1) : [];
    const modelAnswer = value("modelAnswer");
    const correctAnswer = value("correctAnswer");
    let parsedCorrectOption: number | undefined;

    if (type === "mcq") {
      if (options.length < 2 || options.length > 6) {
        pushError(errors, sourceRow, "MCQs need 2 to 6 choices starting with Option A and Option B.", "Option A-F");
      }
      if (options.some((option) => !option)) {
        pushError(errors, sourceRow, "MCQ choices cannot have a blank between filled options.", "Option A-F");
      }
      if (options.some((option) => option.length > 1000)) {
        pushError(errors, sourceRow, "Each choice must be 1,000 characters or fewer.", "Option A-F");
      }
      if (new Set(options.map((option) => option.toLocaleLowerCase())).size !== options.length) {
        pushError(errors, sourceRow, "Each MCQ choice must be different.", "Option A-F");
      }
      if (!correctAnswer) {
        pushError(errors, sourceRow, "Correct Answer is required for an MCQ.", "Correct Answer");
      } else {
        const index = correctOption(correctAnswer, options);
        if (index < 0 || index >= options.length) {
          pushError(errors, sourceRow, "Correct Answer must be A-F, 1-6, or the exact text of a filled choice.", "Correct Answer");
        } else {
          parsedCorrectOption = index;
        }
      }
    }

    if (type === "frq") {
      if (!modelAnswer) pushError(errors, sourceRow, "Model Answer is required for an FRQ.", "Model Answer");
      else if (modelAnswer.length > 12000) pushError(errors, sourceRow, "Model Answer must be 12,000 characters or fewer.", "Model Answer");
      if (rawOptions.some(Boolean) || correctAnswer) {
        pushError(errors, sourceRow, "FRQ rows must leave Option A-F and Correct Answer blank.", "Option A-F");
      }
    }

    const explanation = value("explanation");
    if (explanation.length > 12000) {
      pushError(errors, sourceRow, "Explanation must be 12,000 characters or fewer.", "Explanation");
    }

    const pointsValue = value("points");
    const points = pointsValue ? parseInteger(pointsValue, 1, 100) : 1;
    if (points === null) pushError(errors, sourceRow, "Points must be a whole number from 1 to 100.", "Points");

    const orderValue = value("order");
    const position = orderValue ? parseInteger(orderValue, 0, 1000) : undefined;
    if (orderValue && position === null) pushError(errors, sourceRow, "Order must be a whole number from 0 to 1,000 or left blank.", "Order");

    if (errors.length === rowErrorStart && type && points !== null && position !== null) {
      rows.push({
        sourceRow,
        type,
        prompt,
        options: type === "mcq" ? options : [],
        ...(type === "mcq" ? { correctOption: parsedCorrectOption } : { modelAnswer }),
        ...(explanation ? { explanation } : {}),
        points,
        ...(position === undefined ? {} : { position }),
      });
    }
  }

  return {
    rows,
    errors,
    rowCount,
    canImport: rowCount > 0 && rowCount <= maxRows && errors.length === 0 && rows.length === rowCount,
  };
}

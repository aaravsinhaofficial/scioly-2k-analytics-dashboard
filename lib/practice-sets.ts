import { getEventKnowledge, type EventKnowledge } from "@/lib/event-content";
import type { Difficulty, SciolyEventHub, SciolyPracticePrompt, SciolyQuestion, SciolyTest } from "@/lib/resource-data";

type PracticeSeed = Pick<SciolyEventHub, "name" | "category">;

const practiceThemes: Array<{
  name: string;
  description: string;
  format: SciolyTest["format"];
  difficulty: Difficulty;
  durationMinutes: number;
}> = [
  { name: "Content Foundations MCQ", description: "definitions and core relationships", format: "Full Test", difficulty: "Rookie", durationMinutes: 50 },
  { name: "Mechanisms MCQ", description: "processes, causes, and quantitative relationships", format: "Full Test", difficulty: "Pro", durationMinutes: 50 },
  { name: "Applications MCQ", description: "event scenarios, observations, and interpretation", format: "Full Test", difficulty: "Pro", durationMinutes: 50 },
  { name: "Core Explanations", description: "precise explanations of 2027 content", format: "Full Test", difficulty: "Rookie", durationMinutes: 45 },
  { name: "Case Analysis", description: "identify the concept that explains each case", format: "Full Test", difficulty: "Pro", durationMinutes: 45 },
  { name: "Compare and Contrast", description: "distinguish related event concepts using mechanisms and evidence", format: "Full Test", difficulty: "Pro", durationMinutes: 45 },
  { name: "Evidence Interpretation", description: "connect observations to the correct scientific principle", format: "Full Test", difficulty: "Pro", durationMinutes: 45 },
  { name: "Systems Synthesis", description: "combine content across the published event scope", format: "Full Test", difficulty: "All-Star", durationMinutes: 50 },
  { name: "Invitational Simulation", description: "mixed short-response event content at tournament pace", format: "Testoff Set", difficulty: "All-Star", durationMinutes: 50 },
  { name: "Testoff Challenge", description: "advanced content explanations and error correction", format: "Testoff Set", difficulty: "All-Star", durationMinutes: 50 },
];

function at<T>(items: T[], index: number) {
  return items[((index % items.length) + items.length) % items.length];
}

function choices(
  knowledge: EventKnowledge[],
  itemIndex: number,
  field: "term" | "definition" | "mechanism" | "application",
  seed: number,
) {
  const correct = knowledge[itemIndex][field];
  const alternatives: string[] = [];
  for (let offset = 1; alternatives.length < 3 && offset < knowledge.length + 4; offset += 1) {
    const candidate = at(knowledge, itemIndex + offset * 3)[field];
    if (candidate !== correct && !alternatives.includes(candidate)) alternatives.push(candidate);
  }
  const answerIndex = seed % 4;
  const options = [...alternatives];
  options.splice(answerIndex, 0, correct);
  return { options: options.slice(0, 4), correctOption: answerIndex };
}

function contentMcq(
  knowledge: EventKnowledge[],
  item: EventKnowledge,
  itemIndex: number,
  variant: number,
): Omit<SciolyPracticePrompt, "number"> {
  const seed = itemIndex * 5 + variant * 3 + 1;

  if (variant === 0) {
    const answerChoices = choices(knowledge, itemIndex, "definition", seed);
    return {
      points: 5,
      prompt: `Which statement correctly defines ${item.term}?`,
      ...answerChoices,
      answer: `${item.term}: ${item.definition} ${item.mechanism}`,
    };
  }
  if (variant === 1) {
    const answerChoices = choices(knowledge, itemIndex, "mechanism", seed);
    return {
      points: 5,
      prompt: `Which process or relationship best explains ${item.term}?`,
      ...answerChoices,
      answer: `${item.mechanism} Example: ${item.application}`,
    };
  }
  if (variant === 2) {
    const answerChoices = choices(knowledge, itemIndex, "application", seed);
    return {
      points: 5,
      prompt: `Which observation or situation is the best application of ${item.term}?`,
      ...answerChoices,
      answer: `${item.application} This follows because ${item.mechanism}`,
    };
  }
  if (variant === 3) {
    const answerChoices = choices(knowledge, itemIndex, "term", seed);
    return {
      points: 5,
      prompt: `Which term matches this definition? ${item.definition}`,
      ...answerChoices,
      answer: `${item.term}. ${item.mechanism}`,
    };
  }
  if (variant === 4) {
    const answerChoices = choices(knowledge, itemIndex, "term", seed);
    return {
      points: 5,
      prompt: `Which concept is described by this mechanism? ${item.mechanism}`,
      ...answerChoices,
      answer: `${item.term}. ${item.definition}`,
    };
  }
  const answerChoices = choices(knowledge, itemIndex, "term", seed);
  return {
    points: 5,
    prompt: `Which concept most directly explains this case? ${item.application}`,
    ...answerChoices,
    answer: `${item.term}. ${item.mechanism}`,
  };
}

function makeMcqPool(knowledge: EventKnowledge[]) {
  return Array.from({ length: 6 }, (_, variant) =>
    knowledge.map((item, itemIndex) => contentMcq(knowledge, item, itemIndex, variant))
  ).flat();
}

function makeMcqQuestions(knowledge: EventKnowledge[], testIndex: number): SciolyPracticePrompt[] {
  const pool = makeMcqPool(knowledge);
  const start = testIndex * 20;
  return Array.from({ length: 20 }, (_, index) => ({
    ...at(pool, start + index),
    number: index + 1,
  }));
}

function makeWrittenQuestions(knowledge: EventKnowledge[], testIndex: number): SciolyPracticePrompt[] {
  const base = testIndex * 3;
  const a = at(knowledge, base);
  const b = at(knowledge, base + 1);
  const c = at(knowledge, base + 2);
  const d = at(knowledge, base + 3);
  const e = at(knowledge, base + 4);
  const f = at(knowledge, base + 5);
  const g = at(knowledge, base + 6);
  const h = at(knowledge, base + 7);

  return [
    { number: 1, points: 5, prompt: `Define ${a.term}, explain its mechanism, and give one event-relevant consequence or observation.`, answer: `${a.definition} ${a.mechanism} ${a.application}` },
    { number: 2, points: 5, prompt: `A station presents this case: ${b.application} Identify the relevant concept and explain why it fits.`, answer: `${b.term}. ${b.definition} ${b.mechanism}` },
    { number: 3, points: 5, prompt: `Compare ${c.term} with ${d.term}. Define both, then state the key process or relationship behind each.`, answer: `${c.term}: ${c.definition} ${c.mechanism} ${d.term}: ${d.definition} ${d.mechanism}` },
    { number: 4, points: 5, prompt: `A teammate says this case is an example of ${f.term}: “${e.application}” Correct or defend the claim using the underlying science.`, answer: `The case is an application of ${e.term}: ${e.definition} ${e.mechanism} ${f.term} instead refers to ${f.definition}` },
    { number: 5, points: 5, prompt: `Name the concept described by this process, then supply a concrete application: ${f.mechanism}`, answer: `${f.term}. ${f.definition} Application: ${f.application}` },
    { number: 6, points: 5, prompt: `Explain the causal chain connecting ${g.term} to this result: ${g.application}`, answer: `${g.definition} ${g.mechanism} Therefore, ${g.application}` },
    { number: 7, points: 5, prompt: `Distinguish ${h.term} from ${a.term} using one defining feature and one observable application for each.`, answer: `${h.term}: ${h.definition} ${h.application} ${a.term}: ${a.definition} ${a.application}` },
    { number: 8, points: 5, prompt: `Write a concise scientific explanation that uses both ${b.term} and ${c.term}. State each mechanism and do not treat the terms as interchangeable.`, answer: `${b.term} works because ${b.mechanism} ${c.term} works because ${c.mechanism} A complete response preserves the distinction: ${b.definition} By contrast, ${c.definition}` },
  ];
}

export function buildPracticeQuestions(seed: PracticeSeed): SciolyQuestion[] {
  const knowledge = getEventKnowledge(seed.name);
  return knowledge.slice(0, 5).map((item, index) => ({
    topic: item.topic,
    difficulty: index < 2 ? "Rookie" : index < 4 ? "Pro" : "All-Star",
    question: `What is ${item.term}, and what mechanism or relationship makes it work?`,
    answer: `${item.definition} ${item.mechanism}`,
    explanation: item.application,
  }));
}

export function buildPracticeTests(seed: PracticeSeed): SciolyTest[] {
  const knowledge = getEventKnowledge(seed.name);
  if (knowledge.length < 10) return [];

  return practiceThemes.map((theme, index) => ({
    testNumber: index + 1,
    title: `Practice Test ${index + 1}: ${theme.name}`,
    format: theme.format,
    difficulty: theme.difficulty,
    durationMinutes: theme.durationMinutes,
    description: `${index < 3 ? "Twenty multiple-choice questions on" : "Eight written questions covering"} ${theme.description} from the official 2027 ${seed.name} scope.`,
    body: `Original team practice material based on the official 2027 event scope. Suggested time: ${theme.durationMinutes} minutes. Complete all ${index < 3 ? 20 : 8} content questions before opening the answer guide.`,
    questions: index < 3 ? makeMcqQuestions(knowledge, index) : makeWrittenQuestions(knowledge, index),
  }));
}

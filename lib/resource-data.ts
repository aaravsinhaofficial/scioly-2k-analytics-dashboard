export type ResourceType = "Notes" | "Video" | "Cheat Sheet" | "Guide" | "Rules" | "Test";
export type Difficulty = "Rookie" | "Pro" | "All-Star";

export interface SciolyResource {
  title: string;
  type: ResourceType;
  topic: string;
  difficulty: Difficulty;
  description: string;
  recommended?: boolean;
}

export interface SciolyQuestion {
  topic: string;
  difficulty: Difficulty;
  question: string;
  answer: string;
  explanation: string;
}

export interface SciolyTest {
  title: string;
  format: "Mini Test" | "Full Test" | "Testoff Set";
  difficulty: Difficulty;
  description: string;
}

export interface SciolyEventHub {
  name: string;
  slug: string;
  category: "Study" | "Build" | "Lab" | "Hybrid";
  resourceOvr: number;
  readiness: "Loaded" | "Building" | "Needs Uploads";
  lead: string;
  tagline: string;
  description: string;
  starterPath: string[];
  topics: string[];
  resources: SciolyResource[];
  questions: SciolyQuestion[];
  tests: SciolyTest[];
}

export const resourceAnnouncements = [
  {
    label: "Resource System",
    title: "Event hubs are the main workflow",
    body: "Members should choose an event first, then use its starter guide, resources, practice questions, and test bank."
  },
  {
    label: "Officer Queue",
    title: "Uploads should be curated, not dumped",
    body: "Event leads should pin the best resources and remove outdated links so new members do not waste prep time."
  },
  {
    label: "Testoff Prep",
    title: "Practice tests belong with each event",
    body: "Full tests, mini tests, answer keys, and explanations should sit inside the relevant event hub."
  }
];

export const sciolyEvents: SciolyEventHub[] = [
  {
    name: "Thermodynamics",
    slug: "thermodynamics",
    category: "Hybrid",
    resourceOvr: 91,
    readiness: "Loaded",
    lead: "Event Lead TBD",
    tagline: "Heat transfer, calculations, and device optimization.",
    description:
      "Thermodynamics needs both concept fluency and disciplined build testing. The resource hub should connect notes, formulas, build logs, and practice questions instead of leaving them in separate folders.",
    starterPath: [
      "Learn conduction, convection, radiation, insulation, and temperature graph interpretation.",
      "Drill equation setup and unit consistency before moving into full tests.",
      "Keep a build log for every material change, trial condition, and performance result.",
      "Use mini tests weekly, then full tests once the fundamentals stop feeling shaky."
    ],
    topics: ["Heat transfer", "Energy calculations", "Graphs", "Device testing", "Build logs"],
    resources: [
      {
        title: "Formula Locker",
        type: "Cheat Sheet",
        topic: "Energy calculations",
        difficulty: "Rookie",
        description: "Quick equation and unit reference for early-season practice.",
        recommended: true
      },
      {
        title: "Heat Transfer Notes",
        type: "Notes",
        topic: "Heat transfer",
        difficulty: "Rookie",
        description: "Core explanation of conduction, convection, radiation, and insulation traps."
      },
      {
        title: "Build Trial Log Template",
        type: "Guide",
        topic: "Device testing",
        difficulty: "Pro",
        description: "A structured log for materials, measurements, design changes, and results.",
        recommended: true
      }
    ],
    questions: [
      {
        topic: "Heat transfer",
        difficulty: "Rookie",
        question: "Which heat transfer mechanism occurs through direct contact?",
        answer: "Conduction",
        explanation: "Conduction transfers thermal energy through direct particle contact, especially in solids."
      },
      {
        topic: "Build testing",
        difficulty: "Pro",
        question: "Why should teams change only one major build variable at a time?",
        answer: "So the performance effect can be attributed to that variable.",
        explanation: "Changing multiple variables at once creates noisy test data and makes optimization unreliable."
      }
    ],
    tests: [
      {
        title: "Thermo Mini Test 01",
        format: "Mini Test",
        difficulty: "Rookie",
        description: "Short concept check for heat transfer and calculations."
      },
      {
        title: "Thermo Testoff Set",
        format: "Testoff Set",
        difficulty: "Pro",
        description: "Mixed placement-style questions for early roster decisions."
      }
    ]
  },
  {
    name: "Designer Genes",
    slug: "designer-genes",
    category: "Study",
    resourceOvr: 88,
    readiness: "Building",
    lead: "Event Lead TBD",
    tagline: "Genetics, inheritance, biotechnology, and application-heavy practice.",
    description:
      "Designer Genes rewards active problem solving. The hub should push members from vocabulary into Punnett squares, pedigrees, molecular biology, and biotech applications quickly.",
    starterPath: [
      "Master DNA, RNA, transcription, translation, mutations, and chromosome vocabulary.",
      "Practice inheritance patterns until monohybrid and dihybrid setups are automatic.",
      "Add pedigrees and biotechnology only after the genetics basics are stable.",
      "Use explanations after every missed question, not just answer keys."
    ],
    topics: ["DNA/RNA", "Inheritance", "Pedigrees", "Mutations", "Biotechnology"],
    resources: [
      {
        title: "Genetics Starter Notes",
        type: "Notes",
        topic: "Inheritance",
        difficulty: "Rookie",
        description: "Core vocabulary and inheritance patterns for newer members.",
        recommended: true
      },
      {
        title: "Pedigree Decision Guide",
        type: "Guide",
        topic: "Pedigrees",
        difficulty: "Pro",
        description: "How to reason through dominant, recessive, autosomal, and sex-linked patterns."
      },
      {
        title: "Biotech Terms Sheet",
        type: "Cheat Sheet",
        topic: "Biotechnology",
        difficulty: "All-Star",
        description: "Compact review of common lab techniques and biotechnology vocabulary."
      }
    ],
    questions: [
      {
        topic: "DNA/RNA",
        difficulty: "Rookie",
        question: "What molecule carries genetic instructions from DNA to the ribosome?",
        answer: "mRNA",
        explanation: "Messenger RNA carries the copied genetic message from transcription to translation."
      },
      {
        topic: "Inheritance",
        difficulty: "Pro",
        question: "What phenotypic ratio is expected from two heterozygous parents for a simple dominant trait?",
        answer: "3:1",
        explanation: "The genotype ratio is 1:2:1, but three of the four outcomes show the dominant phenotype."
      }
    ],
    tests: [
      {
        title: "Designer Genes Topic Sprint",
        format: "Mini Test",
        difficulty: "Rookie",
        description: "Fast check for DNA/RNA, inheritance, and key vocabulary."
      },
      {
        title: "Designer Genes Full Practice",
        format: "Full Test",
        difficulty: "Pro",
        description: "Full mixed practice across genetics, pedigrees, and biotechnology."
      }
    ]
  },
  {
    name: "Fossils",
    slug: "fossils",
    category: "Study",
    resourceOvr: 84,
    readiness: "Building",
    lead: "Event Lead TBD",
    tagline: "Identification, morphology, geologic time, and paleoecology.",
    description:
      "Fossils needs image-based recognition and clean organization. Resources should be grouped by fossil group, morphology, and time period so members are not just memorizing random facts.",
    starterPath: [
      "Learn broad fossil groups before memorizing every specimen detail.",
      "Practice with images early because recognition speed matters.",
      "Connect examples to geologic time so timeline questions stop feeling random.",
      "Use mini ID tests repeatedly before attempting full mixed tests."
    ],
    topics: ["Identification", "Geologic time", "Morphology", "Classification", "Paleoecology"],
    resources: [
      {
        title: "Beginner ID Board",
        type: "Guide",
        topic: "Identification",
        difficulty: "Rookie",
        description: "Starter roadmap for learning the major fossil groups.",
        recommended: true
      },
      {
        title: "Geologic Time Review",
        type: "Notes",
        topic: "Geologic time",
        difficulty: "Rookie",
        description: "Era, period, and fossil range review for timeline questions."
      },
      {
        title: "Morphology Terms Sheet",
        type: "Cheat Sheet",
        topic: "Morphology",
        difficulty: "Pro",
        description: "Common descriptive terms used during fossil ID and comparison."
      }
    ],
    questions: [
      {
        topic: "Geologic time",
        difficulty: "Rookie",
        question: "Which is broader: era, period, or epoch?",
        answer: "Era",
        explanation: "Eras contain periods, and periods contain epochs. The hierarchy matters for timeline reasoning."
      },
      {
        topic: "Identification",
        difficulty: "Pro",
        question: "Why should Fossils competitors study images instead of only written notes?",
        answer: "Because event performance depends heavily on visual recognition under time pressure.",
        explanation: "Notes help with facts, but fast identification usually comes from repeated visual comparison."
      }
    ],
    tests: [
      {
        title: "Fossils ID Sprint",
        format: "Mini Test",
        difficulty: "Rookie",
        description: "Short image-recognition style practice for early prep."
      },
      {
        title: "Fossils Mixed Test",
        format: "Full Test",
        difficulty: "Pro",
        description: "Mixed ID, morphology, geologic time, and paleoecology practice."
      }
    ]
  },
  {
    name: "Engineering CAD",
    slug: "engineering-cad",
    category: "Build",
    resourceOvr: 79,
    readiness: "Needs Uploads",
    lead: "Event Lead TBD",
    tagline: "CAD speed, constraints, drawings, and engineering communication.",
    description:
      "Engineering CAD should be treated like a performance event, not just software practice. The hub needs starter workflows, timed modeling drills, drawings, and documentation examples.",
    starterPath: [
      "Learn sketch constraints and dimensions before attempting complex parts.",
      "Recreate simple objects from drawings to build speed and accuracy.",
      "Practice clean feature history and readable design intent.",
      "Save strong examples so newer members can see what good CAD documentation looks like."
    ],
    topics: ["Sketches", "Constraints", "Part modeling", "Drawings", "Documentation"],
    resources: [
      {
        title: "CAD Starter Workflow",
        type: "Guide",
        topic: "Sketches",
        difficulty: "Rookie",
        description: "Clean order of operations for sketches, features, dimensions, and revisions.",
        recommended: true
      },
      {
        title: "Common CAD Mistakes",
        type: "Notes",
        topic: "Part modeling",
        difficulty: "Rookie",
        description: "Avoid under-defined sketches, messy feature trees, and unclear dimensions."
      },
      {
        title: "Timed Drawing Set",
        type: "Guide",
        topic: "Drawings",
        difficulty: "Pro",
        description: "Prompt set for timed CAD reconstruction practice."
      }
    ],
    questions: [
      {
        topic: "Constraints",
        difficulty: "Rookie",
        question: "Why is a fully constrained sketch better than loose geometry?",
        answer: "It preserves design intent and prevents accidental shape changes.",
        explanation: "Constraints keep geometry predictable when dimensions or features are edited."
      },
      {
        topic: "Drawings",
        difficulty: "Pro",
        question: "What does a technical drawing communicate that a model alone may not?",
        answer: "Dimensions, tolerances, views, and design intent.",
        explanation: "A model shows shape, but a drawing explains how the part is defined and manufactured."
      }
    ],
    tests: [
      {
        title: "CAD Speed Drill",
        format: "Mini Test",
        difficulty: "Rookie",
        description: "Timed practice for recreating simple parts accurately."
      },
      {
        title: "CAD Testoff Challenge",
        format: "Testoff Set",
        difficulty: "Pro",
        description: "Mixed modeling and documentation task for placement."
      }
    ]
  },
  {
    name: "Experimental Design",
    slug: "experimental-design",
    category: "Lab",
    resourceOvr: 82,
    readiness: "Building",
    lead: "Event Lead TBD",
    tagline: "Rubric discipline, controlled experiments, and fast scientific writing.",
    description:
      "Experimental Design is a rubric event. The hub should make the scoring structure unavoidable and give members repeated timed drills instead of vague advice.",
    starterPath: [
      "Learn the rubric first because structure drives scoring.",
      "Practice variables, controls, hypothesis, materials, and procedures separately.",
      "Move into short timed writeups before full event simulations.",
      "Review old writeups by marking missing rubric points."
    ],
    topics: ["Variables", "Hypothesis", "Procedure", "Data tables", "Analysis", "Conclusion"],
    resources: [
      {
        title: "Rubric Breakdown",
        type: "Guide",
        topic: "Rubric",
        difficulty: "Rookie",
        description: "Explains the major sections of a strong Experimental Design writeup.",
        recommended: true
      },
      {
        title: "Variables Drill Sheet",
        type: "Notes",
        topic: "Variables",
        difficulty: "Rookie",
        description: "Practice identifying independent, dependent, and controlled variables."
      }
    ],
    questions: [
      {
        topic: "Variables",
        difficulty: "Rookie",
        question: "In an experiment testing how temperature affects dissolving time, what is the independent variable?",
        answer: "Temperature",
        explanation: "The independent variable is the factor intentionally changed by the experimenter."
      },
      {
        topic: "Procedure",
        difficulty: "Pro",
        question: "Why should a procedure be specific enough for another team to repeat?",
        answer: "Repeatability is central to a controlled experiment.",
        explanation: "Vague procedures make the experiment weaker and usually lose rubric credit."
      }
    ],
    tests: [
      {
        title: "Experimental Design Timed Drill",
        format: "Mini Test",
        difficulty: "Rookie",
        description: "Short timed drill for variables, hypothesis, and procedure."
      }
    ]
  }
];

export function getSciolyEvent(slug: string) {
  return sciolyEvents.find((event) => event.slug === slug);
}

export function getResourceStats() {
  const resources = sciolyEvents.flatMap((event) => event.resources);
  const questions = sciolyEvents.flatMap((event) => event.questions);
  const tests = sciolyEvents.flatMap((event) => event.tests);

  return {
    events: sciolyEvents.length,
    resources: resources.length,
    questions: questions.length,
    tests: tests.length,
    averageResourceOvr: Math.round(
      sciolyEvents.reduce((total, event) => total + event.resourceOvr, 0) / sciolyEvents.length
    )
  };
}

export function getFeaturedResources() {
  return sciolyEvents.flatMap((event) =>
    event.resources
      .filter((resource) => resource.recommended)
      .map((resource) => ({ ...resource, eventName: event.name, eventSlug: event.slug }))
  );
}

export function getAllPracticeQuestions() {
  return sciolyEvents.flatMap((event) =>
    event.questions.map((question) => ({ ...question, eventName: event.name, eventSlug: event.slug }))
  );
}

export function getAllPracticeTests() {
  return sciolyEvents.flatMap((event) =>
    event.tests.map((test) => ({ ...test, eventName: event.name, eventSlug: event.slug }))
  );
}

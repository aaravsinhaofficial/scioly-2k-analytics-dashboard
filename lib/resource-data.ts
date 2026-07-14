export type ResourceType = "Notes" | "Video" | "Cheat Sheet" | "Guide" | "Rules" | "Test";
export type Difficulty = "Rookie" | "Pro" | "All-Star";

export interface SciolyResource {
  libraryId?: number;
  title: string;
  type: ResourceType;
  topic: string;
  difficulty: Difficulty;
  description: string;
  recommended?: boolean;
  url?: string;
  body?: string;
  managed?: boolean;
}

export interface SciolyQuestion {
  libraryId?: number;
  topic: string;
  difficulty: Difficulty;
  question: string;
  answer: string;
  explanation: string;
  managed?: boolean;
}

export interface SciolyTest {
  libraryId?: number;
  title: string;
  format: "Mini Test" | "Full Test" | "Testoff Set";
  difficulty: Difficulty;
  description: string;
  url?: string;
  body?: string;
  managed?: boolean;
}

export interface SciolyEventHub {
  name: string;
  slug: string;
  category: "Study" | "Build" | "Lab" | "Hybrid";
  season?: number;
  rulesStatus?: "Draft" | "Official";
  isTrial?: boolean;
  coverageScore: number;
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

interface EventSeed extends Omit<SciolyEventHub, "coverageScore" | "readiness" | "lead" | "questions" | "tests"> {
  resources: SciolyResource[];
}

function linkedResource(
  title: string,
  type: ResourceType,
  topic: string,
  difficulty: Difficulty,
  description: string,
  url: string,
  recommended = false,
): SciolyResource {
  const resolvedDescription = title === "Official Science Olympiad event hub"
    ? "Science Olympiad's official event page. The 2027 material may still be pending or marked archived, so confirm the page has updated before treating it as final."
    : description;
  return { title, type, topic, difficulty, description: resolvedDescription, url, recommended };
}

function eventHub(seed: EventSeed): SciolyEventHub {
  const representedTopics = new Set(seed.resources.map((resource) => resource.topic));
  const coveredTopics = seed.topics.filter((topic) => representedTopics.has(topic)).length;
  const coverageRatio = coveredTopics / Math.max(1, seed.topics.length);
  return {
    ...seed,
    season: 2027,
    rulesStatus: "Draft",
    // This is derived from named topics that have at least one shared resource,
    // rather than an arbitrary event rating.
    coverageScore: Math.round(coverageRatio * 100),
    readiness: seed.resources.length === 0
      ? "Needs Uploads"
      : coverageRatio >= 0.75 && seed.resources.length >= 4
        ? "Loaded"
        : "Building",
    lead: "Event lead not assigned",
    questions: [],
    tests: [],
  };
}

export const resourceAnnouncements = [
  {
    label: "2027 season",
    title: "The complete Division C slate is indexed",
    body: "The 23 scored events are included, plus Code Craze as a clearly labeled featured trial. Check your tournament schedule before preparing for a trial event."
  },
  {
    label: "Source quality",
    title: "Every built-in item opens a real source",
    body: "The starter library uses Science Olympiad, government, university, and established educational sources. Team uploads remain separate and editable."
  },
  {
    label: "Rules status",
    title: "Use the draft for scope, not final dimensions",
    body: "The supplied Summer Workshop rules are marked draft. Always use the official event page for final rules, corrections, and clarifications before building or competing."
  }
];

export const sciolyEvents: SciolyEventHub[] = [
  eventHub({
    name: "Anatomy and Physiology",
    slug: "anatomy-and-physiology",
    category: "Study",
    tagline: "Digestive, immune, and respiratory systems for the 2027 season.",
    description: "Study structure and function from tissue level through whole-system physiology, then connect normal regulation to common disorders and diagnostic reasoning.",
    starterPath: [
      "Build one labeled system map for each of the three 2027 body systems.",
      "Learn the function of every major structure before memorizing disorders.",
      "Practice tracing food, air, immune cells, and feedback signals through each system."
    ],
    topics: ["Respiratory system", "Digestive system", "Immune system", "Histology", "Homeostasis", "Disorders"],
    resources: [
      linkedResource("Official Science Olympiad event hub", "Rules", "Homeostasis", "Rookie", "Current event overview, official updates, and Science Olympiad resources.", "https://www.soinc.org/anatomy-and-physiology-c", true),
      linkedResource("OpenStax: Respiratory System", "Guide", "Respiratory system", "Rookie", "Free, illustrated chapters covering respiratory anatomy, mechanics, gas exchange, and regulation.", "https://openstax.org/books/anatomy-and-physiology-2e/pages/22-introduction"),
      linkedResource("OpenStax: Digestive System", "Guide", "Digestive system", "Rookie", "A structured reference for digestion, absorption, accessory organs, and metabolism.", "https://openstax.org/books/anatomy-and-physiology-2e/pages/23-introduction"),
      linkedResource("OpenStax: Lymphatic and Immune System", "Guide", "Immune system", "Pro", "Covers innate and adaptive immunity, lymphatic anatomy, and immune responses.", "https://openstax.org/books/anatomy-and-physiology-2e/pages/21-introduction")
    ]
  }),
  eventHub({
    name: "Astronomy",
    slug: "astronomy",
    category: "Study",
    tagline: "Stellar evolution in normal and starburst galaxies.",
    description: "Connect stellar birth, evolution, and endpoints to spectra, H-R diagrams, galaxy environments, and the deep-sky objects identified in the 2027 rules.",
    starterPath: [
      "Map stellar evolution paths by initial mass and place each stage on an H-R diagram.",
      "Learn how spectra, light curves, and multiwavelength images reveal physical conditions.",
      "Build an image-and-data notebook for every object on the official list."
    ],
    topics: ["Stellar evolution", "H-R diagrams", "Spectroscopy", "Starburst galaxies", "Deep-sky objects", "Image analysis"],
    resources: [
      linkedResource("Official Science Olympiad event hub", "Rules", "Deep-sky objects", "Rookie", "Official event scope, links, corrections, and supporting files.", "https://www.soinc.org/astronomy-c", true),
      linkedResource("NASA: Stellar Evolution", "Guide", "Stellar evolution", "Rookie", "NASA overview of how stars form, change, and return material to the universe.", "https://science.nasa.gov/learn/heat/big-ideas/big-idea-3-3/"),
      linkedResource("OpenStax Astronomy 2e", "Guide", "Spectroscopy", "Rookie", "Free university textbook covering spectra, stellar evolution, compact objects, galaxies, and cosmology.", "https://openstax.org/details/books/astronomy-2e"),
      linkedResource("NASA Hubble: Galaxies", "Guide", "Starburst galaxies", "Pro", "Multiwavelength images and explanations of galaxy structure, evolution, interaction, and star formation.", "https://science.nasa.gov/mission/hubble/science/universe-uncovered/hubble-galaxies/")
    ]
  }),
  eventHub({
    name: "Boomilever",
    slug: "boomilever",
    category: "Build",
    tagline: "A cantilevered wood structure optimized for load and mass.",
    description: "Use statics, careful joints, material selection, repeatable construction, and destructive testing to improve structural efficiency within the final rules.",
    starterPath: [
      "Draw the load path and identify members in tension and compression.",
      "Standardize wood selection, cuts, glue amount, and curing time.",
      "Test safely, record failure location, and change one design variable per revision."
    ],
    topics: ["Statics", "Tension and compression", "Wood properties", "Joint design", "Construction", "Load testing"],
    resources: [
      linkedResource("Official Science Olympiad event hub", "Rules", "Construction", "Rookie", "Official dimensions, scoring, clarifications, and event resources; verify this before every build.", "https://www.soinc.org/boomilever-c", true),
      linkedResource("MIT OpenCourseWare: Solid Mechanics", "Guide", "Statics", "Pro", "University notes and problems on equilibrium, forces, stress, strain, and structural behavior.", "https://ocw.mit.edu/courses/1-050-solid-mechanics-fall-2004/"),
      linkedResource("USDA Wood Handbook", "Guide", "Wood properties", "All-Star", "Authoritative reference on wood structure, mechanical properties, adhesives, and failure.", "https://www.fpl.fs.usda.gov/documnts/fplgtr/fplgtr282/fpl_gtr282.pdf"),
    ]
  }),
  eventHub({
    name: "Botany",
    slug: "botany",
    category: "Study",
    tagline: "Plant anatomy, physiology, diversity, reproduction, and ecology.",
    description: "Build a functional understanding of plants from cells and tissues to life cycles, classification, environmental responses, and field identification.",
    starterPath: [
      "Learn plant cells, tissues, organs, and the jobs they perform.",
      "Trace water, minerals, sugars, hormones, photosynthesis, and reproduction.",
      "Use real specimens and reputable identification tools instead of image-only memorization."
    ],
    topics: ["Plant anatomy", "Plant physiology", "Reproduction", "Taxonomy", "Plant diversity", "Ecology"],
    resources: [
      linkedResource("Official 2027 Division C event list", "Rules", "Taxonomy", "Rookie", "Science Olympiad's current 2027 slate and entry point for official event materials.", "https://www.soinc.org/events/2027-division-c-events", true),
      linkedResource("OpenStax: Plant Form and Physiology", "Guide", "Plant physiology", "Rookie", "Free chapters on plant structure, transport, nutrition, reproduction, and responses.", "https://openstax.org/books/biology-2e/pages/30-introduction"),
      linkedResource("USDA PLANTS Database", "Guide", "Taxonomy", "Pro", "Authoritative names, classifications, distributions, images, and plant profiles for the United States.", "https://plants.sc.egov.usda.gov/home"),
      linkedResource("Kew: Plants of the World Online", "Guide", "Plant diversity", "All-Star", "Taxonomic and distribution data from the Royal Botanic Gardens, Kew.", "https://powo.science.kew.org/")
    ]
  }),
  eventHub({
    name: "Chemistry Lab",
    slug: "chemistry-lab",
    category: "Lab",
    tagline: "Kinetics and gases with quantitative laboratory work.",
    description: "Combine collision theory and gas behavior with safe lab technique, graphing, dimensional analysis, uncertainty, and defensible conclusions.",
    starterPath: [
      "Master gas variables, kinetic molecular theory, rate laws, and integrated graphs.",
      "Practice accurate mass, volume, pressure, temperature, and time measurements.",
      "Show units and uncertainty through every calculation and graph."
    ],
    topics: ["Gas laws", "Kinetic molecular theory", "Reaction rates", "Rate laws", "Lab technique", "Data analysis"],
    resources: [
      linkedResource("Official Science Olympiad event hub", "Rules", "Lab technique", "Rookie", "Official scope, permitted equipment, safety expectations, and event resources.", "https://www.soinc.org/chemistry-lab-c-0", true),
      linkedResource("OpenStax Chemistry 2e: Gases", "Guide", "Gas laws", "Rookie", "Free textbook coverage of pressure, gas laws, mixtures, kinetic theory, and non-ideal behavior.", "https://openstax.org/books/chemistry-2e/pages/9-introduction"),
      linkedResource("OpenStax Chemistry 2e: Kinetics", "Guide", "Reaction rates", "Pro", "Rate laws, integrated rate laws, mechanisms, collision theory, and catalysis.", "https://openstax.org/books/chemistry-2e/pages/12-introduction"),
      linkedResource("PhET: Gas Properties", "Guide", "Kinetic molecular theory", "Rookie", "Interactive particle-level model for pressure, volume, temperature, and molecular motion.", "https://phet.colorado.edu/en/simulations/gas-properties")
    ]
  }),
  eventHub({
    name: "Circuit Lab",
    slug: "circuit-lab",
    category: "Lab",
    tagline: "Electrical principles, measurements, and circuit analysis.",
    description: "Move between diagrams, calculations, meter readings, and hands-on circuits while understanding why components behave as they do.",
    starterPath: [
      "Learn voltage, current, resistance, power, and energy before memorizing shortcuts.",
      "Build and measure series and parallel circuits while predicting each reading first.",
      "Practice reading component markings, schematics, and meter settings under time pressure."
    ],
    topics: ["DC circuits", "Ohm's law", "Kirchhoff's laws", "Components", "Measurement", "Digital logic", "Semiconductors"],
    resources: [
      linkedResource("Official Science Olympiad event hub", "Rules", "Components", "Rookie", "Official event scope, device rules, updates, and supporting resources.", "https://www.soinc.org/circuit-lab-c", true),
      linkedResource("PhET: Circuit Construction Kit DC", "Guide", "DC circuits", "Rookie", "Build, measure, and troubleshoot virtual DC circuits with batteries, resistors, bulbs, and meters.", "https://phet.colorado.edu/sims/html/circuit-construction-kit-dc-virtual-lab/latest/circuit-construction-kit-dc-virtual-lab_en.html"),
      linkedResource("OpenStax Physics: Electric Current and DC Circuits", "Guide", "Kirchhoff's laws", "Pro", "Free chapters and problems on current, resistance, circuits, Kirchhoff's rules, and power.", "https://openstax.org/books/physics/pages/19-introduction"),
      linkedResource("All About Circuits: Digital Circuits", "Guide", "Digital logic", "Pro", "A structured open textbook covering Boolean algebra, logic gates, combinational logic, and sequential circuits.", "https://www.allaboutcircuits.com/textbook/digital/"),
      linkedResource("MIT OpenCourseWare: Circuits and Electronics", "Guide", "Measurement", "All-Star", "Lectures, labs, problems, and exams spanning circuit models, components, transistors, and op-amps.", "https://ocw.mit.edu/courses/6-002-circuits-and-electronics-spring-2007/")
    ]
  }),
  eventHub({
    name: "Codebusters",
    slug: "codebusters",
    category: "Study",
    tagline: "Timed cryptanalysis across the ciphers named in the rules.",
    description: "Develop recognition, division of labor, and reliable solving methods for classical ciphers instead of relying on blind trial and error.",
    starterPath: [
      "Learn to identify each allowed cipher from its structure and clues.",
      "Assign team roles and drill the common ciphers until setup is automatic.",
      "Use timed mixed sets, then review the exact step where each solve stalled."
    ],
    topics: ["Substitution ciphers", "Transposition ciphers", "Polyalphabetic ciphers", "Cryptanalysis", "Modular arithmetic", "Team strategy"],
    resources: [
      linkedResource("Official Science Olympiad event hub", "Rules", "Team strategy", "Rookie", "Official cipher list, scoring details, examples, and event resources.", "https://www.soinc.org/codebusters-c", true),
      linkedResource("American Cryptogram Association resources", "Guide", "Cryptanalysis", "Rookie", "Reference material and solving guidance from an organization devoted to classical cryptography.", "https://www.cryptogram.org/resource-area/"),
      linkedResource("CrypTool Online", "Guide", "Substitution ciphers", "Pro", "Interactive implementations and explanations for exploring classical and modern cryptographic methods.", "https://www.cryptool.org/en/cto/"),
      linkedResource("Khan Academy: Modular arithmetic", "Guide", "Modular arithmetic", "Pro", "Focused practice for the arithmetic behind affine, Hill, and other mathematical ciphers.", "https://www.khanacademy.org/computing/computer-science/cryptography/modarithmetic")
    ]
  }),
  eventHub({
    name: "Code Craze",
    slug: "code-craze",
    category: "Hybrid",
    isTrial: true,
    tagline: "Featured trial: coding, Python, AI, cryptography, and computational thinking.",
    description: "This is a featured trial rather than one of the 23 scored national events. Use the tournament schedule to confirm whether it will run locally, then prepare with executable coding practice.",
    starterPath: [
      "Confirm that your invitational, regional, or state tournament offers the trial.",
      "Complete the CodeHS Science Olympiad modules and write every example yourself.",
      "Practice short Python tasks without autocomplete, then review AI and cryptography concepts."
    ],
    topics: ["Python", "Algorithms", "Data structures", "AI and machine learning", "Cryptography", "Quantum computing"],
    resources: [
      linkedResource("Science Olympiad featured trial description", "Rules", "Algorithms", "Rookie", "Official description of Code Craze; the page may still display the prior season while 2027 trial materials are prepared.", "https://www.soinc.org/learn/trial-events", true),
      linkedResource("CodeHS: Science Olympiad Code Craze (HS)", "Guide", "Python", "Rookie", "The currently available course is labeled 2025–26, but its coding, AI, cryptography, Python, and quantum modules are useful foundations while 2027 materials are pending.", "https://codehs.com/course/ScienceOlympiadHS/overview"),
      linkedResource("Official Python tutorial", "Guide", "Data structures", "Pro", "The Python documentation's tutorial for control flow, functions, collections, modules, and errors.", "https://docs.python.org/3/tutorial/"),
      linkedResource("Google Machine Learning Crash Course", "Guide", "AI and machine learning", "Pro", "Interactive lessons explaining models, classification, data, bias, and responsible ML.", "https://developers.google.com/machine-learning/crash-course?hl=en")
    ]
  }),
  eventHub({
    name: "Designer Genes",
    slug: "designer-genes",
    category: "Study",
    tagline: "Molecular, Mendelian, population, and evolutionary genetics.",
    description: "Work from DNA structure and gene expression through inheritance, pedigrees, population genetics, biotechnology, and experimental interpretation.",
    starterPath: [
      "Make transcription, translation, replication, and gene regulation mechanistic—not vocabulary lists.",
      "Drill inheritance and pedigree problems with clear probability reasoning.",
      "Interpret real experimental figures and connect biotech tools to their outputs."
    ],
    topics: ["Molecular genetics", "Inheritance", "Gene regulation", "Population genetics", "Biotechnology", "Data interpretation"],
    resources: [
      linkedResource("Official Science Olympiad event hub", "Rules", "Data interpretation", "Rookie", "Official scope, corrections, and event-specific supporting materials.", "https://www.soinc.org/designer-genes-c", true),
      linkedResource("NHGRI genomics education resources", "Guide", "Molecular genetics", "Rookie", "Accurate lessons and explainers for DNA, sequencing, variation, inheritance, and genomic medicine.", "https://www.genome.gov/about-genomics/educational-resources"),
      linkedResource("Learn.Genetics", "Guide", "Inheritance", "Rookie", "Interactive genetics and molecular-biology modules from the University of Utah.", "https://learn.genetics.utah.edu/"),
      linkedResource("UC Berkeley: Understanding Evolution", "Guide", "Population genetics", "Pro", "Evidence-based explanations of selection, variation, population change, phylogeny, and evolutionary mechanisms.", "https://evolution.berkeley.edu/")
    ]
  }),
  eventHub({
    name: "Disease Detectives",
    slug: "disease-detectives",
    category: "Study",
    tagline: "Epidemiology, outbreak investigation, and evidence-based public health.",
    description: "Use person-place-time patterns, study design, measures of disease frequency and association, and data quality to reason through outbreaks.",
    starterPath: [
      "Learn the outbreak investigation sequence and build clean epi curves and line lists.",
      "Calculate and interpret incidence, prevalence, attack rates, risk ratios, and odds ratios.",
      "Compare study designs, bias, confounding, and causal claims using real scenarios."
    ],
    topics: ["Outbreak investigation", "Descriptive epidemiology", "Study design", "Measures of association", "Data visualization", "Bias and confounding"],
    resources: [
      linkedResource("Official Science Olympiad event hub", "Rules", "Outbreak investigation", "Rookie", "Official event scope, resources, corrections, and clarifications.", "https://www.soinc.org/disease-detectives-c", true),
      linkedResource("CDC: Principles of Epidemiology", "Guide", "Descriptive epidemiology", "Rookie", "The complete CDC self-study course covering surveillance, study design, measures, and outbreak investigation.", "https://stacks.cdc.gov/view/cdc/6914/cdc_6914_DS1.pdf"),
      linkedResource("CDC NERD Academy outbreak investigations", "Guide", "Outbreak investigation", "Rookie", "Interactive, case-based modules for investigating outbreaks and communicating public-health evidence.", "https://www.cdc.gov/nerd-academy/outbreak-investigations/index.html"),
      linkedResource("CDC Field Epidemiology Manual", "Guide", "Study design", "Pro", "Operational guidance and case-based chapters for investigating health events in the field.", "https://www.cdc.gov/field-epi-manual/php/chapters/index.html")
    ]
  }),
  eventHub({
    name: "Dynamic Planet",
    slug: "dynamic-planet",
    category: "Study",
    tagline: "Earth's fresh waters: movement, landforms, systems, and human impacts.",
    description: "Connect the hydrologic cycle to rivers, groundwater, lakes, wetlands, erosion, deposition, water budgets, hazards, and management.",
    starterPath: [
      "Draw complete water budgets and trace water through surface and groundwater reservoirs.",
      "Connect stream processes to channel shape, sediment, floodplains, and landforms.",
      "Practice reading hydrographs, maps, cross-sections, and groundwater diagrams."
    ],
    topics: ["Hydrologic cycle", "Rivers and streams", "Groundwater", "Lakes and wetlands", "Erosion and deposition", "Human impacts"],
    resources: [
      linkedResource("Official Science Olympiad event hub", "Rules", "Hydrologic cycle", "Rookie", "Official 2027 topic scope, event updates, and Science Olympiad resources.", "https://www.soinc.org/dynamic-planet-c", true),
      linkedResource("USGS Water Science School", "Guide", "Groundwater", "Rookie", "Authoritative explainers, diagrams, data, and activities across the water cycle and freshwater systems.", "https://www.usgs.gov/water-science-school"),
      linkedResource("EPA Watershed Academy", "Guide", "Human impacts", "Pro", "Training modules on watershed processes, monitoring, restoration, and management.", "https://www.epa.gov/watershedacademy"),
      linkedResource("USGS: Freshwater Lakes and Rivers", "Guide", "Rivers and streams", "Pro", "Explains freshwater storage, movement, lakes, rivers, runoff, and their place in the water cycle.", "https://www.usgs.gov/water-science-school/science/freshwater-lakes-and-rivers-and-water-cycle")
    ]
  }),
  eventHub({
    name: "Electric Vehicle",
    slug: "electric-vehicle",
    category: "Build",
    tagline: "A programmable motor vehicle tuned to a target time and stop position.",
    description: "Move the required bottle while hitting the announced time and target as closely as possible through rules-compliant construction, motor control, alignment, braking, calibration, and disciplined run data.",
    starterPath: [
      "Choose a simple, serviceable drivetrain and make the chassis roll straight with power off.",
      "Measure how voltage, load, wheel size, and gear ratio change speed and stopping behavior.",
      "Build a calibration table from repeated runs on tournament-like flooring."
    ],
    topics: ["DC motors", "Circuits", "Gearing", "Traction and alignment", "Braking", "Calibration"],
    resources: [
      linkedResource("Official Science Olympiad event hub", "Rules", "Calibration", "Rookie", "Official dimensions, scoring, impound requirements, and event updates.", "https://www.soinc.org/electric-vehicle-c", true),
      linkedResource("PhET: Circuit Construction Kit DC", "Guide", "Circuits", "Rookie", "Interactive circuit testing for voltage, current, resistance, and component behavior.", "https://phet.colorado.edu/sims/html/circuit-construction-kit-dc-virtual-lab/latest/circuit-construction-kit-dc-virtual-lab_en.html"),
      linkedResource("SparkFun: Motors and Selecting the Right One", "Guide", "DC motors", "Pro", "Practical explanations of torque, speed, current, motor types, and drivetrain tradeoffs.", "https://learn.sparkfun.com/tutorials/motors-and-selecting-the-right-one/all"),
      linkedResource("SparkFun RedBot Experiment Guide", "Guide", "Calibration", "Pro", "Hands-on encoder, motor-control, straight-line, and repeatable-distance experiments that transfer directly to vehicle calibration.", "https://learn.sparkfun.com/tutorials/experiment-guide-for-redbot-with-shadow-chassis/all")
    ]
  }),
  eventHub({
    name: "Engineering CAD",
    slug: "engineering-cad",
    category: "Hybrid",
    tagline: "Timed parametric part and assembly modeling from supplied drawings.",
    description: "Read the provided engineering drawings, then collaborate in Onshape to create accurate, editable parts and an assembly whose volume and center of mass match the target.",
    starterPath: [
      "Finish the Onshape fundamentals for sketches, parts, assemblies, and collaboration.",
      "Rebuild simple objects from supplied dimensioned views without copying a tutorial.",
      "Run timed assembly tasks and verify constraints, feature history, part volume, and center of mass."
    ],
    topics: ["Reading drawings", "Sketch constraints", "Part modeling", "Assemblies", "Volume and center of mass", "Timed workflow"],
    resources: [
      linkedResource("Official Science Olympiad event hub", "Rules", "Timed workflow", "Rookie", "Official event format, required platform details, and supporting resources.", "https://www.soinc.org/engineering-cad-c", true),
      linkedResource("Onshape courses and curriculum", "Guide", "Part modeling", "Rookie", "Structured, browser-based lessons for parametric modeling, assemblies, and drawings.", "https://www.onshape.com/en/education/courses-curriculum"),
      linkedResource("Onshape Fundamentals: CAD", "Guide", "Assemblies", "Pro", "Official lessons for sketches, parts, assemblies, drawings, collaboration, and version control.", "https://learn.onshape.com/collections/onshape-fundamentals-cad")
    ]
  }),
  eventHub({
    name: "Experimental Design",
    slug: "experimental-design",
    category: "Lab",
    tagline: "Fast, controlled experimentation and complete scientific reporting.",
    description: "Design and run a defensible experiment from unfamiliar materials, then communicate variables, data, statistics, uncertainty, and conclusions against the official checklist.",
    starterPath: [
      "Learn the official checklist so no report section is accidentally omitted.",
      "Practice turning broad observations into measurable variables and controlled procedures.",
      "Run short timed trials, graph the data, and critique conclusions against the evidence."
    ],
    topics: ["Variables and controls", "Hypotheses", "Procedure", "Measurement", "Statistics and graphs", "Error analysis"],
    resources: [
      linkedResource("Official Science Olympiad event hub", "Rules", "Procedure", "Rookie", "Official rubric/checklist, event expectations, and supporting resources.", "https://www.soinc.org/experimental-design-c", true),
      linkedResource("NIST: Process Models and Experimental Design", "Guide", "Variables and controls", "Pro", "Authoritative introduction to experimental objectives, designs, randomization, and analysis.", "https://www.itl.nist.gov/div898/handbook/pri/section1/pri11.htm"),
      linkedResource("NIST/SEMATECH e-Handbook of Statistical Methods", "Guide", "Statistics and graphs", "All-Star", "Practical reference for measurement, plots, uncertainty, regression, and experimental design.", "https://www.itl.nist.gov/div898/handbook/"),
      linkedResource("Penn State STAT 503: Design of Experiments", "Guide", "Error analysis", "All-Star", "Open course notes on experimental design, randomization, blocking, factorial designs, and analysis.", "https://online.stat.psu.edu/statprogram/stat503")
    ]
  }),
  eventHub({
    name: "Forensics",
    slug: "forensics",
    category: "Lab",
    tagline: "Evidence analysis through chemistry, microscopy, and careful comparison.",
    description: "Identify and compare unknown materials with controlled tests, documented observations, sound chemistry, and conclusions that do not overstate the evidence.",
    starterPath: [
      "Build reference observations from known powders, polymers, fibers, hair, and chromatograms.",
      "Practice safe, contamination-aware lab technique and record results before interpreting them.",
      "Use multiple independent observations to support or exclude a match."
    ],
    topics: ["Unknown powders", "Polymers", "Fibers and hair", "Chromatography", "Fingerprints", "Evidence interpretation"],
    resources: [
      linkedResource("Official Science Olympiad event hub", "Rules", "Unknown powders", "Rookie", "Official substance list, permitted tests, safety rules, and event resources.", "https://www.soinc.org/forensics-c", true),
      linkedResource("NIST Forensic Science", "Guide", "Evidence interpretation", "Pro", "Standards, research, terminology, and measurement science across forensic disciplines.", "https://www.nist.gov/forensic-science"),
      linkedResource("NIST Chemistry WebBook", "Guide", "Chromatography", "Pro", "Reference mass spectra, gas chromatography data, and chemical properties for identifying unknown compounds.", "https://webbook.nist.gov/"),
      linkedResource("FBI Handbook of Forensic Services", "Guide", "Fibers and hair", "All-Star", "Laboratory capabilities, evidence requirements, and limitations across forensic examinations.", "https://www.fbi.gov/file-repository/laboratory/handbook-of-forensic-services-pdf.pdf"),
      linkedResource("The Fingerprint Sourcebook", "Guide", "Fingerprints", "Pro", "A comprehensive NIJ reference on friction-ridge anatomy, development, comparison, and the limits of fingerprint evidence.", "https://www.ojp.gov/library/publications/fingerprint-sourcebook")
    ]
  }),
  eventHub({
    name: "Hovercraft",
    slug: "hovercraft",
    category: "Build",
    tagline: "A self-propelled air-cushion vehicle tuned for time, distance, and carried mass.",
    description: "Build a rules-compliant hovercraft that carries the required nickel load, then tune lift, thrust, friction, power, straight-line travel, time, and stopping distance from measured runs.",
    starterPath: [
      "Separate lift and thrust problems, then test each simple mechanical and electrical system independently.",
      "Measure payload mass, airflow, voltage, current, travel time, and distance instead of tuning by feel.",
      "Use repeated loaded runs to quantify drift, stopping error, and battery effects."
    ],
    topics: ["Forces and motion", "Air pressure", "Friction", "Motors and power", "Payload", "Calibration"],
    resources: [
      linkedResource("Official Science Olympiad event hub", "Rules", "Calibration", "Rookie", "Official construction limits, competition procedure, scoring, and study scope.", "https://www.soinc.org/hovercraft-c", true),
      linkedResource("NASA/JPL hovercraft build activity", "Guide", "Air pressure", "Rookie", "Hands-on JPL activity connecting hovercraft construction to air pressure, friction, forces, and testing.", "https://www.jpl.nasa.gov/edu/pdfs/hovercraft.pdf"),
      linkedResource("NASA: Newton's Laws of Motion", "Guide", "Forces and motion", "Rookie", "Clear explanations of inertia, force, acceleration, and action-reaction for analyzing vehicle motion.", "https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/newtons-laws-of-motion/"),
    ]
  }),
  eventHub({
    name: "Mission Possible",
    slug: "mission-possible",
    category: "Build",
    tagline: "A reliable timed chain of energy transfers and required actions.",
    description: "Engineer a device whose actions are visible, repeatable, resettable, and easy to diagnose while applying mechanics, electricity, waves, fluids, and thermodynamics.",
    starterPath: [
      "Prototype each scored action as an independent module before connecting the chain.",
      "Document the energy input, output, trigger condition, and reset steps for every action.",
      "Run full trials on video and fix the earliest unreliable transition first."
    ],
    topics: ["Energy transfers", "Simple machines", "Electricity", "Fluids", "Timing and reliability", "System integration"],
    resources: [
      linkedResource("Official Science Olympiad event hub", "Rules", "System integration", "Rookie", "Official page reserved for 2027 materials; check it for required actions, scoring, and updates.", "https://www.soinc.org/mission-possible-c", true),
      linkedResource("NASA: Simple Machines", "Guide", "Simple machines", "Rookie", "Concise explanations and activities for the six simple machines and mechanical advantage.", "https://www.grc.nasa.gov/www/k-12/Summer_Training/KaeAvenueES/Simple_Machine_Web.html"),
      linkedResource("NASA/JPL: On Target", "Guide", "System integration", "Pro", "Engineering-design lesson emphasizing constraints, iteration, measurement, and reliable delivery of an action.", "https://www.jpl.nasa.gov/edu/resources/lesson-plan/on-target/")
    ]
  }),
  eventHub({
    name: "Ping-Pong Parachute",
    slug: "ping-pong-parachute",
    category: "Build",
    tagline: "Bottle-rocket flight followed by a long, stable parachute descent.",
    description: "Balance launch energy, rocket stability, mass, deployment reliability, canopy design, and test data while staying inside the final construction and safety rules.",
    starterPath: [
      "Read the safety and construction rules before cutting or pressurizing any component.",
      "Make the rocket stable and deployment reliable before optimizing hang time.",
      "Log pressure, water volume, mass, weather, peak flight, deployment, and descent time."
    ],
    topics: ["Rocket stability", "Pressure and thrust", "Aerodynamic drag", "Parachute design", "Deployment", "Flight testing"],
    resources: [
      linkedResource("Official Science Olympiad event hub", "Rules", "Deployment", "Rookie", "Official page for safety, construction, launch, scoring, and 2027 updates; it may show an archive notice until the new materials publish.", "https://www.soinc.org/ping-pong-parachute-c", true),
      linkedResource("NASA Beginner's Guide to Rockets", "Guide", "Rocket stability", "Rookie", "Authoritative lessons on rocket forces, stability, propulsion, flight, and performance.", "https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/guide-to-rockets/"),
      linkedResource("NASA/JPL: Parachute Design", "Guide", "Parachute design", "Rookie", "Engineering lesson for canopy variables, drag, payload, testing, and evidence-based redesign.", "https://www.jpl.nasa.gov/edu/resources/lesson-plan/parachute-design/"),
      linkedResource("NASA: Conditions for Rocket Stability", "Guide", "Rocket stability", "Pro", "Explains center of gravity, center of pressure, restoring moments, and stable rocket flight.", "https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/conditions-for-rocket-stability/"),
    ]
  }),
  eventHub({
    name: "Protein Modeling",
    slug: "protein-modeling",
    category: "Hybrid",
    tagline: "Protein structure, function, and evidence centered on the annual target.",
    description: "Model the 2009 H1N1 hemagglutinin sialic-acid binding site from PDB 3UBE, use molecular visualization deliberately, and explain how structural features support influenza receptor binding.",
    starterPath: [
      "Review amino-acid chemistry and the hierarchy of protein structure.",
      "Open the assigned PDB structure and identify chains, ligands, secondary structure, and key residues.",
      "Practice explaining how each modeled feature supports a functional claim."
    ],
    topics: ["Amino acids", "Protein structure", "Molecular visualization", "Structure-function", "PDB data", "Model construction"],
    resources: [
      linkedResource("Official Science Olympiad event hub", "Rules", "Model construction", "Rookie", "Official target, modeling requirements, scoring, and Science Olympiad resources.", "https://www.soinc.org/protein-modeling-c", true),
      linkedResource("RCSB PDB: 3UBE", "Guide", "PDB data", "Pro", "Interactive structure page, sequence, annotations, ligands, and experimental data for the draft target structure.", "https://www.rcsb.org/structure/3UBE"),
      linkedResource("Jmol molecular viewer", "Guide", "Molecular visualization", "Pro", "Official open-source viewer and documentation for inspecting structures, selecting residues, and creating molecular views.", "https://jmol.sourceforge.net/"),
      linkedResource("PDB-101", "Guide", "Protein structure", "Rookie", "Accessible structure-function articles, molecular stories, and visualization tools from RCSB PDB.", "https://pdb101.rcsb.org/")
    ]
  }),
  eventHub({
    name: "Remote Sensing",
    slug: "remote-sensing",
    category: "Study",
    tagline: "Satellite observations, image interpretation, and climate change.",
    description: "Understand how sensors record electromagnetic energy, then extract physical meaning from imagery, spectral data, maps, and climate records.",
    starterPath: [
      "Learn the electromagnetic spectrum, resolution types, orbits, and active versus passive sensors.",
      "Interpret true-color, false-color, thermal, radar, and change-detection imagery.",
      "Connect observed patterns to climate processes without confusing correlation and mechanism."
    ],
    topics: ["Electromagnetic spectrum", "Sensors and platforms", "Image interpretation", "Spatial resolution", "Climate change", "GIS and data"],
    resources: [
      linkedResource("Official Science Olympiad event hub", "Rules", "Image interpretation", "Rookie", "Official scope, image sets, corrections, and event resources.", "https://www.soinc.org/remote-sensing-c", true),
      linkedResource("NASA ARSET: Fundamentals of Remote Sensing", "Guide", "Sensors and platforms", "Rookie", "NASA training on radiation, sensors, satellites, resolution, data products, and interpretation.", "https://appliedsciences.nasa.gov/sites/default/files/2022-11/Fundamentals_of_RS_Edited_SC.pdf"),
      linkedResource("NASA Earth Observatory: Remote Sensing", "Guide", "Electromagnetic spectrum", "Rookie", "Primer on electromagnetic energy, passive and active sensors, resolution, and observing Earth from space.", "https://science.nasa.gov/earth/earth-observatory/remote-sensing/"),
      linkedResource("NASA Global Climate Change", "Guide", "Climate change", "Pro", "Evidence, causes, effects, vital signs, and current datasets from NASA climate scientists.", "https://science.nasa.gov/climate-change/")
    ]
  }),
  eventHub({
    name: "Rocks and Minerals",
    slug: "rocks-and-minerals",
    category: "Study",
    tagline: "Identification, properties, origins, and uses from the official list.",
    description: "Identify specimens from observable properties, then connect minerals and rocks to composition, formation, geologic setting, and economic use.",
    starterPath: [
      "Learn the diagnostic tests and perform them consistently on known specimens.",
      "Organize the official list by composition, texture, formation, and look-alikes.",
      "Practice stations with unlabeled samples, limited tests, and a strict time budget."
    ],
    topics: ["Mineral properties", "Mineral identification", "Igneous rocks", "Sedimentary rocks", "Metamorphic rocks", "Economic geology"],
    resources: [
      linkedResource("Official Science Olympiad event hub", "Rules", "Mineral identification", "Rookie", "Official specimen list, permitted resources, scope, and supporting materials.", "https://www.soinc.org/rocks-and-minerals-c", true),
      linkedResource("Smithsonian GeoGallery", "Guide", "Mineral identification", "Rookie", "High-quality mineral and gem images with locality, composition, and specimen information.", "https://naturalhistory.si.edu/explore/geology-gems-minerals/geogallery"),
      linkedResource("USGS geology and minerals education", "Guide", "Economic geology", "Rookie", "Geologic background, mineral resources, maps, and educational material from the U.S. Geological Survey.", "https://www.usgs.gov/mission-areas/geology-energy-minerals/science/education"),
      linkedResource("Mineral Properties and Identification", "Guide", "Mineral properties", "Rookie", "An open, lab-oriented guide to luster, hardness, streak, cleavage, fracture, density, and systematic mineral identification.", "https://geo.libretexts.org/Bookshelves/Geology/Historical_Geology_%28Bentley_et_al.%29/56%253A_%28Tools_of_the_Trade%29_Earth_Materials_-_Mineral_identification/56.01%253A_Mineral_Properties_and_Identification")
    ]
  }),
  eventHub({
    name: "Thermodynamics",
    slug: "thermodynamics",
    category: "Hybrid",
    tagline: "Thermal physics, prediction, and a lamp-heated water device.",
    description: "Connect microscopic models, heat transfer, phase behavior, calorimetry, and thermodynamic laws to a device that heats 100 mL of water and to a defensible final-temperature prediction.",
    starterPath: [
      "Master temperature, heat, specific heat, phase change, and all three heat-transfer modes.",
      "Solve with units and signs before relying on a formula sheet.",
      "Test the full device with repeatable water volume, lamp geometry, initial temperature, heating time, and room conditions."
    ],
    topics: ["Heat transfer", "Calorimetry", "Kinetic theory", "Thermodynamic laws", "Phase changes", "Device testing"],
    resources: [
      linkedResource("Official Science Olympiad event hub", "Rules", "Device testing", "Rookie", "Official build constraints, test procedure, scoring, corrections, and study resources.", "https://www.soinc.org/thermodynamics-c", true),
      linkedResource("OpenStax University Physics: Thermodynamics", "Guide", "Thermodynamic laws", "Rookie", "Free chapters on temperature, heat, kinetic theory, thermodynamic processes, engines, and entropy.", "https://openstax.org/books/university-physics-volume-2/pages/1-introduction"),
      linkedResource("OpenStax University Physics: First Law", "Guide", "Calorimetry", "Pro", "Thermodynamic systems, work, heat, internal energy, processes, and the first law.", "https://openstax.org/books/university-physics-volume-2/pages/3-introduction"),
      linkedResource("PhET: Gas Properties", "Guide", "Kinetic theory", "Rookie", "Interactive particle model for pressure, temperature, volume, collisions, and state changes.", "https://phet.colorado.edu/en/simulations/gas-properties"),
      linkedResource("NASA/JPL: Feel the Heat", "Guide", "Device testing", "Rookie", "A lamp-heated solar-collector investigation built around controlled variables, temperature data, and evidence-based redesign.", "https://www.jpl.nasa.gov/edu/resources/lesson-plan/feel-the-heat/")
    ]
  }),
  eventHub({
    name: "Water Quality",
    slug: "water-quality",
    category: "Study",
    tagline: "Marine and estuary ecology, chemistry, monitoring, and management.",
    description: "Connect estuary and marine systems to water-quality parameters, coral-reef organisms, pollution, harmful algal blooms, monitoring, management, and the required salinometer or hydrometer build.",
    starterPath: [
      "Map estuary circulation, salinity gradients, habitats, food webs, and ecosystem services.",
      "Learn what each water-quality parameter measures, how it changes, and why it matters biologically.",
      "Interpret monitoring tables and graphs, then build and calibrate the required salinity-measuring device."
    ],
    topics: ["Estuaries", "Marine ecology", "Water chemistry", "Water-quality indicators", "Pollution", "Salinometer or hydrometer", "Monitoring and management"],
    resources: [
      linkedResource("Official Science Olympiad event hub", "Rules", "Water-quality indicators", "Rookie", "Official 2027 scope, organism lists, event updates, and supporting resources.", "https://www.soinc.org/water-quality-c", true),
      linkedResource("NOAA Estuary Tutorial", "Guide", "Estuaries", "Rookie", "A complete introduction to estuary formation, circulation, habitats, ecology, research, and human impacts.", "https://oceanservice.noaa.gov/education/tutorial_estuaries/"),
      linkedResource("EPA Water Quality Parameter Factsheets", "Guide", "Water chemistry", "Rookie", "Clear factsheets for dissolved oxygen, pH, nutrients, temperature, turbidity, and other monitoring parameters.", "https://www.epa.gov/awma/factsheets-water-quality-parameters"),
      linkedResource("NOAA Estuary Science and Data", "Guide", "Monitoring and management", "Pro", "Lessons, data, and explanations for estuary processes, habitats, monitoring, and conservation.", "https://coast.noaa.gov/estuaries/science-data/")
    ]
  }),
  eventHub({
    name: "Wright Stuff",
    slug: "wright-stuff",
    category: "Build",
    tagline: "Indoor rubber-powered flight optimized for duration and reliability.",
    description: "Build a light, rules-compliant aircraft and tune thrust, lift, drag, stability, trim, and flight path through controlled indoor testing.",
    starterPath: [
      "Learn the final configuration and measurement rules before choosing a design.",
      "Build straight and light, then establish a safe repeatable glide and powered circle.",
      "Log winds, torque, turns, launch settings, circle size, altitude, duration, and damage every flight."
    ],
    topics: ["Lift and drag", "Stability and trim", "Rubber power", "Propellers", "Construction", "Flight testing"],
    resources: [
      linkedResource("Official Science Olympiad event hub", "Rules", "Construction", "Rookie", "Official aircraft dimensions, bonus configuration, scoring, and 2027 updates; it may show archived content until new materials publish.", "https://www.soinc.org/wright-stuff-c", true),
      linkedResource("National Free Flight Society: Science Olympiad", "Guide", "Flight testing", "Rookie", "Event-specific indoor free-flight articles, videos, plans, and experienced-builder guidance.", "https://www.freeflight.org/science-olympiad/"),
      linkedResource("NASA Beginner's Guide to Aeronautics", "Guide", "Lift and drag", "Rookie", "Authoritative explanations of aerodynamic forces, airfoils, stability, performance, and propulsion.", "https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/"),
      linkedResource("NASA: Propellers", "Guide", "Propellers", "Pro", "Explains how propellers generate thrust and how geometry, speed, and airflow affect performance.", "https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/propellers/")
    ]
  })
];

export function getSciolyEvent(slug: string) {
  return sciolyEvents.find((event) => event.slug === slug);
}

export function getResourceStats(events: SciolyEventHub[] = sciolyEvents) {
  const resources = events.flatMap((event) => event.resources);
  const questions = events.flatMap((event) => event.questions);
  const tests = events.flatMap((event) => event.tests);
  const seasonEvents = events.filter((event) => event.season === 2027);
  const trials = seasonEvents.filter((event) => event.isTrial).length;

  return {
    events: events.length,
    scoredEvents: seasonEvents.length - trials,
    trials,
    teamLibraries: events.length - seasonEvents.length,
    resources: resources.length,
    questions: questions.length,
    tests: tests.length,
    averageCoverage: Math.round(
      events.reduce((total, event) => total + event.coverageScore, 0) / Math.max(1, events.length)
    )
  };
}

export function getFeaturedResources(events: SciolyEventHub[] = sciolyEvents) {
  return events.flatMap((event) =>
    event.resources
      .filter((resource) => resource.recommended && resource.managed)
      .map((resource) => ({ ...resource, eventName: event.name, eventSlug: event.slug }))
  );
}

export function getAllPracticeQuestions(events: SciolyEventHub[] = sciolyEvents) {
  return events.flatMap((event) =>
    event.questions.map((question) => ({ ...question, eventName: event.name, eventSlug: event.slug }))
  );
}

export function getAllPracticeTests(events: SciolyEventHub[] = sciolyEvents) {
  return events.flatMap((event) =>
    event.tests.map((test) => ({ ...test, eventName: event.name, eventSlug: event.slug }))
  );
}

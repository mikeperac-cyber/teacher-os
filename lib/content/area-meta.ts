/**
 * Area header copy.
 *
 * This is authored product copy, not demo data, so it survives the data
 * erasure. What was removed is the statistics block that used to sit beside it
 * — figures like "Active 18", "IELTS 7", "Avg. mastery 76%" were literals that
 * contradicted each other and each other's record counts. Header statistics are
 * now derived from queries.
 *
 * Two dated eyebrows were also neutralised: they read "Sunday · 9 August",
 * pinned to the export date. The current date is computed at render time.
 *
 * Resolution order: a track-specific entry wins; otherwise the shared entry is
 * used. An area with neither is not addressable in that track.
 */

import type { Area, AreaMeta, Track } from "@/lib/types/ui";

type SharedArea = Exclude<
  Area,
  "Dashboard" | "Language Skills" | "Writing Tracker" | "Speaking Tracker"
>;

/** Copy used when a track has no override. */
export const sharedAreaMeta: Record<SharedArea, AreaMeta> = {
  Today: {
    eyebrow: "Today",
    title: "Your teaching day",
    description:
      "A calm, chronological view of every class, check-in, preparation block and follow-up.",
  },
  Students: {
    eyebrow: "Student directory",
    title: "Every learner, fully in context",
    description:
      "Profiles, goals, availability, attendance, homework and progress in one reliable record.",
  },
  Lessons: {
    eyebrow: "Lesson records",
    title: "Plan, teach and remember",
    description:
      "A complete history of delivered lessons, notes, objectives, attendance and next steps.",
  },
  "Lesson Planner": {
    eyebrow: "Planning studio",
    title: "Build a strong lesson in minutes",
    description:
      "Start from the learner’s goals, reuse proven materials and leave with a timed lesson flow.",
  },
  Homework: {
    eyebrow: "Homework command center",
    title: "Nothing submitted gets lost",
    description:
      "Track assignments from assigned to submitted, checked, returned and mastered.",
  },
  Assessments: {
    eyebrow: "Evidence of learning",
    title: "Assess consistently and act quickly",
    description:
      "Run mocks, quizzes and skill checks with comparable criteria and clear follow-up actions.",
  },
  "ESL Progress": {
    eyebrow: "CEFR progress",
    title: "See language becoming usable",
    description:
      "Track grammar, vocabulary, fluency, listening, reading and confidence by learner.",
  },
  "IELTS Progress": {
    eyebrow: "Band score tracking",
    title: "Make every 0.5 band visible",
    description:
      "Monitor Listening, Reading, Writing and Speaking against target bands and test dates.",
  },
  Calendar: {
    eyebrow: "Schedule",
    title: "Teaching time, protected",
    description:
      "See lessons, prep, checking and personal commitments without overbooking the week.",
  },
  Tasks: {
    eyebrow: "Action list",
    title: "Do the right work before class",
    description:
      "Prioritized teaching, business and personal tasks with time estimates and focus blocks.",
  },
  Goals: {
    eyebrow: "Quarterly direction",
    title: "Turn intentions into weekly progress",
    description:
      "Connect student outcomes, teaching quality and business growth to concrete work.",
  },
  Projects: {
    eyebrow: "Project workspace",
    title: "Move bigger teaching work forward",
    description:
      "Plan multi-step curriculum, material and business work without mixing it into daily tasks.",
  },
  Reports: {
    eyebrow: "Teaching intelligence",
    title: "Turn records into useful decisions",
    description:
      "Review attendance, progress, workload, homework habits and revenue in clear reports.",
  },
  Materials: {
    eyebrow: "Teaching library",
    title: "Find the right material before the lesson",
    description:
      "Organize worksheets, prompts, slides, audio, rubrics and links by level, skill and topic.",
  },
};

/**
 * Track-specific copy.
 *
 * This is where the two workspaces read as genuinely different products rather
 * than one product with a filter: ESL speaks in CEFR outcomes and communicative
 * performance, IELTS in bands, criteria and test dates.
 */
export const trackAreaMeta: Record<Track, Partial<Record<Area, AreaMeta>>> = {
  ESL: {
    Today: {
      eyebrow: "ESL workspace",
      title: "Today’s ESL teaching",
      description:
        "Only your ESL classes, preparation, checking and learner follow-ups.",
    },
    Students: {
      eyebrow: "ESL learner directory",
      title: "ESL students",
      description:
        "CEFR level, learning goals, language systems, confidence and communicative performance.",
    },
    Lessons: {
      eyebrow: "ESL lesson records",
      title: "ESL lesson history",
      description:
        "Objectives, target language, communicative outcomes and next-step notes for every ESL class.",
    },
    "Lesson Planner": {
      eyebrow: "ESL planning studio",
      title: "Plan a communicative ESL lesson",
      description:
        "Build from CEFR outcomes, target language, controlled practice and meaningful production.",
    },
    Homework: {
      eyebrow: "ESL homework",
      title: "Practice that builds usable English",
      description:
        "Track vocabulary recycling, grammar practice, recordings, reading and real-life production tasks.",
    },
    Assessments: {
      eyebrow: "ESL progress checks",
      title: "Measure CEFR mastery",
      description:
        "Diagnostic checks, unit reviews and communicative performance—not IELTS band scoring.",
    },
    "ESL Progress": {
      eyebrow: "CEFR progress",
      title: "CEFR mastery by learner",
      description:
        "Track grammar, vocabulary, pronunciation, fluency, receptive skills and confidence.",
    },
    "Language Skills": {
      eyebrow: "ESL language systems",
      title: "Track the English students can actually use",
      description:
        "Separate receptive knowledge from spontaneous production across language systems and skills.",
    },
    Reports: {
      eyebrow: "ESL intelligence",
      title: "ESL progress reports",
      description:
        "CEFR movement, unit mastery, confidence, homework habits and attendance for ESL learners only.",
    },
    Materials: {
      eyebrow: "ESL material library",
      title: "ESL materials by CEFR level",
      description:
        "Lessons, cards, worksheets, audio and projects organized by level, age, language focus and theme.",
    },
  },
  IELTS: {
    Today: {
      eyebrow: "IELTS workspace",
      title: "Today’s IELTS teaching",
      description:
        "Only IELTS lessons, marking, timed practice, mocks and candidate follow-ups.",
    },
    Students: {
      eyebrow: "IELTS candidate directory",
      title: "IELTS Academic students",
      description:
        "Current and target bands, skill profiles, test dates, mock results and readiness risk.",
    },
    Lessons: {
      eyebrow: "IELTS lesson records",
      title: "IELTS skill lessons",
      description:
        "Question types, exam strategy, timed performance, band criteria and assigned practice.",
    },
    "Lesson Planner": {
      eyebrow: "IELTS planning studio",
      title: "Plan a score-focused IELTS lesson",
      description:
        "Build from a target band, question type, rubric gap, timed practice and measurable exit score.",
    },
    Homework: {
      eyebrow: "IELTS assignments",
      title: "IELTS practice and marking",
      description:
        "Track timed sections, Writing tasks, Speaking recordings, error logs and targeted drills.",
    },
    Assessments: {
      eyebrow: "IELTS mock center",
      title: "Mock tests and timed sections",
      description:
        "Full mocks, sectional tests, raw scores, band conversion and post-mock intervention plans.",
    },
    "IELTS Progress": {
      eyebrow: "Band score progress",
      title: "Band movement by skill",
      description:
        "Listening, Reading, Writing and Speaking tracked against target bands and official test dates.",
    },
    "Writing Tracker": {
      eyebrow: "IELTS Writing",
      title: "Writing performance by criterion",
      description:
        "Task Achievement/Response, Coherence and Cohesion, Lexical Resource, Grammar and error patterns.",
    },
    "Speaking Tracker": {
      eyebrow: "IELTS Speaking",
      title: "Speaking performance by criterion",
      description:
        "Fluency, lexical resource, grammar, pronunciation and Parts 1–3 performance.",
    },
    Reports: {
      eyebrow: "IELTS intelligence",
      title: "IELTS performance reports",
      description:
        "Band movement, question-type accuracy, rubric gaps, mock trends and test readiness.",
    },
    Materials: {
      eyebrow: "IELTS material library",
      title: "IELTS Academic materials",
      description:
        "Question-type drills, mock sections, band models, rubrics and strategy resources by target band.",
    },
  },
};

/** Resolve header copy for an area within a track. */
export const areaMetaFor = (track: Track, area: Area): AreaMeta | undefined =>
  trackAreaMeta[track][area] ?? sharedAreaMeta[area as SharedArea];

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlignLeft,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  ClipboardCheck,
  Clock3,
  Command,
  FileCheck2,
  FileText,
  Filter,
  Flag,
  FolderKanban,
  Gauge,
  GraduationCap,
  Headphones,
  LayoutDashboard,
  LibraryBig,
  ListTodo,
  MessageSquareText,
  Mic2,
  MoreHorizontal,
  NotebookPen,
  PanelLeftClose,
  PenLine,
  Play,
  Plus,
  Search,
  Sparkles,
  Target,
  TimerReset,
  TrendingUp,
  UserRound,
  Users,
  Video,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";

type Area =
  | "Dashboard"
  | "Today"
  | "Students"
  | "Lessons"
  | "Lesson Planner"
  | "Homework"
  | "Assessments"
  | "ESL Progress"
  | "IELTS Progress"
  | "Language Skills"
  | "Writing Tracker"
  | "Speaking Tracker"
  | "Calendar"
  | "Tasks"
  | "Goals"
  | "Projects"
  | "Reports"
  | "Materials";

type Track = "ESL" | "IELTS";
type NavItem = { name: Area; label: string; icon: React.ElementType; badge?: string };
type NavGroup = { label: string; items: NavItem[] };
type DestinationMode = "detail" | "create" | "notifications" | "profile" | "delivery";
type Announce = (message: string, openPanel?: boolean) => void;
type DestinationPanel = {
  title: string;
  eyebrow: string;
  description: string;
  area: Area;
  mode: DestinationMode;
  facts: Array<[string, string]>;
  related: Area[];
};

const allAreas: Area[] = ["Dashboard","Today","Students","Lessons","Lesson Planner","Homework","Assessments","ESL Progress","IELTS Progress","Language Skills","Writing Tracker","Speaking Tracker","Calendar","Tasks","Goals","Projects","Reports","Materials"];
const areaSlug = (area: Area) => area.toLowerCase().replace(/\s+/g, "-");
const areaFromSlug = (slug: string | null) => allAreas.find((area) => areaSlug(area) === slug);

const destinationCopy: Record<Area, string> = {
  Dashboard: "Review the teaching system, priorities and next actions connected to this item.",
  Today: "See the scheduled time, readiness state and the next action for today.",
  Students: "Open the learner record with goals, attendance, lessons, homework and current priorities.",
  Lessons: "Open the full lesson record, teaching notes, materials and follow-up workflow.",
  "Lesson Planner": "Continue the timed lesson flow, attached materials and pre-class readiness checks.",
  Homework: "Review the submission, feedback status, evidence of mastery and next assignment step.",
  Assessments: "Open the evidence, scoring criteria, feedback and intervention decision.",
  "ESL Progress": "Review CEFR evidence, independent use, confidence and the learner’s next language target.",
  "IELTS Progress": "Review skill bands, target gap, test date and the next score-building intervention.",
  "Language Skills": "Inspect recognition, controlled practice and independent production evidence.",
  "Writing Tracker": "Open the script, criterion bands, recurring errors and marking actions.",
  "Speaking Tracker": "Open the recording, criterion bands, part performance and scoring actions.",
  Calendar: "Open the schedule block, linked work and availability around it.",
  Tasks: "Open the task details, due time, priority and related teaching work.",
  Goals: "Review the target, progress evidence, milestones and next weekly action.",
  Projects: "Open the project board, milestones, tasks and current delivery risk.",
  Reports: "Open the complete report with filters, evidence and recommended decisions.",
  Materials: "Open the teaching resource, preview, level tags and lesson-use actions.",
};

function buildDestination(message: string, track: Track, fallbackArea: Area = "Dashboard"): DestinationPanel {
  const lower = message.toLowerCase();
  let area: Area = fallbackArea;
  if (lower.includes("teacher profile")) area = "Dashboard";
  else if (lower.includes("material") || lower.includes("collection") || lower.includes("worksheet") || lower.includes("cards") || lower.includes("audio")) area = "Materials";
  else if (lower.includes("report opened")) area = "Reports";
  else if (lower.includes("writing") || lower.includes("task 1") || lower.includes("task 2") || lower.includes("script")) area = "Writing Tracker";
  else if (lower.includes("speaking") || lower.includes("recording") || lower.includes("fluency")) area = "Speaking Tracker";
  else if (lower.includes("homework") || lower.includes("assignment") || lower.includes("workbook")) area = "Homework";
  else if (lower.includes("mock") || lower.includes("assessment") || lower.includes("score") || lower.includes("mark")) area = "Assessments";
  else if (lower.includes("lesson plan") || lower.includes("mini-plan") || lower.includes("production plan") || lower.includes("prep") || lower.startsWith("create new esl lesson") || lower.startsWith("create new ielts lesson")) area = "Lesson Planner";
  else if (lower.includes("lesson") || lower.includes("class workflow") || lower.includes("deliver")) area = "Lessons";
  else if (lower.includes("student") || lower.includes("candidate") || lower.includes("profile") || lower.includes("learner")) area = "Students";
  else if (lower.includes("cefr") || lower.includes("vocabulary") || lower.includes("grammar") || lower.includes("language skill")) area = track === "ESL" ? "ESL Progress" : "IELTS Progress";
  else if (lower.includes("band") || lower.includes("readiness") || lower.includes("intervention")) area = "IELTS Progress";
  else if (lower.includes("report")) area = "Reports";
  else if (lower.includes("project")) area = "Projects";
  else if (lower.includes("goal") || lower.includes("review")) area = "Goals";
  else if (lower.includes("calendar") || lower.includes("event") || lower.includes("block")) area = "Calendar";
  else if (lower.includes("task") || lower.includes("focus") || lower.includes("note")) area = "Tasks";
  else if (lower.includes("today") || lower.includes("day")) area = "Today";

  const mode: DestinationMode = lower.startsWith("create") || lower.startsWith("new ")
    ? "create"
    : lower.includes("notification")
      ? "notifications"
      : lower.includes("teacher profile")
        ? "profile"
        : lower.includes("delivery room") || lower.includes("lesson room")
          ? "delivery"
          : "detail";
  const title = message
    .replace(/\s+(opened|selected|started|created|refreshed|captured)$/i, "")
    .replace(/\s+opened for .+$/i, "")
    .replace(/\s+saved and marked ready$/i, "")
    .replace(/^new\s+/i, "Create ")
    .trim();
  const related: Area[] = area === "Students"
    ? [track === "ESL" ? "ESL Progress" : "IELTS Progress", "Lessons", "Homework"]
    : area === "Lessons" || area === "Lesson Planner"
      ? ["Lesson Planner", "Homework", "Materials"]
      : area === "Writing Tracker" || area === "Speaking Tracker" || area === "Assessments"
        ? ["IELTS Progress", "Assessments", "Reports"]
        : area === "Homework"
          ? ["Students", "Lesson Planner", track === "ESL" ? "ESL Progress" : "IELTS Progress"]
          : [area, "Tasks", "Calendar"];
  return {
    title,
    eyebrow: `${track} · ${mode === "create" ? "New record" : area}`,
    description: mode === "create" ? `Create a new ${track} record and continue directly into its working screen.` : destinationCopy[area],
    area,
    mode,
    facts: mode === "create" ? [["Workspace", track],["Status","New draft"],["Owner","Mike Teacher"]] : [["Workspace", track],["Status", lower.includes("complete") ? "Complete" : "Active"],["Last updated","Today"]],
    related: [...new Set(related)].slice(0, 3),
  };
}

const trackNavGroups: Record<Track, NavGroup[]> = {
  ESL: [
    {
      label: "ESL Teaching",
      items: [
        { name: "Dashboard", label: "ESL Dashboard", icon: LayoutDashboard },
        { name: "Today", label: "ESL Today", icon: Clock3, badge: "2" },
        { name: "Students", label: "ESL Students", icon: Users },
        { name: "Lessons", label: "ESL Lessons", icon: BookOpen },
        { name: "Lesson Planner", label: "ESL Planner", icon: NotebookPen },
      ],
    },
    {
      label: "ESL Learning",
      items: [
        { name: "Homework", label: "ESL Homework", icon: ClipboardCheck, badge: "2" },
        { name: "Assessments", label: "Progress Checks", icon: FileCheck2 },
        { name: "ESL Progress", label: "CEFR Progress", icon: TrendingUp },
        { name: "Language Skills", label: "Language Skills", icon: Activity },
        { name: "Reports", label: "ESL Reports", icon: BarChart3 },
      ],
    },
  ],
  IELTS: [
    {
      label: "IELTS Teaching",
      items: [
        { name: "Dashboard", label: "IELTS Dashboard", icon: LayoutDashboard },
        { name: "Today", label: "IELTS Today", icon: Clock3, badge: "2" },
        { name: "Students", label: "IELTS Students", icon: Users },
        { name: "Lessons", label: "IELTS Lessons", icon: BookOpen },
        { name: "Lesson Planner", label: "IELTS Planner", icon: NotebookPen },
      ],
    },
    {
      label: "IELTS Performance",
      items: [
        { name: "Homework", label: "IELTS Assignments", icon: ClipboardCheck, badge: "3" },
        { name: "Assessments", label: "Mock Tests", icon: FileCheck2, badge: "2" },
        { name: "IELTS Progress", label: "Band Progress", icon: Gauge },
        { name: "Writing Tracker", label: "Writing Tracker", icon: PenLine },
        { name: "Speaking Tracker", label: "Speaking Tracker", icon: Mic2 },
        { name: "Reports", label: "IELTS Reports", icon: BarChart3 },
      ],
    },
  ],
};

const sharedNavGroups: NavGroup[] = [
  {
    label: "Shared Planning",
    items: [
      { name: "Calendar", label: "Calendar", icon: CalendarDays },
      { name: "Tasks", label: "Tasks", icon: ListTodo, badge: "7" },
      { name: "Goals", label: "Goals", icon: Target },
      { name: "Projects", label: "Projects", icon: FolderKanban },
    ],
  },
  { label: "Library", items: [{ name: "Materials", label: "Materials", icon: LibraryBig }] },
];

const classSchedule = [
  {
    time: "10:00",
    end: "11:00",
    name: "Elif Demir",
    course: "General English · B1",
    status: "Complete",
    tone: "mint",
    initials: "ED",
  },
  {
    time: "13:30",
    end: "14:30",
    name: "Zeynep Kaya",
    course: "IELTS Academic · Band 5.5 → 6.5",
    status: "Ready",
    tone: "blue",
    initials: "ZK",
  },
  {
    time: "17:00",
    end: "18:00",
    name: "Arda Çelik",
    course: "Young Learner ESL · A2",
    status: "Check homework",
    tone: "amber",
    initials: "AÇ",
  },
  {
    time: "19:00",
    end: "20:00",
    name: "Deniz Yalçın",
    course: "IELTS Academic · Band 6.0 → 7.0",
    status: "Needs prep",
    tone: "violet",
    initials: "DY",
  },
];

const workflow = [
  { label: "Upcoming", icon: CalendarDays, state: "done" },
  { label: "HW status", icon: FileCheck2, state: "done" },
  { label: "Check HW", icon: ClipboardCheck, state: "done" },
  { label: "Prepare", icon: NotebookPen, state: "current" },
  { label: "Deliver", icon: Video, state: "next" },
  { label: "Notes", icon: MessageSquareText, state: "next" },
  { label: "Assign", icon: PenLine, state: "next" },
  { label: "Progress", icon: TrendingUp, state: "next" },
  { label: "Next prep", icon: TimerReset, state: "next" },
];
const workflowAreas: Area[] = ["Today","Homework","Homework","Lesson Planner","Lessons","Lessons","Homework","ESL Progress","Lesson Planner"];

const priorityItems = [
  {
    id: 1,
    title: "Check Arda’s vocabulary workbook",
    meta: "Homework · due before 17:00",
    tag: "25 min",
    tone: "amber",
  },
  {
    id: 2,
    title: "Finish Deniz’s Task 2 lesson plan",
    meta: "Lesson prep · class at 19:00",
    tag: "40 min",
    tone: "violet",
  },
  {
    id: 3,
    title: "Score Zeynep’s speaking recording",
    meta: "Assessment · submitted yesterday",
    tag: "15 min",
    tone: "blue",
  },
];

const studentPulse = [
  { name: "Deniz Yalçın", track: "IELTS", value: 72, delta: "+0.5", color: "violet" },
  { name: "Elif Demir", track: "ESL · B1", value: 84, delta: "+8%", color: "mint" },
  { name: "Arda Çelik", track: "ESL · A2", value: 61, delta: "+5%", color: "amber" },
];

type AreaMeta = { eyebrow: string; title: string; description: string; stats: Array<[string, string]>; items: string[] };
const areaData: Record<Exclude<Area, "Dashboard" | "Language Skills" | "Writing Tracker" | "Speaking Tracker">, AreaMeta> = {
  Today: {
    eyebrow: "Sunday · 9 August",
    title: "Your teaching day",
    description: "A calm, chronological view of every class, check-in, preparation block and follow-up.",
    stats: [["Sessions", "4"], ["Teaching", "4h"], ["Prep blocks", "2"], ["Day ready", "75%"]],
    items: ["Elif · Lesson delivered and notes saved", "Zeynep · IELTS Speaking mock ready", "Arda · Homework needs checking", "Deniz · Task 2 lesson needs final prep"],
  },
  Students: {
    eyebrow: "Student directory",
    title: "Every learner, fully in context",
    description: "Profiles, goals, availability, attendance, homework and progress in one reliable record.",
    stats: [["Active", "18"], ["ESL", "11"], ["IELTS", "7"], ["Need attention", "2"]],
    items: ["Deniz Yalçın · IELTS 6.0 → 7.0", "Elif Demir · General English B1", "Arda Çelik · Young Learner A2", "Zeynep Kaya · IELTS 5.5 → 6.5"],
  },
  Lessons: {
    eyebrow: "Lesson records",
    title: "Plan, teach and remember",
    description: "A complete history of delivered lessons, notes, objectives, attendance and next steps.",
    stats: [["This month", "34"], ["Completed", "31"], ["Rescheduled", "2"], ["Attendance", "96%"]],
    items: ["IELTS Task 2 · Opinion essays", "Past habits · used to / would", "Speaking Part 2 · people", "Travel problems · functional language"],
  },
  "Lesson Planner": {
    eyebrow: "Planning studio",
    title: "Build a strong lesson in minutes",
    description: "Start from the learner’s goals, reuse proven materials and leave with a timed lesson flow.",
    stats: [["To prepare", "2"], ["Drafts", "4"], ["Templates", "12"], ["Reused", "68%"]],
    items: ["Deniz · Task 2 position and support", "Arda · Mystery story grammar", "Zeynep · Speaking fluency clinic", "Elif · Workplace small talk"],
  },
  Homework: {
    eyebrow: "Homework command center",
    title: "Nothing submitted gets lost",
    description: "Track assignments from assigned to submitted, checked, returned and mastered.",
    stats: [["To check", "3"], ["Due today", "2"], ["Late", "1"], ["On-time rate", "89%"]],
    items: ["Arda · Unit 6 vocabulary workbook", "Zeynep · Speaking Part 2 recording", "Deniz · Task 2 introduction rewrite", "Elif · Weekly reflection voice note"],
  },
  Assessments: {
    eyebrow: "Evidence of learning",
    title: "Assess consistently and act quickly",
    description: "Run mocks, quizzes and skill checks with comparable criteria and clear follow-up actions.",
    stats: [["Open marking", "2"], ["This month", "9"], ["Mocks", "4"], ["Avg. growth", "+11%"]],
    items: ["Zeynep · IELTS Speaking mock", "Deniz · Writing Task 2 timed response", "Elif · B1 progress check", "Arda · Unit 6 vocabulary quiz"],
  },
  "ESL Progress": {
    eyebrow: "CEFR progress",
    title: "See language becoming usable",
    description: "Track grammar, vocabulary, fluency, listening, reading and confidence by learner.",
    stats: [["Learners", "11"], ["On track", "9"], ["At risk", "2"], ["Avg. mastery", "76%"]],
    items: ["Elif · Fluency up 12%", "Arda · Vocabulary needs recycling", "Mert · B2 reading milestone met", "Selin · Pronunciation streak: 5 weeks"],
  },
  "IELTS Progress": {
    eyebrow: "Band score tracking",
    title: "Make every 0.5 band visible",
    description: "Monitor Listening, Reading, Writing and Speaking against target bands and test dates.",
    stats: [["Candidates", "7"], ["On target", "5"], ["Mocks due", "2"], ["Avg. gain", "+0.6"]],
    items: ["Deniz · Writing 6.0, target 7.0", "Zeynep · Speaking 6.0, target 6.5", "Ece · Reading target achieved", "Can · Listening accuracy 76%"],
  },
  Calendar: {
    eyebrow: "Schedule",
    title: "Teaching time, protected",
    description: "See lessons, prep, checking and personal commitments without overbooking the week.",
    stats: [["This week", "22 lessons"], ["Teaching", "21h"], ["Prep", "7h"], ["Open blocks", "5"]],
    items: ["Monday · 5 lessons", "Tuesday · 4 lessons + mock marking", "Wednesday · Planning morning", "Thursday · 6 lessons"],
  },
  Tasks: {
    eyebrow: "Action list",
    title: "Do the right work before class",
    description: "Prioritized teaching, business and personal tasks with time estimates and focus blocks.",
    stats: [["Today", "7"], ["Teaching", "4"], ["Business", "2"], ["Completed", "63%"]],
    items: ["Check Arda’s homework", "Prepare Deniz’s lesson", "Send Zeynep mock feedback", "Upload August invoice records"],
  },
  Goals: {
    eyebrow: "Quarterly direction",
    title: "Turn intentions into weekly progress",
    description: "Connect student outcomes, teaching quality and business growth to concrete work.",
    stats: [["Active", "4"], ["On track", "3"], ["At risk", "1"], ["Quarter", "58%"]],
    items: ["Raise IELTS student average by 0.5 band", "Build reusable B1 curriculum", "Protect one planning morning weekly", "Publish 20 premium teaching materials"],
  },
  Projects: {
    eyebrow: "Project workspace",
    title: "Move bigger teaching work forward",
    description: "Plan multi-step curriculum, material and business work without mixing it into daily tasks.",
    stats: [["Active", "5"], ["On track", "4"], ["Due soon", "1"], ["Archived", "12"]],
    items: ["IELTS Academic Prompt Library", "A2 Young Learner Mystery Unit", "Student onboarding refresh", "Autumn course launch"],
  },
  Reports: {
    eyebrow: "Teaching intelligence",
    title: "Turn records into useful decisions",
    description: "Review attendance, progress, workload, homework habits and revenue in clear reports.",
    stats: [["Reports", "8"], ["Updated", "Today"], ["Students", "18"], ["Data quality", "96%"]],
    items: ["Monthly student progress", "Homework completion trends", "Teaching capacity and workload", "IELTS band movement"],
  },
  Materials: {
    eyebrow: "Teaching library",
    title: "Find the right material before the lesson",
    description: "Organize worksheets, prompts, slides, audio, rubrics and links by level, skill and topic.",
    stats: [["Materials", "486"], ["IELTS", "172"], ["ESL", "314"], ["Used this week", "28"]],
    items: ["Task 2 opinion essay toolkit", "B1 conversation card library", "A2 mystery story unit", "IELTS Speaking band descriptor sheet"],
  },
};

const trackAreaData: Record<Track, Partial<Record<Area, AreaMeta>>> = {
  ESL: {
    Today: { eyebrow: "ESL workspace · Sunday", title: "Today’s ESL teaching", description: "Only your ESL classes, preparation, checking and learner follow-ups.", stats: [["ESL lessons","2"],["Teaching","2h"],["HW to check","1"],["Ready","82%"]], items: [] },
    Students: { eyebrow: "ESL learner directory", title: "ESL students", description: "CEFR level, learning goals, language systems, confidence and communicative performance.", stats: [["Active ESL","11"],["Young learners","3"],["Adults","8"],["Need support","2"]], items: [] },
    Lessons: { eyebrow: "ESL lesson records", title: "ESL lesson history", description: "Objectives, target language, communicative outcomes and next-step notes for every ESL class.", stats: [["This month","21"],["Delivered","20"],["Attendance","97%"],["Avg. confidence","78%"]], items: [] },
    "Lesson Planner": { eyebrow: "ESL planning studio", title: "Plan a communicative ESL lesson", description: "Build from CEFR outcomes, target language, controlled practice and meaningful production.", stats: [["To prepare","1"],["ESL templates","18"],["Units active","7"],["Reuse rate","74%"]], items: [] },
    Homework: { eyebrow: "ESL homework", title: "Practice that builds usable English", description: "Track vocabulary recycling, grammar practice, recordings, reading and real-life production tasks.", stats: [["To check","2"],["Due today","1"],["Late","1"],["On-time","86%"]], items: [] },
    Assessments: { eyebrow: "ESL progress checks", title: "Measure CEFR mastery", description: "Diagnostic checks, unit reviews and communicative performance—not IELTS band scoring.", stats: [["Checks due","2"],["Units assessed","7"],["Mastered","76%"],["Rechecks","2"]], items: [] },
    "ESL Progress": { eyebrow: "CEFR progress", title: "CEFR mastery by learner", description: "Track grammar, vocabulary, pronunciation, fluency, receptive skills and confidence.", stats: [["ESL learners","11"],["On track","9"],["At risk","2"],["Avg. mastery","76%"]], items: [] },
    "Language Skills": { eyebrow: "ESL language systems", title: "Track the English students can actually use", description: "Separate receptive knowledge from spontaneous production across language systems and skills.", stats: [["Skills tracked","8"],["Mastery","76%"],["Production gap","12%"],["Review due","14 items"]], items: [] },
    Reports: { eyebrow: "ESL intelligence", title: "ESL progress reports", description: "CEFR movement, unit mastery, confidence, homework habits and attendance for ESL learners only.", stats: [["ESL reports","5"],["Learners","11"],["Updated","Today"],["Data quality","97%"]], items: [] },
    Materials: { eyebrow: "ESL material library", title: "ESL materials by CEFR level", description: "Lessons, cards, worksheets, audio and projects organized by level, age, language focus and theme.", stats: [["ESL materials","314"],["A1–A2","132"],["B1–B2","164"],["Used this week","17"]], items: [] },
  },
  IELTS: {
    Today: { eyebrow: "IELTS workspace · Sunday", title: "Today’s IELTS teaching", description: "Only IELTS lessons, marking, timed practice, mocks and candidate follow-ups.", stats: [["IELTS lessons","2"],["Teaching","2h"],["Scripts to mark","2"],["Ready","71%"]], items: [] },
    Students: { eyebrow: "IELTS candidate directory", title: "IELTS Academic students", description: "Current and target bands, skill profiles, test dates, mock results and readiness risk.", stats: [["Candidates","7"],["On target","5"],["Tests ≤ 60d","3"],["At risk","2"]], items: [] },
    Lessons: { eyebrow: "IELTS lesson records", title: "IELTS skill lessons", description: "Question types, exam strategy, timed performance, band criteria and assigned practice.", stats: [["This month","13"],["Writing","5"],["Speaking","4"],["Mocks","4"]], items: [] },
    "Lesson Planner": { eyebrow: "IELTS planning studio", title: "Plan a score-focused IELTS lesson", description: "Build from a target band, question type, rubric gap, timed practice and measurable exit score.", stats: [["To prepare","1"],["IELTS templates","24"],["Mocks due","2"],["Rubrics","8"]], items: [] },
    Homework: { eyebrow: "IELTS assignments", title: "IELTS practice and marking", description: "Track timed sections, Writing tasks, Speaking recordings, error logs and targeted drills.", stats: [["To mark","3"],["Timed tasks","2"],["Late","0"],["On-time","94%"]], items: [] },
    Assessments: { eyebrow: "IELTS mock center", title: "Mock tests and timed sections", description: "Full mocks, sectional tests, raw scores, band conversion and post-mock intervention plans.", stats: [["Mocks due","2"],["Scripts to mark","2"],["Avg. overall","6.4"],["Next test","50 days"]], items: [] },
    "IELTS Progress": { eyebrow: "Band score progress", title: "Band movement by skill", description: "Listening, Reading, Writing and Speaking tracked against target bands and official test dates.", stats: [["Candidates","7"],["On target","5"],["Avg. gain","+0.6"],["Writing gap","−0.7"]], items: [] },
    "Writing Tracker": { eyebrow: "IELTS Writing", title: "Writing performance by criterion", description: "Task Achievement/Response, Coherence and Cohesion, Lexical Resource, Grammar and error patterns.", stats: [["Scripts","38"],["Avg. band","6.0"],["Target gap","0.7"],["Awaiting mark","2"]], items: [] },
    "Speaking Tracker": { eyebrow: "IELTS Speaking", title: "Speaking performance by criterion", description: "Fluency, lexical resource, grammar, pronunciation and Parts 1–3 performance.", stats: [["Recordings","31"],["Avg. band","6.3"],["Mocks due","1"],["Fluency gap","0.4"]], items: [] },
    Reports: { eyebrow: "IELTS intelligence", title: "IELTS performance reports", description: "Band movement, question-type accuracy, rubric gaps, mock trends and test readiness.", stats: [["IELTS reports","7"],["Candidates","7"],["Updated","Today"],["Data quality","96%"]], items: [] },
    Materials: { eyebrow: "IELTS material library", title: "IELTS Academic materials", description: "Question-type drills, mock sections, band models, rubrics and strategy resources by target band.", stats: [["IELTS materials","172"],["Writing","48"],["Speaking","39"],["Used this week","11"]], items: [] },
  },
};

export default function Home() {
  const [activeTrack, setActiveTrack] = useState<Track>("ESL");
  const [activeArea, setActiveArea] = useState<Area>("Dashboard");
  const [sidebarCompact, setSidebarCompact] = useState(false);
  const [completedTasks, setCompletedTasks] = useState<number[]>([]);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showLessonPanel, setShowLessonPanel] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [destination, setDestination] = useState<DestinationPanel | null>(null);
  const [lessonChecks, setLessonChecks] = useState([true, true, false, false]);
  const [toast, setToast] = useState<string | null>(null);
  const navGroups = useMemo(() => [...trackNavGroups[activeTrack], ...sharedNavGroups], [activeTrack]);

  const syncUrl = (track: Track, area: Area, detail?: string, mode: "push" | "replace" = "push") => {
    const params = new URLSearchParams();
    params.set("track", track.toLowerCase());
    params.set("view", areaSlug(area));
    if (detail) params.set("detail", detail.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
    window.history[mode === "push" ? "pushState" : "replaceState"]({}, "", `${window.location.pathname}?${params.toString()}`);
  };

  const navigateTo = (area: Area) => {
    setActiveArea(area);
    setDestination(null);
    setShowQuickAdd(false);
    setShowSearch(false);
    syncUrl(activeTrack, area);
    window.requestAnimationFrame(() => document.querySelector(".main-content")?.scrollTo({ top: 0, behavior: "smooth" }));
  };

  const changeTrack = (track: Track) => {
    setActiveTrack(track);
    setActiveArea("Dashboard");
    setShowLessonPanel(false);
    setDestination(null);
    syncUrl(track, "Dashboard");
  };

  const openDestination = (message: string) => {
    const next = buildDestination(message, activeTrack, activeArea);
    setActiveArea(next.area);
    setDestination(next);
    setShowQuickAdd(false);
    syncUrl(activeTrack, next.area, next.title);
  };

  const closeDestination = () => {
    setDestination(null);
    syncUrl(activeTrack, activeArea, undefined, "replace");
  };

  useEffect(() => {
    const restoreLocation = () => {
      const params = new URLSearchParams(window.location.search);
      const nextTrack: Track = params.get("track") === "ielts" ? "IELTS" : "ESL";
      const nextArea = areaFromSlug(params.get("view")) ?? "Dashboard";
      setActiveTrack(nextTrack);
      setActiveArea(nextArea);
      setDestination(null);
      setShowLessonPanel(false);
      setShowQuickAdd(false);
    };
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setShowSearch(true);
      }
      if (event.key === "Escape") {
        setShowSearch(false);
        setShowQuickAdd(false);
        setShowLessonPanel(false);
        setDestination(null);
      }
    };
    restoreLocation();
    window.addEventListener("keydown", handleShortcut);
    window.addEventListener("popstate", restoreLocation);
    return () => {
      window.removeEventListener("keydown", handleShortcut);
      window.removeEventListener("popstate", restoreLocation);
    };
  }, []);

  const completeTask = (id: number) => {
    setCompletedTasks((items) =>
      items.includes(id) ? items.filter((item) => item !== id) : [...items, id],
    );
  };

  const announce = (message: string, openPanel?: boolean) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
    const shouldOpen = openPanel ?? /(opened|selected|started|created|refreshed|captured|optimized|ready|create|^new\s)/i.test(message);
    if (shouldOpen) openDestination(message);
  };

  return (
    <div className={`app-shell track-${activeTrack.toLowerCase()} ${sidebarCompact ? "is-compact" : ""}`}>
      <aside className="sidebar">
        <div className="brand-row">
          <button className="brand" onClick={() => navigateTo("Dashboard")} aria-label="Open dashboard">
            <span className="brand-mark"><GraduationCap size={19} strokeWidth={2.2} /></span>
            <span className="brand-copy"><strong>Teacher</strong><em>OS</em></span>
          </button>
          <button className="icon-button sidebar-toggle" onClick={() => setSidebarCompact((value) => !value)} aria-label="Toggle sidebar">
            <PanelLeftClose size={17} />
          </button>
        </div>

        <div className="track-switcher" aria-label="Teaching track">
          <button className={activeTrack === "ESL" ? "active" : ""} onClick={() => changeTrack("ESL")}><span>ESL</span><small>CEFR</small></button>
          <button className={activeTrack === "IELTS" ? "active" : ""} onClick={() => changeTrack("IELTS")}><span>IELTS</span><small>Academic</small></button>
        </div>

        <nav className="main-nav" aria-label="Primary navigation">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <p className="nav-label">{group.label}</p>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = activeArea === item.name;
                return (
                  <button
                    className={`nav-item ${active ? "active" : ""}`}
                    key={`${activeTrack}-${group.label}-${item.name}`}
                    onClick={() => navigateTo(item.name)}
                    title={sidebarCompact ? item.label : undefined}
                  >
                    <Icon size={18} strokeWidth={active ? 2.3 : 1.85} />
                    <span>{item.label}</span>
                    {item.badge && <b>{item.badge}</b>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="weekly-card">
            <div className="weekly-card-top"><span>{activeTrack} weekly goal</span><strong>{activeTrack === "ESL" ? "82%" : "71%"}</strong></div>
            <div className="progress-track"><i style={{ width: activeTrack === "ESL" ? "82%" : "71%" }} /></div>
            <small>{activeTrack === "ESL" ? "9 of 11 learners on track" : "5 of 7 candidates on target"}</small>
          </div>
          <button className="profile-button" onClick={() => announce("Teacher profile opened")}>
            <span className="avatar teacher-avatar">MT</span>
            <span><strong>Mike Teacher</strong><small>Private tutor</small></span>
            <MoreHorizontal size={17} />
          </button>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <button className="search-trigger" onClick={() => setShowSearch(true)}>
            <Search size={17} />
            <span>Search {activeTrack} students, lessons, materials...</span>
            <kbd><Command size={12} /> K</kbd>
          </button>
          <div className="topbar-actions">
            <span className={`workspace-badge ${activeTrack.toLowerCase()}`}>{activeTrack === "ESL" ? "ESL · CEFR" : "IELTS Academic"}</span>
            <span className="today-label"><CalendarDays size={16} /> Sun, 9 Aug</span>
            <button className="icon-button notification-button" onClick={() => announce("Notifications opened")} aria-label="Notifications"><Bell size={18} /><i /></button>
            <div className="quick-add-wrap">
              <button className="primary-button" onClick={() => setShowQuickAdd((value) => !value)}><Plus size={17} /> Quick add <ChevronDown size={14} /></button>
              {showQuickAdd && (
                <div className="quick-menu">
                  <button onClick={() => { navigateTo("Lesson Planner"); announce(`Create new ${activeTrack} lesson`); }}><BookOpen size={17} /><span><strong>{activeTrack} lesson</strong><small>{activeTrack === "ESL" ? "Plan from a CEFR outcome" : "Plan from a target band"}</small></span></button>
                  <button onClick={() => { navigateTo("Tasks"); announce("Create new task"); }}><ListTodo size={17} /><span><strong>Task</strong><small>Capture a next action</small></span></button>
                  <button onClick={() => { navigateTo("Students"); announce(`Create new ${activeTrack} student`); }}><UserRound size={17} /><span><strong>{activeTrack} student</strong><small>{activeTrack === "ESL" ? "Create a CEFR learner profile" : "Create a band-score profile"}</small></span></button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="main-content">
          {activeArea === "Dashboard" ? (
            activeTrack === "ESL" ?
              <ESLDashboardView completedTasks={completedTasks} completeTask={completeTask} setActiveArea={navigateTo} openLesson={() => setShowLessonPanel(true)} announce={announce} /> :
              <IELTSDashboardView completedTasks={completedTasks} completeTask={completeTask} setActiveArea={navigateTo} openLesson={() => setShowLessonPanel(true)} announce={announce} />
          ) : (
            <AreaPreview area={activeArea} track={activeTrack} announce={announce} />
          )}
        </main>
      </div>

      {showLessonPanel && (
        <div className="drawer-backdrop" onMouseDown={() => setShowLessonPanel(false)}>
          <aside className="lesson-drawer" onMouseDown={(event) => event.stopPropagation()} aria-label="Upcoming lesson panel">
            <div className="drawer-head">
              <div><span className="eyebrow">Upcoming {activeTrack} lesson</span><h2>{activeTrack === "ESL" ? "Arda Çelik" : "Deniz Yalçın"}</h2></div>
              <button className="icon-button" onClick={() => setShowLessonPanel(false)} aria-label="Close"><X size={19} /></button>
            </div>
            <div className="student-summary"><span className={`avatar ${activeTrack === "ESL" ? "avatar-amber" : "avatar-violet"}`}>{activeTrack === "ESL" ? "AÇ" : "DY"}</span><div><strong>{activeTrack === "ESL" ? "Young Learner ESL" : "IELTS Academic"}</strong><span>{activeTrack === "ESL" ? "CEFR A2 → B1 · 17:00–18:00" : "Band 6.0 → 7.0 · 19:00–20:00"}</span></div></div>
            <div className="drawer-section"><span className="section-kicker">Today’s objective</span><h3>{activeTrack === "ESL" ? "Use past simple and past continuous to narrate a mystery" : "Build a clear position and support it in Writing Task 2"}</h3><p>{activeTrack === "ESL" ? "Focus on accurate story sequencing, time linkers and confident spoken production." : "Focus on thesis clarity, topic sentence alignment and developing one main idea per paragraph."}</p></div>
            <div className="drawer-checklist">
              {["Homework received","Homework checked",activeTrack === "ESL" ? "Print mystery story cards" : "Finalize model paragraph","Open shared lesson board"].map((label,index) => <button key={label} className={lessonChecks[index] ? "checked" : ""} onClick={() => { setLessonChecks(items => items.map((value,itemIndex) => itemIndex === index ? !value : value)); announce(`${label} ${lessonChecks[index] ? "reopened" : "completed"}`, false); }}>{lessonChecks[index] ? <Check size={15} /> : <Circle size={15} />} {label}</button>)}
            </div>
            <div className="drawer-section compact"><span className="section-kicker">Materials</span><button className="material-chip" onClick={() => { setShowLessonPanel(false); navigateTo("Materials"); announce(`${activeTrack === "ESL" ? "Mystery sequencing cards" : "Task 2 planning worksheet"} material opened`); }}><FileText size={16} /> {activeTrack === "ESL" ? "Mystery sequencing cards" : "Task 2 planning worksheet"} <ChevronRight size={15} /></button><button className="material-chip" onClick={() => { setShowLessonPanel(false); navigateTo("Materials"); announce(`${activeTrack === "ESL" ? "A2 story language mat" : "Band 7 model answer"} material opened`); }}><FileText size={16} /> {activeTrack === "ESL" ? "A2 story language mat" : "Band 7 model answer"} <ChevronRight size={15} /></button></div>
            <div className="drawer-actions"><button className="secondary-button" onClick={() => { setShowLessonPanel(false); navigateTo("Lesson Planner"); }}>Open plan</button><button className="primary-button grow" onClick={() => { setShowLessonPanel(false); announce(`${activeTrack} lesson delivery room opened`); }}><Play size={16} fill="currentColor" /> Start lesson</button></div>
          </aside>
        </div>
      )}

      {showSearch && <GlobalSearch track={activeTrack} close={() => setShowSearch(false)} setActiveArea={navigateTo} announce={announce} />}

      {destination && <DestinationDrawer key={destination.title} panel={destination} track={activeTrack} close={closeDestination} navigate={navigateTo} announce={announce} />}

      {toast && <div className="toast"><CheckCircle2 size={17} /> {toast}</div>}
    </div>
  );
}

function DestinationDrawer({ panel, track, close, navigate, announce }: { panel: DestinationPanel; track: Track; close: () => void; navigate: (area: Area) => void; announce: Announce }) {
  const [saved, setSaved] = useState(false);
  const saveDraft = (event: React.FormEvent) => {
    event.preventDefault();
    setSaved(true);
    announce(`${panel.title} created successfully`, false);
  };
  return <div className="destination-backdrop" onMouseDown={close}>
    <aside className="destination-drawer" onMouseDown={(event) => event.stopPropagation()} aria-label={`${panel.title} destination`}>
      <header className="destination-head"><div><span className="eyebrow">{panel.eyebrow}</span><h2>{panel.title}</h2><p>{panel.description}</p></div><button className="icon-button" onClick={close} aria-label="Close destination"><X size={18}/></button></header>

      {panel.mode === "notifications" ? <div className="destination-body"><div className="destination-section"><PanelHeader kicker="Inbox" title="3 items need attention"/><div className="destination-list"><button onClick={() => navigate(track === "ESL" ? "Homework" : "Writing Tracker")}><span className="destination-icon amber"><ClipboardCheck size={16}/></span><span><strong>{track === "ESL" ? "Arda submitted vocabulary practice" : "Deniz submitted Writing Task 2"}</strong><small>Ready for checking · 18 minutes ago</small></span><ChevronRight size={15}/></button><button onClick={() => navigate("Calendar")}><span className="destination-icon blue"><CalendarDays size={16}/></span><span><strong>Lesson begins in 48 minutes</strong><small>{track === "ESL" ? "Arda · A2 mystery lesson" : "Deniz · IELTS Writing"}</small></span><ChevronRight size={15}/></button><button onClick={() => navigate(track === "ESL" ? "ESL Progress" : "IELTS Progress")}><span className="destination-icon mint"><TrendingUp size={16}/></span><span><strong>Progress update is due</strong><small>Evidence is ready to record</small></span><ChevronRight size={15}/></button></div></div></div>
      : panel.mode === "profile" ? <div className="destination-body"><div className="destination-profile"><span className="avatar teacher-avatar">MT</span><div><strong>Mike Teacher</strong><span>Private 1:1 ESL & IELTS Academic tutor</span></div></div><div className="destination-facts">{[["Today","4 lessons"],["Active learners","18"],["Weekly teaching","21 hours"],["Workspace",track]].map(([label,value])=><span key={label}><small>{label}</small><strong>{value}</strong></span>)}</div><div className="destination-section"><PanelHeader kicker="Workspace" title="Teacher shortcuts"/><div className="destination-shortcuts"><button onClick={()=>navigate("Calendar")}><CalendarDays size={16}/>Calendar</button><button onClick={()=>navigate("Goals")}><Target size={16}/>Goals</button><button onClick={()=>navigate("Reports")}><BarChart3 size={16}/>Reports</button></div></div></div>
      : panel.mode === "delivery" ? <div className="destination-body"><div className={`delivery-status ${track.toLowerCase()}`}><span className="destination-icon"><Video size={18}/></span><div><strong>{track} lesson room is ready</strong><small>{track === "ESL" ? "Arda Çelik · 60-minute communicative lesson" : "Deniz Yalçın · 60-minute score-focused lesson"}</small></div><span className="live-pill">Ready</span></div><div className="destination-section"><PanelHeader kicker="Delivery sequence" title="Everything stays connected"/><div className="delivery-steps">{["Open teaching materials","Run the timed lesson flow","Capture post-class notes","Assign the next homework"].map((step,index)=><button key={step} onClick={()=>navigate(index===0?"Materials":index===1?"Lesson Planner":index===2?"Lessons":"Homework")}><span>{index+1}</span><strong>{step}</strong><ChevronRight size={15}/></button>)}</div></div></div>
      : panel.mode === "create" ? <form className="destination-body destination-form" onSubmit={saveDraft}><div className="destination-section"><PanelHeader kicker={`${track} creation flow`} title="Start with the essentials"/><label><span>Title</span><input required defaultValue={panel.title.replace(/^Create\s+/i, "")} placeholder="Add a clear title"/></label><label><span>{panel.area === "Students" ? (track === "ESL" ? "CEFR level and learning goal" : "Current band and target band") : "Linked student or project"}</span><input required placeholder={panel.area === "Students" ? (track === "ESL" ? "A2 → B1 · confident speaking" : "6.0 → 7.0 · IELTS Academic") : "Choose or type a name"}/></label><label><span>Next action</span><textarea placeholder="What should happen next?"/></label><div className="destination-facts compact">{panel.facts.map(([label,value])=><span key={label}><small>{label}</small><strong>{value}</strong></span>)}</div></div><button className={`primary-button destination-save ${saved ? "saved" : ""}`} type="submit">{saved ? <><Check size={16}/> Draft saved</> : <><Plus size={16}/> Create draft</>}</button></form>
      : <div className="destination-body"><div className="destination-facts">{panel.facts.map(([label,value])=><span key={label}><small>{label}</small><strong>{value}</strong></span>)}</div><div className="destination-section"><PanelHeader kicker="Connected record" title="Continue the workflow"/><div className="destination-checklist"><button onClick={()=>announce("Context reviewed", false)}><CheckCircle2 size={17}/><span><strong>Review the latest context</strong><small>Notes, evidence and current status</small></span></button><button onClick={()=>navigate(panel.area)}><ArrowUpRight size={17}/><span><strong>Open the full {panel.area.toLowerCase()} workspace</strong><small>Continue with every related control</small></span></button><button onClick={()=>navigate("Tasks")}><ListTodo size={17}/><span><strong>Create or update the next action</strong><small>Keep the workflow moving</small></span></button></div></div></div>}

      <footer className="destination-footer"><div><span>Related destinations</span><div>{panel.related.map((area)=><button key={area} onClick={()=>navigate(area)}>{area}<ArrowRight size={12}/></button>)}</div></div><button className="primary-button" onClick={()=>navigate(panel.area)}>Open {panel.area}<ArrowRight size={15}/></button></footer>
    </aside>
  </div>;
}

// Kept as a visual reference while the two track dashboards evolve independently.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function DashboardView({
  completedTasks,
  completeTask,
  setActiveArea,
  openLesson,
  announce,
}: {
  completedTasks: number[];
  completeTask: (id: number) => void;
  setActiveArea: (area: Area) => void;
  openLesson: () => void;
  announce: Announce;
}) {
  const remaining = useMemo(() => priorityItems.length - completedTasks.length, [completedTasks]);
  return (
    <>
      <section className="page-heading dashboard-heading">
        <div><p className="eyebrow">Sunday · 9 August</p><h1>Good afternoon, Mike <span>👋</span></h1><p>Four lessons today. Your next one is ready for the final prep pass.</p></div>
        <button className="secondary-button" onClick={() => announce("Today’s plan has been optimized around your lesson deadlines")}><Sparkles size={16} /> Plan my day</button>
      </section>

      <section className="stat-grid">
        <MetricCard label="Lessons today" value="4" note="3 remaining" icon={BookOpen} tone="violet" onOpen={() => setActiveArea("Today")} />
        <MetricCard label="Homework to check" value="3" note="1 is overdue" icon={ClipboardCheck} tone="amber" onOpen={() => setActiveArea("Homework")} />
        <MetricCard label="Plans to finish" value="2" note="75 min total" icon={NotebookPen} tone="blue" onOpen={() => setActiveArea("Lesson Planner")} />
        <MetricCard label="Weekly focus" value="80%" note="4 hours to goal" icon={Target} tone="mint" onOpen={() => setActiveArea("Goals")} />
      </section>

      <section className="dashboard-grid">
        <div className="dashboard-main-column">
          <article className="next-lesson-card">
            <div className="next-card-top"><span><Zap size={14} fill="currentColor" /> NEXT UP · IN 48 MIN</span><button aria-label="More options" onClick={()=>announce("Next lesson options opened")}><MoreHorizontal size={20} /></button></div>
            <div className="next-card-body">
              <span className="avatar avatar-large avatar-violet">DY</span>
              <div className="next-student-copy"><h2>Deniz Yalçın</h2><p>IELTS Academic · Writing Task 2</p><div><span><Clock3 size={15} /> 19:00–20:00</span><span><Target size={15} /> Band 6.0 → 7.0</span></div></div>
              <div className="readiness-ring" style={{ "--progress": "78" } as React.CSSProperties}><strong>78%</strong><span>ready</span></div>
            </div>
            <div className="next-card-footer"><p><span>Focus</span>Position, topic sentences & idea development</p><div><button className="ghost-light-button" onClick={() => setActiveArea("Lesson Planner")}><NotebookPen size={16} /> Finish prep</button><button className="light-button" onClick={openLesson}>Open lesson <ArrowRight size={16} /></button></div></div>
          </article>

          <article className="panel workflow-panel">
            <div className="panel-head"><div><span className="section-kicker">Lesson lifecycle</span><h2>Deniz’s class workflow</h2></div><span className="stage-pill">Step 4 of 9</span></div>
            <div className="workflow-line">
              {workflow.map((step, index) => {
                const Icon = step.icon;
                return <button key={step.label} className={`workflow-step ${step.state}`} onClick={() => setActiveArea(index === 7 ? "IELTS Progress" : workflowAreas[index])}><span><Icon size={16} />{step.state === "done" && <i><Check size={10} /></i>}</span><small>{step.label}</small>{index < workflow.length - 1 && <b />}</button>;
              })}
            </div>
          </article>

          <article className="panel schedule-panel">
            <div className="panel-head"><div><span className="section-kicker">Today</span><h2>Teaching schedule</h2></div><button className="text-button" onClick={() => setActiveArea("Today")}>Full day <ArrowRight size={15} /></button></div>
            <div className="schedule-list">
              {classSchedule.map((item, index) => <ScheduleRow key={item.time} item={item} isLast={index === classSchedule.length - 1} onOpen={() => index === 3 ? openLesson() : announce(`${item.name} opened`)} />)}
            </div>
          </article>

          <article className="panel priority-panel">
            <div className="panel-head"><div><span className="section-kicker">Priority queue</span><h2>What needs your attention</h2></div><span className="muted-count">{remaining} remaining</span></div>
            <div className="priority-list">
              {priorityItems.map((item) => {
                const done = completedTasks.includes(item.id);
                return <button key={item.id} className={`priority-row ${done ? "is-done" : ""}`} onClick={() => completeTask(item.id)}><span className={`task-check ${done ? "checked" : ""}`}>{done && <Check size={14} />}</span><span className={`priority-dot ${item.tone}`} /><span className="priority-copy"><strong>{item.title}</strong><small>{item.meta}</small></span><span className="time-chip"><Clock3 size={13} /> {item.tag}</span><ChevronRight size={16} /></button>;
              })}
            </div>
          </article>
        </div>

        <aside className="dashboard-rail">
          <article className="panel week-panel">
            <div className="panel-head"><div><span className="section-kicker">This week</span><h2>Teaching rhythm</h2></div><button aria-label="View calendar" onClick={() => setActiveArea("Calendar")}><CalendarDays size={17} /></button></div>
            <div className="week-days">{[["M","5",true],["T","4",true],["W","3",true],["T","6",true],["F","4",false],["S","2",false],["S","4",false]].map(([day, count, past], index) => <div key={index} className={`${index === 6 ? "today" : ""} ${past ? "past" : ""}`}><span>{day}</span><i style={{ height: `${16 + Number(count) * 6}px` }} /><b>{count}</b></div>)}</div>
            <div className="week-summary"><div><strong>21h</strong><span>Teaching</span></div><div><strong>7h</strong><span>Prep + marking</span></div></div>
          </article>

          <article className="panel pulse-panel">
            <div className="panel-head"><div><span className="section-kicker">Student pulse</span><h2>Progress at a glance</h2></div><button className="text-button" onClick={() => setActiveArea("Students")}>View all</button></div>
            <div className="pulse-list">{studentPulse.map((student) => <button key={student.name} onClick={() => setActiveArea(student.track.startsWith("IELTS") ? "IELTS Progress" : "ESL Progress")}><span className={`avatar avatar-small avatar-${student.color}`}>{student.name.split(" ").map((part) => part[0]).join("")}</span><span><strong>{student.name}</strong><small>{student.track}</small><i><em className={student.color} style={{ width: `${student.value}%` }} /></i></span><b>{student.delta}</b></button>)}</div>
          </article>

          <article className="focus-card">
            <span className="focus-icon"><Headphones size={19} /></span><div><span className="section-kicker">Focus suggestion</span><h3>40-minute prep sprint</h3><p>Finish Deniz’s model paragraph before your 18:15 break.</p><button onClick={() => announce("Focus timer started: 40 minutes")}><Play size={13} fill="currentColor" /> Start timer</button></div>
          </article>

          <article className="panel attention-card">
            <div className="attention-top"><span><Activity size={16} /> Needs attention</span><b>2</b></div>
            <button onClick={() => setActiveArea("ESL Progress")}><span className="avatar avatar-small avatar-amber">AÇ</span><span><strong>Arda Çelik</strong><small>2 late assignments</small></span><ChevronRight size={15} /></button>
            <button onClick={() => setActiveArea("IELTS Progress")}><span className="avatar avatar-small avatar-blue">ZK</span><span><strong>Zeynep Kaya</strong><small>Speaking score pending</small></span><ChevronRight size={15} /></button>
          </article>
        </aside>
      </section>
    </>
  );
}

type TrackDashboardProps = {
  completedTasks: number[];
  completeTask: (id: number) => void;
  setActiveArea: (area: Area) => void;
  openLesson: () => void;
  announce: Announce;
};

function ESLDashboardView({ completedTasks, completeTask, setActiveArea, openLesson, announce }: TrackDashboardProps) {
  const eslTasks = [
    { id:1, title:"Check Arda’s vocabulary retrieval", meta:"A2 homework · before 17:00", tag:"20 min", tone:"amber" },
    { id:2, title:"Print mystery sequencing cards", meta:"Lesson prep · Arda", tag:"10 min", tone:"mint" },
    { id:3, title:"Record Elif’s B1 communicative outcome", meta:"Post-class note", tag:"8 min", tone:"blue" },
  ];
  const eslSchedule = classSchedule.filter(item => !item.course.includes("IELTS"));
  return <>
    <section className="page-heading dashboard-heading track-heading"><div><p className="eyebrow"><span className="track-context-chip esl">ESL · CEFR WORKSPACE</span> Sunday · 9 August</p><h1>ESL teaching dashboard</h1><p>Communicative outcomes, CEFR mastery and language development for 11 ESL learners.</p></div><button className="secondary-button" onClick={()=>announce("ESL day optimized around CEFR outcomes")}><Sparkles size={16}/> Plan ESL day</button></section>
    <section className="stat-grid"><MetricCard label="Active ESL students" value="11" note="9 on track" icon={Users} tone="mint" onOpen={()=>setActiveArea("Students")}/><MetricCard label="ESL lessons today" value="2" note="1 remaining" icon={BookOpen} tone="blue" onOpen={()=>setActiveArea("Today")}/><MetricCard label="Homework to check" value="2" note="1 is late" icon={ClipboardCheck} tone="amber" onOpen={()=>setActiveArea("Homework")}/><MetricCard label="CEFR mastery" value="76%" note="+6% this term" icon={TrendingUp} tone="mint" onOpen={()=>setActiveArea("ESL Progress")}/></section>
    <section className="dashboard-grid track-dashboard"><div className="dashboard-main-column">
      <article className="track-hero-card esl"><div className="track-hero-top"><span><Zap size={14} fill="currentColor"/> NEXT ESL LESSON · IN 2H 48M</span><span className="track-hero-badge">CEFR A2</span></div><div className="track-hero-body"><span className="avatar avatar-large avatar-amber">AÇ</span><div><h2>Arda Çelik</h2><p>Young Learner ESL · Mystery Story Grammar</p><span><Clock3 size={14}/>17:00–18:00</span><span><Target size={14}/>A2 → B1 pathway</span></div><div className="readiness-ring" style={{"--progress":"84"} as React.CSSProperties}><strong>84%</strong><span>ready</span></div></div><div className="track-hero-footer"><p><span>Communicative outcome</span>Narrate a six-step mystery using past simple and past continuous</p><div><button onClick={()=>setActiveArea("Lesson Planner")}><NotebookPen size={15}/> Finish ESL plan</button><button onClick={openLesson}>Open lesson <ArrowRight size={15}/></button></div></div></article>
      <article className="panel workflow-panel"><div className="panel-head"><div><span className="section-kicker">ESL lesson lifecycle</span><h2>Arda’s class workflow</h2></div><span className="stage-pill">Step 4 of 9</span></div><div className="workflow-line">{workflow.map((step,index)=>{const Icon=step.icon;return <button key={step.label} className={`workflow-step ${step.state}`} onClick={()=>setActiveArea(workflowAreas[index])}><span><Icon size={16}/>{step.state==="done"&&<i><Check size={10}/></i>}</span><small>{step.label}</small>{index<workflow.length-1&&<b/>}</button>})}</div></article>
      <article className="panel track-matrix-panel"><PanelHeader kicker="CEFR learner pulse" title="Mastery and independent use" action={<button className="text-button" onClick={()=>setActiveArea("ESL Progress")}>Full CEFR tracker <ArrowRight size={14}/></button>}/><div className="track-matrix-head"><span>Learner</span><span>CEFR</span><span>Unit mastery</span><span>Independent use</span><span>Confidence</span><span/></div>{[["Elif Demir","B1","84%","78%","91%","mint"],["Arda Çelik","A2","61%","49%","65%","amber"],["Mert Bulut","B2","79%","76%","82%","violet"]].map(row=><button className="track-matrix-row" key={row[0]} onClick={()=>setActiveArea("ESL Progress")}><span className={`avatar avatar-small avatar-${row[5]}`}>{row[0].split(" ").map(part=>part[0]).join("")}</span><span><strong>{row[0]}</strong><small>1:1 ESL</small></span><b>{row[1]}</b><span className="matrix-meter"><i><em style={{width:row[2]}}/></i><b>{row[2]}</b></span><span className="matrix-meter"><i><em style={{width:row[3]}}/></i><b>{row[3]}</b></span><span className="matrix-meter"><i><em style={{width:row[4]}}/></i><b>{row[4]}</b></span><ChevronRight size={15}/></button>)}</article>
      <article className="panel priority-panel"><PanelHeader kicker="ESL priority queue" title="What needs attention" action={<span className="muted-count">{eslTasks.filter(task=>!completedTasks.includes(task.id)).length} remaining</span>}/><div className="priority-list">{eslTasks.map(item=>{const done=completedTasks.includes(item.id);return <button key={item.id} className={`priority-row ${done?"is-done":""}`} onClick={()=>completeTask(item.id)}><span className={`task-check ${done?"checked":""}`}>{done&&<Check size={14}/>}</span><span className={`priority-dot ${item.tone}`}/><span className="priority-copy"><strong>{item.title}</strong><small>{item.meta}</small></span><span className="time-chip"><Clock3 size={13}/>{item.tag}</span><ChevronRight size={16}/></button>})}</div></article>
    </div><aside className="dashboard-rail">
      <article className="panel track-scorecard"><PanelHeader kicker="ESL systems" title="Language mastery"/><div className="system-bars">{[["Grammar",74,"+6"],["Vocabulary",69,"+4"],["Fluency",81,"+9"],["Pronunciation",77,"+5"],["Confidence",78,"+8"]].map(([label,value,delta])=><button key={label as string} onClick={()=>setActiveArea("Language Skills")}><span><strong>{label}</strong><small>{delta}%</small></span><i><em style={{width:`${value}%`}}/></i><b>{value}%</b></button>)}</div></article>
      <article className="panel schedule-panel"><PanelHeader kicker="Today · ESL only" title="ESL teaching schedule" action={<button className="text-button" onClick={()=>setActiveArea("Today")}>Full day</button>}/><div className="schedule-list">{eslSchedule.map((item,index)=><ScheduleRow key={item.time} item={item} isLast={index===eslSchedule.length-1} onOpen={index===1?openLesson:()=>announce(`${item.name} opened`)}/>)}</div></article>
      <article className="focus-card esl-focus"><span className="focus-icon"><Activity size={19}/></span><div><span className="section-kicker">ESL insight</span><h3>Recognition ≠ production</h3><p>Arda recognizes 68% of target words but independently uses 49%.</p><button onClick={()=>setActiveArea("Language Skills")}>Open language skills <ArrowRight size={13}/></button></div></article>
      <article className="panel attention-card"><div className="attention-top"><span><Activity size={16}/>ESL learners needing support</span><b>2</b></div><button onClick={()=>setActiveArea("ESL Progress")}><span className="avatar avatar-small avatar-amber">AÇ</span><span><strong>Arda Çelik</strong><small>Active vocabulary gap</small></span><ChevronRight size={15}/></button><button onClick={()=>setActiveArea("ESL Progress")}><span className="avatar avatar-small avatar-blue">KY</span><span><strong>Kerem Yıldız</strong><small>Speaking confidence</small></span><ChevronRight size={15}/></button></article>
    </aside></section>
  </>;
}

function IELTSDashboardView({ completedTasks, completeTask, setActiveArea, openLesson, announce }: TrackDashboardProps) {
  const ieltsTasks = [
    { id:1, title:"Finish Deniz’s Band 7 model paragraph", meta:"Writing prep · before 19:00", tag:"40 min", tone:"violet" },
    { id:2, title:"Score Zeynep’s Speaking full mock", meta:"Four band criteria", tag:"20 min", tone:"blue" },
    { id:3, title:"Convert Can’s Listening raw score", meta:"Mock result · intervention needed", tag:"10 min", tone:"amber" },
  ];
  const ieltsSchedule=classSchedule.filter(item=>item.course.includes("IELTS"));
  return <>
    <section className="page-heading dashboard-heading track-heading"><div><p className="eyebrow"><span className="track-context-chip ielts">IELTS ACADEMIC WORKSPACE</span> Sunday · 9 August</p><h1>IELTS performance dashboard</h1><p>Band scores, mocks, rubric gaps and test readiness for 7 IELTS candidates.</p></div><button className="secondary-button" onClick={()=>announce("IELTS day optimized around test risk")}><Sparkles size={16}/> Prioritize test risk</button></section>
    <section className="stat-grid"><MetricCard label="IELTS candidates" value="7" note="5 on target" icon={Users} tone="violet" onOpen={()=>setActiveArea("Students")}/><MetricCard label="IELTS lessons today" value="2" note="1 remaining" icon={BookOpen} tone="blue" onOpen={()=>setActiveArea("Today")}/><MetricCard label="Mocks to score" value="2" note="1 speaking" icon={FileCheck2} tone="amber" onOpen={()=>setActiveArea("Assessments")}/><MetricCard label="Average band gain" value="+0.6" note="this term" icon={Gauge} tone="violet" onOpen={()=>setActiveArea("IELTS Progress")}/></section>
    <section className="dashboard-grid track-dashboard"><div className="dashboard-main-column">
      <article className="track-hero-card ielts"><div className="track-hero-top"><span><Zap size={14} fill="currentColor"/> NEXT IELTS LESSON · IN 48 MIN</span><span className="track-hero-badge">TARGET 7.0</span></div><div className="track-hero-body"><span className="avatar avatar-large avatar-violet">DY</span><div><h2>Deniz Yalçın</h2><p>IELTS Academic · Writing Task 2</p><span><Clock3 size={14}/>19:00–20:00</span><span><Gauge size={14}/>Current 6.5 → Target 7.0</span></div><div className="readiness-ring" style={{"--progress":"78"} as React.CSSProperties}><strong>78%</strong><span>ready</span></div></div><div className="track-hero-footer"><p><span>Band objective</span>Move Task Response and Coherence evidence from Band 6 to Band 7</p><div><button onClick={()=>setActiveArea("Lesson Planner")}><NotebookPen size={15}/> Finish IELTS plan</button><button onClick={openLesson}>Open lesson <ArrowRight size={15}/></button></div></div></article>
      <article className="panel workflow-panel"><div className="panel-head"><div><span className="section-kicker">IELTS lesson lifecycle</span><h2>Deniz’s class workflow</h2></div><span className="stage-pill">Step 4 of 9</span></div><div className="workflow-line">{workflow.map((step,index)=>{const Icon=step.icon;return <button key={step.label} className={`workflow-step ${step.state}`} onClick={()=>setActiveArea(index===7?"IELTS Progress":workflowAreas[index])}><span><Icon size={16}/>{step.state==="done"&&<i><Check size={10}/></i>}</span><small>{step.label}</small>{index<workflow.length-1&&<b/>}</button>})}</div></article>
      <article className="panel band-dashboard-panel"><PanelHeader kicker="Latest band matrix" title="Candidate performance" action={<button className="text-button" onClick={()=>setActiveArea("IELTS Progress")}>Full band tracker <ArrowRight size={14}/></button>}/><div className="band-dashboard-head"><span>Candidate</span><span>L</span><span>R</span><span>W</span><span>S</span><span>Overall</span><span>Target</span></div>{[["Deniz Yalçın","6.5","7.0","6.0","6.5","6.5","7.0","violet"],["Zeynep Kaya","6.0","6.5","5.5","6.0","6.0","6.5","blue"],["Ece Aksoy","7.5","7.0","6.5","7.0","7.0","7.0","mint"]].map(row=><button className="band-dashboard-row" key={row[0]} onClick={()=>setActiveArea("IELTS Progress")}><span className={`avatar avatar-small avatar-${row[7]}`}>{row[0].split(" ").map(part=>part[0]).join("")}</span><span><strong>{row[0]}</strong><small>IELTS Academic</small></span>{row.slice(1,5).map((score,index)=><b key={index} className={index===2?"band-focus-cell":""}>{score}</b>)}<strong>{row[5]}</strong><span><b>{row[6]}</b><i><em style={{width:`${Number(row[5])/Number(row[6])*100}%`}}/></i></span></button>)}</article>
      <article className="panel priority-panel"><PanelHeader kicker="IELTS priority queue" title="What needs attention" action={<span className="muted-count">{ieltsTasks.filter(task=>!completedTasks.includes(task.id)).length} remaining</span>}/><div className="priority-list">{ieltsTasks.map(item=>{const done=completedTasks.includes(item.id);return <button key={item.id} className={`priority-row ${done?"is-done":""}`} onClick={()=>completeTask(item.id)}><span className={`task-check ${done?"checked":""}`}>{done&&<Check size={14}/>}</span><span className={`priority-dot ${item.tone}`}/><span className="priority-copy"><strong>{item.title}</strong><small>{item.meta}</small></span><span className="time-chip"><Clock3 size={13}/>{item.tag}</span><ChevronRight size={16}/></button>})}</div></article>
    </div><aside className="dashboard-rail">
      <article className="panel track-scorecard"><PanelHeader kicker="Cohort averages" title="IELTS skill bands"/><div className="band-average-grid">{[["Listening","6.5","+0.5"],["Reading","6.4","+0.4"],["Writing","5.8","+0.3"],["Speaking","6.3","+0.6"]].map(([skill,band,delta])=><button key={skill} onClick={()=>setActiveArea(skill==="Writing"?"Writing Tracker":skill==="Speaking"?"Speaking Tracker":"IELTS Progress")}><span>{skill}</span><strong className={skill==="Writing"?"risk-band":""}>{band}</strong><small>{delta}</small></button>)}</div></article>
      <article className="panel schedule-panel"><PanelHeader kicker="Today · IELTS only" title="IELTS teaching schedule" action={<button className="text-button" onClick={()=>setActiveArea("Today")}>Full day</button>}/><div className="schedule-list">{ieltsSchedule.map((item,index)=><ScheduleRow key={item.time} item={item} isLast={index===ieltsSchedule.length-1} onOpen={index===1?openLesson:()=>announce(`${item.name} opened`)}/>)}</div></article>
      <article className="ielts-countdown-card"><span className="focus-icon"><Clock3 size={19}/></span><div><span className="section-kicker">Nearest official test</span><h3>Ece · 50 days</h3><p>Overall 7.0 achieved; Writing is 0.5 below safest target.</p><button onClick={()=>setActiveArea("IELTS Progress")}>Open readiness plan <ArrowRight size={13}/></button></div></article>
      <article className="panel attention-card"><div className="attention-top"><span><Activity size={16}/>IELTS candidates at risk</span><b>2</b></div><button onClick={()=>setActiveArea("Writing Tracker")}><span className="avatar avatar-small avatar-amber">BK</span><span><strong>Buse Kılıç</strong><small>Writing 1.0 below target</small></span><ChevronRight size={15}/></button><button onClick={()=>setActiveArea("IELTS Progress")}><span className="avatar avatar-small avatar-blue">CT</span><span><strong>Can Tunç</strong><small>Reading accuracy plateau</small></span><ChevronRight size={15}/></button></article>
    </aside></section>
  </>;
}

function MetricCard({ label, value, note, icon: Icon, tone, onOpen }: { label: string; value: string; note: string; icon: React.ElementType; tone: string; onOpen: () => void }) {
  return <button className="metric-card" onClick={onOpen} aria-label={`Open ${label}`}><div className={`metric-icon ${tone}`}><Icon size={19} /></div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div><span className="metric-open"><ArrowRight size={15} /></span></button>;
}

function ScheduleRow({ item, isLast, onOpen }: { item: (typeof classSchedule)[number]; isLast: boolean; onOpen: () => void }) {
  return <button className="schedule-row" onClick={onOpen}><div className="schedule-time"><strong>{item.time}</strong><span>{item.end}</span>{!isLast && <i />}</div><span className={`avatar avatar-${item.tone}`}>{item.initials}</span><div className="schedule-copy"><strong>{item.name}</strong><span>{item.course}</span></div><span className={`status-tag ${item.tone}`}>{item.status === "Complete" && <Check size={12} />} {item.status}</span><ChevronRight size={17} /></button>;
}

function AreaPreview({ area, track, announce }: { area: Exclude<Area, "Dashboard">; track: Track; announce: Announce }) {
  const data = trackAreaData[track][area] ?? areaData[area as keyof typeof areaData];
  if (!data) return null;
  return <>
    <section className="page-heading"><div><p className="eyebrow">{data.eyebrow}</p><h1>{data.title}</h1><p>{data.description}</p></div><button className="primary-button" onClick={() => announce(`Create new ${track} ${area.toLowerCase()} item`)}><Plus size={16} /> New</button></section>
    <section className="area-stat-grid">{data.stats.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong><TrendingUp size={16} /></article>)}</section>
    <DetailedArea area={area} track={track} announce={announce} />
  </>;
}

function GlobalSearch({ track, close, setActiveArea, announce }: { track: Track; close: () => void; setActiveArea: (area: Area) => void; announce: Announce }) {
  const [query, setQuery] = useState("");
  const trackResults = track === "ESL" ? [
    { title: "Arda Çelik", meta: "ESL student · CEFR A2", area: "Students" as Area, icon: UserRound },
    { title: "A2 mystery story unit", meta: "ESL material · Grammar", area: "Materials" as Area, icon: FileText },
    { title: "Check Arda’s vocabulary workbook", meta: "ESL task · due today", area: "Tasks" as Area, icon: CheckCircle2 },
    { title: "Elif · B1 progress check", meta: "CEFR assessment", area: "Assessments" as Area, icon: FileCheck2 },
    { title: "Vocabulary production gap", meta: "Language skills insight", area: "Language Skills" as Area, icon: Activity },
  ] : [
    { title: "Deniz Yalçın", meta: "IELTS candidate · Band 6.0", area: "Students" as Area, icon: UserRound },
    { title: "Task 2 opinion essay toolkit", meta: "IELTS material · Writing", area: "Materials" as Area, icon: FileText },
    { title: "Deniz · Task 2 timed response", meta: "Writing · awaiting mark", area: "Writing Tracker" as Area, icon: PenLine },
    { title: "Zeynep · IELTS Speaking mock", meta: "Mock · marking", area: "Assessments" as Area, icon: Mic2 },
    { title: "Speaking fluency criterion", meta: "Band tracker", area: "Speaking Tracker" as Area, icon: Gauge },
  ];
  const results = trackResults.filter((result) => `${result.title} ${result.meta}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="search-backdrop" onMouseDown={close}>
    <section className="global-search" onMouseDown={(event) => event.stopPropagation()} aria-label="Global search dialog">
      <div className="global-search-input"><Search size={19} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search the ${track} workspace...`} /><kbd>ESC</kbd></div>
      <div className="search-result-label"><span>{query ? `${results.length} results` : `${track} suggestions`}</span><small>Search only this teaching track</small></div>
      <div className="search-results">
        {results.map((result) => { const Icon = result.icon; return <button key={result.title} onClick={() => { close(); setActiveArea(result.area); announce(`${result.title} opened`); }}><span><Icon size={17} /></span><div><strong>{result.title}</strong><small>{result.meta}</small></div><span className="search-area">{result.area}</span><ArrowRight size={15} /></button>; })}
        {!results.length && <div className="search-empty"><Search size={25} /><strong>No matches yet</strong><span>Try a student name, skill, task or material.</span></div>}
      </div>
      <div className="search-footer"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><Command size={12} /> K to search anywhere</span></div>
    </section>
  </div>;
}

function DetailedArea({ area, track, announce }: { area: Exclude<Area, "Dashboard">; track: Track; announce: Announce }) {
  switch (area) {
    case "Today": return <TodayArea track={track} announce={announce} />;
    case "Students": return track === "ESL" ? <ESLStudentsArea announce={announce} /> : <IELTSStudentsArea announce={announce} />;
    case "Lessons": return <LessonsArea track={track} announce={announce} />;
    case "Lesson Planner": return <LessonPlannerArea track={track} announce={announce} />;
    case "Homework": return <HomeworkArea track={track} announce={announce} />;
    case "Assessments": return <AssessmentsArea track={track} announce={announce} />;
    case "ESL Progress": return <ESLProgressArea announce={announce} />;
    case "IELTS Progress": return <IELTSProgressArea announce={announce} />;
    case "Language Skills": return <LanguageSkillsArea announce={announce} />;
    case "Writing Tracker": return <WritingTrackerArea announce={announce} />;
    case "Speaking Tracker": return <SpeakingTrackerArea announce={announce} />;
    case "Calendar": return <CalendarArea announce={announce} />;
    case "Tasks": return <TasksArea announce={announce} />;
    case "Goals": return <GoalsArea announce={announce} />;
    case "Projects": return <ProjectsArea announce={announce} />;
    case "Reports": return <ReportsArea track={track} announce={announce} />;
    case "Materials": return <MaterialsArea track={track} announce={announce} />;
  }
}

function PanelHeader({ kicker, title, action }: { kicker: string; title: string; action?: React.ReactNode }) {
  return <div className="panel-head"><div><span className="section-kicker">{kicker}</span><h2>{title}</h2></div>{action}</div>;
}

function TodayArea({ track, announce }: { track: Track; announce: Announce }) {
  const [readiness, setReadiness] = useState([true, false, false]);
  const dayBlocks = track === "ESL" ? [
    { time: "09:20", duration: "25 min", title: "ESL planning check", meta: "Review CEFR outcomes and materials", kind: "focus", icon: Target },
    { time: "10:00", duration: "60 min", title: "Elif Demir", meta: "B1 · Workplace small talk", kind: "lesson done", icon: Video },
    { time: "11:15", duration: "20 min", title: "Elif notes + homework", meta: "Communicative outcome recorded", kind: "admin done", icon: PenLine },
    { time: "15:10", duration: "25 min", title: "Check vocabulary practice", meta: "Arda · Unit 6 retrieval", kind: "homework", icon: ClipboardCheck },
    { time: "16:20", duration: "30 min", title: "Prepare story cards", meta: "A2 mystery lesson", kind: "focus current", icon: NotebookPen },
    { time: "17:00", duration: "60 min", title: "Arda Çelik", meta: "A2 · Mystery story grammar", kind: "lesson next", icon: Video },
  ] : [
    { time: "12:45", duration: "30 min", title: "Score speaking recording", meta: "Zeynep · Fluency and coherence", kind: "homework", icon: Mic2 },
    { time: "13:30", duration: "60 min", title: "Zeynep Kaya", meta: "Speaking mock · Parts 1–3", kind: "lesson done", icon: Video },
    { time: "14:40", duration: "25 min", title: "Enter mock bands", meta: "Criterion scores + feedback", kind: "admin done", icon: Gauge },
    { time: "18:15", duration: "40 min", title: "Deniz lesson prep", meta: "Finalize Task 2 model paragraph", kind: "focus current", icon: NotebookPen },
    { time: "19:00", duration: "60 min", title: "Deniz Yalçın", meta: "Writing Task 2 · Band 6 → 7", kind: "lesson next", icon: Video },
    { time: "20:10", duration: "20 min", title: "Assign timed writing", meta: "40-minute Task 2 response", kind: "homework", icon: PenLine },
  ];
  return <section className="today-workspace">
    <article className="panel day-agenda">
      <PanelHeader kicker={`${track} timeline`} title={`Sunday’s ${track} agenda`} action={<button className="filter-button" onClick={() => announce(`${track} agenda view opened`)}>Day <ChevronDown size={14} /></button>} />
      <div className="day-blocks">{dayBlocks.map((block) => { const Icon = block.icon; return <button key={`${block.time}-${block.title}`} className={`day-block ${block.kind.replace(" ", "-")}`} onClick={() => announce(`${block.title} opened`)}><div className="day-time"><strong>{block.time}</strong><span>{block.duration}</span></div><span className="day-line" /><span className="day-icon"><Icon size={16} /></span><div><strong>{block.title}</strong><span>{block.meta}</span></div>{block.kind.includes("done") ? <span className="mini-status mint"><Check size={11} /> Done</span> : block.kind.includes("next") ? <span className="mini-status violet">Next up</span> : <ChevronRight size={16} />}</button>; })}</div>
    </article>
    <aside className="today-side">
      <article className="panel readiness-panel"><PanelHeader kicker={`${track} readiness`} title={`Today is ${track === "ESL" ? "82" : "71"}% ready`} /><div className="readiness-score"><div className="readiness-ring light" style={{ "--progress": track === "ESL" ? "82" : "71" } as React.CSSProperties}><strong>{track === "ESL" ? "82" : "71"}%</strong><span>ready</span></div><p>{track === "ESL" ? "One material action will make both ESL classes ready." : "Finish one model and one mock score before the next IELTS class."}</p></div><div className="readiness-list">{[[track === "ESL" ? "Target language set" : "Homework marked",track === "ESL" ? "Both lessons aligned to CEFR" : "1 of 2 scripts complete"],[track === "ESL" ? "Arda materials" : "Deniz model",track === "ESL" ? "Print story cards" : "Finish Band 7 paragraph"],[track === "ESL" ? "Production task" : "Zeynep bands",track === "ESL" ? "Add six-minute story retell" : "Enter criterion scores"]].map(([title,meta],index)=><button key={title} className={readiness[index] ? "done" : ""} onClick={()=>{setReadiness(items=>items.map((value,itemIndex)=>itemIndex===index?!value:value)); announce(`${title} ${readiness[index]?"reopened":"completed"}`, false);}}>{readiness[index]?<Check size={14}/>:<Circle size={14}/>}<span><strong>{title}</strong><small>{meta}</small></span></button>)}</div></article>
      <article className="panel energy-plan"><PanelHeader kicker="Energy plan" title="Protect your focus" /><div className="energy-row"><span>09</span><i className="high"/><span>12</span><i className="low"/><span>15</span><i className="mid"/><span>18</span><i className="high"/><span>21</span></div><p>Your strongest focus window is 18:05–18:50. It is already reserved for lesson prep.</p></article>
      <button className="day-capture" onClick={() => announce("Create new quick note")}><Plus size={17} /><span><strong>Capture a quick note</strong><small>Task, idea or student follow-up</small></span><Command size={14} /></button>
    </aside>
  </section>;
}

const students = [
  { initials: "DY", name: "Deniz Yalçın", program: "IELTS Academic", level: "6.0 → 7.0", next: "Today · 19:00", hw: "Submitted", progress: 72, tone: "violet" },
  { initials: "ED", name: "Elif Demir", program: "General English", level: "B1", next: "Tue · 10:00", hw: "Returned", progress: 84, tone: "mint" },
  { initials: "AÇ", name: "Arda Çelik", program: "Young Learner ESL", level: "A2", next: "Today · 17:00", hw: "Late", progress: 61, tone: "amber" },
  { initials: "ZK", name: "Zeynep Kaya", program: "IELTS Academic", level: "5.5 → 6.5", next: "Wed · 13:30", hw: "To check", progress: 69, tone: "blue" },
  { initials: "MB", name: "Mert Bulut", program: "General English", level: "B2", next: "Mon · 16:00", hw: "Assigned", progress: 79, tone: "violet" },
  { initials: "SA", name: "Selin Acar", program: "Conversation", level: "B1+", next: "Thu · 18:00", hw: "Returned", progress: 87, tone: "mint" },
  { initials: "DK", name: "Derya Koç", program: "General English", level: "A1", next: "Wed · 09:00", hw: "Assigned", progress: 73, tone: "blue" },
  { initials: "KY", name: "Kerem Yıldız", program: "Teen English", level: "A2+", next: "Fri · 17:00", hw: "Submitted", progress: 67, tone: "amber" },
];

function ESLStudentsArea({ announce }: { announce: Announce }) {
  const [query, setQuery] = useState("");
  const [levelGroup, setLevelGroup] = useState("All");
  const filtered = students.filter((student) => !student.program.includes("IELTS") && (levelGroup === "All" || (levelGroup === "A1–A2" ? student.level.startsWith("A") : student.level.startsWith("B"))) && student.name.toLowerCase().includes(query.toLowerCase()));
  return <section className="students-workspace">
    <article className="panel students-table-panel">
      <div className="table-tools"><label><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find an ESL student..." /></label><div className="segmented">{["All","A1–A2","B1–B2"].map((item) => <button key={item} className={levelGroup === item ? "active" : ""} onClick={() => setLevelGroup(item)}>{item}</button>)}</div><button className="filter-button" onClick={()=>announce("ESL age and course filters opened")}><Filter size={14} /> Age / course</button></div>
      <div className="student-table"><div className="student-table-head"><span>ESL student</span><span>Course / CEFR</span><span>Next lesson</span><span>Homework</span><span>Mastery</span><span /></div>{filtered.map((student) => <button className="student-table-row" key={student.name} onClick={() => announce(`${student.name} ESL profile opened`)}><span className={`avatar avatar-${student.tone}`}>{student.initials}</span><span className="student-name"><strong>{student.name}</strong><small>1:1 ESL learner</small></span><span><strong>{student.program}</strong><small>CEFR {student.level}</small></span><span><strong>{student.next}</strong><small>{student.level.startsWith("A") ? "Grammar + speaking" : "Fluency + vocabulary"}</small></span><span><em className={`hw-state ${student.hw.toLowerCase().replace(" ", "-")}`}>{student.hw}</em></span><span className="table-progress"><i><em style={{ width: `${student.progress}%` }} /></i><b>{student.progress}%</b></span><ChevronRight size={16} /></button>)}</div>
    </article>
    <aside className="student-insights"><article className="panel attention-students"><PanelHeader kicker="ESL attention" title="Follow up this week" /><button onClick={() => announce("Arda’s CEFR follow-up opened")}><span className="avatar avatar-small avatar-amber">AÇ</span><span><strong>Arda Çelik</strong><small>Vocabulary production falling</small></span><span className="risk-label">High</span></button><button onClick={() => announce("Kerem’s fluency follow-up opened")}><span className="avatar avatar-small avatar-blue">KY</span><span><strong>Kerem Yıldız</strong><small>Fluency confidence below plan</small></span><span className="risk-label medium">Watch</span></button></article><article className="panel cohort-card"><PanelHeader kicker="CEFR mix" title="11 ESL learners" /><div className="cohort-chart"><i className="cohort-esl"/><i className="cohort-ielts"/><i className="cohort-other"/></div><div className="cohort-legend"><span><i className="violet"/>A1–A2 <b>5</b></span><span><i className="blue"/>B1–B2 <b>6</b></span></div></article></aside>
  </section>;
}

function IELTSStudentsArea({ announce }: { announce: Announce }) {
  const candidates = [
    { initials:"DY", name:"Deniz Yalçın", current:"6.5", target:"7.0", test:"12 Oct · 64d", weakest:"Writing 6.0", mock:"6.5", ready:72, tone:"violet" },
    { initials:"ZK", name:"Zeynep Kaya", current:"6.0", target:"6.5", test:"21 Nov · 103d", weakest:"Writing 5.5", mock:"Speaking due", ready:69, tone:"blue" },
    { initials:"EA", name:"Ece Aksoy", current:"7.0", target:"7.0", test:"28 Sep · 50d", weakest:"Writing 6.5", mock:"7.0", ready:91, tone:"mint" },
    { initials:"CT", name:"Can Tunç", current:"6.0", target:"6.5", test:"14 Dec · 127d", weakest:"Reading 5.5", mock:"6.0", ready:63, tone:"amber" },
    { initials:"BK", name:"Buse Kılıç", current:"5.5", target:"6.5", test:"6 Jan · 150d", weakest:"Writing 5.0", mock:"5.5", ready:48, tone:"amber" },
  ];
  const [query,setQuery]=useState("");
  const [filter,setFilter]=useState("All");
  const [target,setTarget]=useState("All targets");
  const shown=candidates.filter(candidate=>candidate.name.toLowerCase().includes(query.toLowerCase())&&(filter==="All"||filter==="Test ≤ 60d"&&Number(candidate.test.match(/(\d+)d/)?.[1]??999)<=60||filter==="At risk"&&candidate.ready<65)&&(target==="All targets"||candidate.target===target));
  const cycleTarget=()=>setTarget(value=>value==="All targets"?"6.5":value==="6.5"?"7.0":"All targets");
  return <section className="students-workspace ielts-students-workspace"><article className="panel students-table-panel"><div className="table-tools"><label><Search size={16}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Find an IELTS candidate..."/></label><div className="segmented">{["All","Test ≤ 60d","At risk"].map(item=><button key={item} className={filter===item?"active":""} onClick={()=>setFilter(item)}>{item}</button>)}</div><button className="filter-button" onClick={cycleTarget}><Filter size={14}/> {target}</button></div><div className="candidate-table"><div className="candidate-head"><span>Candidate</span><span>Current → target</span><span>Test date</span><span>Weakest skill</span><span>Latest mock</span><span>Readiness</span><span/></div>{shown.map(candidate=><button className="candidate-row" key={candidate.name} onClick={()=>announce(`${candidate.name} IELTS profile opened`)}><span className={`avatar avatar-${candidate.tone}`}>{candidate.initials}</span><span className="candidate-name"><strong>{candidate.name}</strong><small>IELTS Academic</small></span><span><b>{candidate.current}</b><ArrowRight size={12}/><strong>{candidate.target}</strong></span><span><strong>{candidate.test}</strong><small>{candidate.test.includes("50d")?"Priority date":"Official test"}</small></span><span><em className="weak-skill">{candidate.weakest}</em></span><span><strong>{candidate.mock}</strong><small>overall band</small></span><span className="candidate-ready"><i><em style={{width:`${candidate.ready}%`}}/></i><b>{candidate.ready}%</b></span><ChevronRight size={15}/></button>)}</div>{!shown.length&&<div className="table-empty"><Search size={22}/><strong>No candidates match</strong><span>Change the search or band filter.</span></div>}</article><aside className="student-insights"><article className="panel attention-students"><PanelHeader kicker="Test risk" title="Candidates to intervene"/><button onClick={()=>announce("Buse intervention opened")}><span className="avatar avatar-small avatar-amber">BK</span><span><strong>Buse Kılıç</strong><small>1.0 band below target</small></span><span className="risk-label">High</span></button><button onClick={()=>announce("Can intervention opened")}><span className="avatar avatar-small avatar-blue">CT</span><span><strong>Can Tunç</strong><small>Reading accuracy plateau</small></span><span className="risk-label medium">Watch</span></button></article><article className="panel cohort-card"><PanelHeader kicker="Candidate mix" title="7 IELTS students"/><div className="cohort-chart"><i className="cohort-ielts"/><i className="cohort-esl"/><i className="cohort-other"/></div><div className="cohort-legend"><span><i className="violet"/>On target <b>5</b></span><span><i className="blue"/>At risk <b>2</b></span></div></article></aside></section>;
}

function LessonsArea({ track, announce }: { track: Track; announce: Announce }) {
  const lessons = track === "ESL" ? [
    ["Today · 10:00", "Elif Demir", "Workplace small talk", "60 min", "Complete"],
    ["Sat · 18:00", "Mert Bulut", "B2 article discussion", "60 min", "Complete"],
    ["Fri · 16:00", "Arda Çelik", "Past continuous mystery", "60 min", "Complete"],
    ["Thu · 18:00", "Selin Acar", "Conversation repair strategies", "60 min", "Complete"],
    ["Wed · 09:00", "Derya Koç", "Daily routines and schedules", "60 min", "Notes due"],
  ] : [
    ["Today · 13:30", "Zeynep Kaya", "Speaking full mock", "60 min", "Complete"],
    ["Fri · 19:00", "Deniz Yalçın", "Task 2 opinion essays", "60 min", "Notes due"],
    ["Thu · 14:00", "Ece Aksoy", "Reading · Matching headings", "60 min", "Complete"],
    ["Wed · 17:30", "Can Tunç", "Listening · Maps and plans", "60 min", "Complete"],
    ["Tue · 19:00", "Buse Kılıç", "Task 1 overview statements", "60 min", "Complete"],
  ];
  return <section className="area-layout lessons-layout"><article className="panel lesson-records"><PanelHeader kicker={`${track} lesson history`} title={`Recent ${track} lessons`} action={<div className="panel-actions"><button className="filter-button" onClick={()=>announce(`${track} lesson month filter opened`)}><CalendarDays size={14} /> August</button><button className="filter-button" onClick={()=>announce(`${track} lesson filters opened`)}><Filter size={14} /> {track === "ESL" ? "CEFR level" : "Skill"}</button></div>} /><div className="record-head"><span>Date</span><span>Student</span><span>{track === "ESL" ? "Language outcome" : "Question type / focus"}</span><span>Length</span><span>Status</span><span /></div>{lessons.map((lesson) => <button className="record-row" key={`${lesson[0]}-${lesson[1]}`} onClick={() => announce(`${lesson[1]} ${track} lesson record opened`)}>{lesson.slice(0,5).map((value,index) => <span key={value}>{index === 1 ? <><strong>{value}</strong><small>{track === "ESL" ? "ESL · CEFR" : "IELTS Academic"}</small></> : index === 4 ? <em className={`record-status ${value === "Notes due" ? "amber" : "mint"}`}>{value}</em> : value}</span>)}<ChevronRight size={16} /></button>)}</article><aside className="area-side-panel"><article className="panel lesson-month"><PanelHeader kicker="August" title={`${track} lesson activity`} /><div className="big-number">{track === "ESL" ? "21" : "13"} <small>lessons</small></div><div className="spark-bars">{[45,60,38,75,58,86,72,42,65,82,54,70].map((height,index)=><i key={index} className={index > 8 ? "active" : ""} style={{height:`${height}%`}} />)}</div><div className="lesson-month-footer"><span><b>{track === "ESL" ? "20" : "12"}</b> Delivered</span><span><b>1</b> Rescheduled</span><span><b>{track === "ESL" ? "97%" : "94%"}</b> Attendance</span></div></article><button className="mini-tip" onClick={()=>announce(`${track === "ESL" ? "CEFR notes" : "Band scores"} opened`)}><MessageSquareText size={17}/><div><strong>{track === "ESL" ? "2 CEFR notes pending" : "2 band scores pending"}</strong><p>{track === "ESL" ? "Record what students could use independently." : "Enter criterion scores while evidence is fresh."}</p></div><ChevronRight size={15}/></button></aside></section>;
}

function LessonPlannerArea({ track, announce }: { track: Track; announce: Announce }) {
  const plan = track === "ESL" ? {
    student:"Arda · Today at 17:00", objective:"Use past simple and past continuous to narrate a six-step mystery with clear sequencing.", course:"Young Learner ESL", skill:"Grammar + speaking", level:"CEFR A2", target:"A2 mastery 80%", note:"Keep the grammar visual, then move quickly into story reconstruction and spoken production.", readiness:"84%",
    materials:[["Mystery sequencing cards","Print pack · 12 cards"],["A2 story language mat","One-page scaffold"],["Model story audio","Audio · 03:20"]],
    blocks:[{time:"00–07",title:"Retrieval warm-up",detail:"Past verbs from previous lesson",tone:"mint"},{time:"07–18",title:"Notice the contrast",detail:"Past simple vs past continuous",tone:"blue"},{time:"18–30",title:"Controlled reconstruction",detail:"Sequence the mystery cards",tone:"amber"},{time:"30–50",title:"Communicative production",detail:"Tell and question the mystery",tone:"mint"},{time:"50–60",title:"Feedback & transfer",detail:"Correct, retry and assign voice note",tone:"violet"}],
  } : {
    student:"Deniz · Today at 19:00", objective:"Build a clear position and support it with aligned topic sentences and developed examples.", course:"IELTS Academic", skill:"Writing Task 2", level:"Band 6.0", target:"Band 7.0", note:"Ask Deniz to justify the function of every sentence against Task Response and Coherence criteria.", readiness:"78%",
    materials:[["Task 2 planning sheet","PDF · 3 pages"],["Band 7 model answer","Criterion-annotated"],["Examiner walkthrough","Audio · 06:14"]],
    blocks:[{time:"00–08",title:"Score-aware warm-up",detail:"Recall last rubric feedback",tone:"violet"},{time:"08–20",title:"Diagnose two introductions",detail:"Compare Band 6 and Band 7",tone:"blue"},{time:"20–38",title:"Teach & model",detail:"Position + topic sentence alignment",tone:"mint"},{time:"38–53",title:"Timed guided practice",detail:"Plan one body paragraph",tone:"amber"},{time:"53–60",title:"Score & assign",detail:"Exit band + timed homework",tone:"violet"}],
  };
  const [blocks, setBlocks] = useState(plan.blocks);
  const [prepChecks,setPrepChecks]=useState([true,true,false,false]);
  return <section className="planner-workspace">
    <article className="panel planner-brief"><PanelHeader kicker={`${track} lesson brief`} title={plan.student} action={<span className="draft-label">Draft saved</span>} /><div className="planner-form"><label><span>{track === "ESL" ? "CEFR learning outcome" : "Band-score objective"}</span><textarea defaultValue={plan.objective} /></label><div className="form-row"><label><span>Course</span><input defaultValue={plan.course}/></label><label><span>{track === "ESL" ? "Language focus" : "Skill / task"}</span><input defaultValue={plan.skill}/></label></div><div className="form-row"><label><span>Current</span><input defaultValue={plan.level} /></label><label><span>{track === "ESL" ? "Mastery target" : "Target band"}</span><input defaultValue={plan.target} /></label></div><label><span>Teacher note</span><textarea className="short" defaultValue={plan.note} /></label><button className="ai-plan-button" onClick={() => announce(`${track} lesson suggestions refreshed`)}><WandSparkles size={16} /> Suggest from {track === "ESL" ? "CEFR gaps" : "recent rubric gaps"}</button></div></article>
    <article className="panel lesson-rundown"><PanelHeader kicker={track === "ESL" ? "ESA-aligned rundown" : "Score-focused rundown"} title="60-minute lesson flow" action={<button className="filter-button" onClick={() => { setBlocks([...blocks,{time:"60–65",title:"Extra review",detail:"Optional extension",tone:"blue"}]); announce(`${track} activity block added`, false); }}><Plus size={14}/> Add block</button>} /><div className="rundown-list">{blocks.map((block,index)=><div className="rundown-row" key={`${block.time}-${index}`}><span className="drag-handle">••</span><span className={`rundown-index ${block.tone}`}>{String(index+1).padStart(2,"0")}</span><div><strong>{block.title}</strong><small>{block.detail}</small></div><span className="rundown-time">{block.time} min</span><button aria-label={`Edit ${block.title}`} onClick={()=>announce(`${block.title} activity editor opened`)}><MoreHorizontal size={16}/></button></div>)}</div><div className="rundown-total"><span><Clock3 size={15}/> Total planned time</span><strong>{blocks.length > 5 ? "65" : "60"} min</strong></div></article>
    <aside className="planner-resources"><article className="panel"><PanelHeader kicker={`${track} materials`} title="Attached to this lesson" action={<button className="text-button" onClick={()=>announce(`Create new ${track} lesson material`)}><Plus size={13}/> Add</button>} /><div className="attached-list">{plan.materials.map(([name,meta],index)=><button key={name} onClick={()=>announce(`${name} material opened`)}><span className={`file-icon ${["violet","blue","mint"][index]}`}><FileText size={16}/></span><span><strong>{name}</strong><small>{meta}</small></span><ChevronRight size={15}/></button>)}</div></article><article className="panel prep-check"><PanelHeader kicker="Pre-class" title="Readiness check" />{["Homework reviewed",track === "ESL" ? "CEFR outcome is observable" : "Rubric gap is explicit",track === "ESL" ? "Production task prepared" : "Model paragraph finalized","Shared board opened"].map((label,index)=><button key={label} className={prepChecks[index]?"done":""} onClick={()=>{setPrepChecks(items=>items.map((value,itemIndex)=>itemIndex===index?!value:value));announce(`${label} ${prepChecks[index]?"reopened":"completed"}`, false);}}>{prepChecks[index]?<Check size={13}/>:<Circle size={13}/>} {label}</button>)}<div className="prep-score"><span>{track} lesson readiness</span><strong>{Math.round(prepChecks.filter(Boolean).length/4*100)}%</strong></div></article><button className="primary-button planner-save" onClick={() => announce(`${track} lesson plan saved and marked ready`)}><CheckCircle2 size={16}/> Save & mark ready</button></aside>
  </section>;
}

function HomeworkArea({ track, announce }: { track: Track; announce: Announce }) {
  const initial = track === "ESL" ? {
    assigned: [{id:1,name:"Elif Demir",task:"Weekly reflection voice note",due:"Tue",tone:"mint"},{id:2,name:"Derya Koç",task:"Daily routine picture sequence",due:"Wed",tone:"blue"}],
    submitted: [{id:3,name:"Kerem Yıldız",task:"Weekend story recording",due:"Today",tone:"violet"}],
    checking: [{id:4,name:"Arda Çelik",task:"Unit 6 vocabulary retrieval",due:"Late · 2d",tone:"amber"}],
    returned: [{id:5,name:"Mert Bulut",task:"B2 article response",due:"Returned",tone:"violet"}],
  } : {
    assigned: [{id:1,name:"Ece Aksoy",task:"Reading matching headings set",due:"Tue",tone:"mint"}],
    submitted: [{id:2,name:"Deniz Yalçın",task:"Task 2 timed response",due:"Today",tone:"violet"},{id:3,name:"Zeynep Kaya",task:"Speaking Part 2 recording",due:"Yesterday",tone:"blue"}],
    checking: [{id:4,name:"Can Tunç",task:"Listening Section 2 error log",due:"Today",tone:"amber"}],
    returned: [{id:5,name:"Buse Kılıç",task:"Task 1 overview rewrite",due:"Returned",tone:"violet"}],
  };
  const [board, setBoard] = useState(initial);
  const advance = (column: keyof typeof initial, id: number) => {
    const order: Array<keyof typeof initial> = ["assigned","submitted","checking","returned"];
    const index = order.indexOf(column);
    const item = board[column].find((entry) => entry.id === id);
    if (!item) return;
    if (index === order.length - 1) { announce(`${item.name} ${track} homework record opened`); return; }
    setBoard({...board,[column]:board[column].filter((entry)=>entry.id!==id),[order[index+1]]:[...board[order[index+1]],item]});
    announce(`${track} ${track === "ESL" ? "homework" : "assignment"} moved to ${order[index+1]}`);
  };
  const labels: Record<keyof typeof initial,string> = {assigned:"Assigned",submitted:"Submitted",checking:"Checking",returned:"Returned"};
  return <section className="homework-board">{(Object.keys(board) as Array<keyof typeof initial>).map((column)=><article className="homework-column" key={column}><div className="homework-column-head"><span className={`column-dot ${column}`}/><strong>{labels[column]}</strong><b>{board[column].length}</b><button onClick={()=>announce(`Create new ${track} ${track === "ESL" ? "homework" : "assignment"}`)} aria-label={`Add to ${labels[column]}`}><Plus size={15}/></button></div><div className="homework-cards">{board[column].map((item)=><button key={item.id} className="homework-card" onClick={()=>advance(column,item.id)}><div><span className={`avatar avatar-small avatar-${item.tone}`}>{item.name.split(" ").map(part=>part[0]).join("")}</span><MoreHorizontal size={16}/></div><h3>{item.task}</h3><p>{item.name} · {track}</p><footer><span className={item.due.includes("Late") ? "late" : ""}><Clock3 size={13}/>{item.due}</span><span>{column === "submitted" ? (track === "ESL" ? "Check mastery" : "Open to mark") : column === "checking" ? "Return feedback" : column === "assigned" ? "Mark submitted" : "Open record"}<ArrowRight size={13}/></span></footer></button>)}<button className="add-homework-card" onClick={()=>announce(`Create new ${track} ${track === "ESL" ? "homework" : "assignment"}`)}><Plus size={14}/> Add {track === "ESL" ? "homework" : "assignment"}</button></div></article>)}</section>;
}

function AssessmentsArea({ track, announce }: { track: Track; announce: Announce }) {
  const assessments = track === "ESL" ? [
    { name: "Elif Demir", title: "B1 communicative progress check", type: "CEFR performance", submitted: "Today · 10:48", progress: 60, icon: MessageSquareText, tone: "mint" },
    { name: "Arda Çelik", title: "Unit 6 language mastery check", type: "Grammar + vocabulary", submitted: "Today · 09:14", progress: 0, icon: FileCheck2, tone: "amber" },
    { name: "Kerem Yıldız", title: "A2+ speaking confidence check", type: "Recorded production", submitted: "Yesterday · 17:20", progress: 25, icon: Mic2, tone: "blue" },
  ] : [
    { name: "Zeynep Kaya", title: "IELTS Speaking full mock", type: "Parts 1–3", submitted: "Yesterday · 18:42", progress: 35, icon: Mic2, tone: "blue" },
    { name: "Deniz Yalçın", title: "Writing Task 2 timed response", type: "40-minute section", submitted: "Today · 12:10", progress: 70, icon: PenLine, tone: "violet" },
    { name: "Can Tunç", title: "Listening Section 2 test", type: "Raw score → band", submitted: "Today · 09:14", progress: 0, icon: Headphones, tone: "amber" },
  ];
  return <section className="assessment-layout">
    <article className="panel marking-queue"><PanelHeader kicker={track === "ESL" ? "Mastery review queue" : "Mock marking queue"} title={track === "ESL" ? "ESL progress checks awaiting feedback" : "IELTS mocks and timed sections"} action={<button className="filter-button" onClick={()=>announce(`${track} assessment filters opened`)}><Filter size={14}/> {track === "ESL" ? "CEFR level" : "Skill / mock"}</button>} /><div className="assessment-list">{assessments.map((item)=>{const Icon=item.icon;return <button key={item.title} onClick={()=>announce(`${item.title} opened for ${track === "ESL" ? "mastery review" : "band marking"}`)}><span className={`assessment-icon ${item.tone}`}><Icon size={18}/></span><div className="assessment-copy"><strong>{item.title}</strong><span>{item.name} · {item.type}</span><small>{item.submitted}</small></div><div className="marking-progress"><span><i style={{width:`${item.progress}%`}}/></span><small>{item.progress ? `${item.progress}% ${track === "ESL" ? "reviewed" : "marked"}` : "Not started"}</small></div><span className="mark-button">{track === "ESL" ? "Review" : "Mark bands"} <ArrowRight size={14}/></span></button>})}</div>
    </article>
    <aside className="assessment-side"><article className="panel score-consistency"><PanelHeader kicker={track === "ESL" ? "Evidence quality" : "Scoring quality"} title={track === "ESL" ? "CEFR assessment health" : "IELTS marking consistency"} /><div className="consistency-score"><strong>{track === "ESL" ? "91%" : "94%"}</strong><span>{track === "ESL" ? "observable evidence" : "rubric consistency"}</span></div><div className="consistency-bars"><span>{track === "ESL" ? "Language accuracy" : "Task response"}<i><em style={{width:"96%"}}/></i><b>96%</b></span><span>{track === "ESL" ? "Independent use" : "Band evidence"}<i><em style={{width:"91%"}}/></i><b>91%</b></span><span>Feedback usefulness<i><em style={{width:"95%"}}/></i><b>95%</b></span></div></article><article className="panel upcoming-mocks"><PanelHeader kicker="Scheduled" title={track === "ESL" ? "Upcoming progress checks" : "Upcoming IELTS mocks"} /><button onClick={()=>announce(`${track} assessment opened`)}><span><strong>16 Aug</strong><small>Sun</small></span><div><strong>{track === "ESL" ? "Arda · A2 unit mastery" : "Deniz · Full IELTS mock"}</strong><small>{track === "ESL" ? "17:00–17:35" : "08:30–11:30"}</small></div><ChevronRight size={15}/></button><button onClick={()=>announce(`${track} assessment opened`)}><span><strong>20 Aug</strong><small>Thu</small></span><div><strong>{track === "ESL" ? "Elif · B1 progress check" : "Zeynep · Speaking re-mock"}</strong><small>{track === "ESL" ? "10:00–10:45" : "13:30–13:50"}</small></div><ChevronRight size={15}/></button></article></aside>
  </section>;
}

const eslLearners = [
  { name:"Elif Demir", level:"B1", target:"B2", overall:84, change:"+8%", skills:[82,78,88,74,86,91], tone:"mint" },
  { name:"Arda Çelik", level:"A2", target:"B1", overall:61, change:"+5%", skills:[68,54,63,59,58,65], tone:"amber" },
  { name:"Mert Bulut", level:"B2", target:"C1", overall:79, change:"+6%", skills:[81,77,83,85,72,76], tone:"violet" },
  { name:"Selin Acar", level:"B1+", target:"B2", overall:87, change:"+10%", skills:[90,84,81,86,89,92], tone:"blue" },
];

function ESLProgressArea({ announce }: { announce: Announce }) {
  const skills=["Grammar","Vocabulary","Speaking","Listening","Reading","Confidence"];
  return <section className="progress-workspace"><article className="panel progress-matrix"><PanelHeader kicker="CEFR skill matrix" title="Active ESL learners" action={<div className="panel-actions"><button className="filter-button" onClick={()=>announce("CEFR level filters opened")}>All levels <ChevronDown size={13}/></button><button className="filter-button" onClick={()=>announce("CEFR progress period opened")}><CalendarDays size={13}/> 8 weeks</button></div>} /><div className="matrix-scroll"><div className="progress-head"><span>Student</span>{skills.map(skill=><span key={skill}>{skill}</span>)}<span>Overall</span></div>{eslLearners.map((learner)=><button className="progress-row" key={learner.name} onClick={()=>announce(`${learner.name} progress profile opened`)}><span className="learner-cell"><i className={`avatar avatar-small avatar-${learner.tone}`}>{learner.name.split(" ").map(part=>part[0]).join("")}</i><span><strong>{learner.name}</strong><small>{learner.level} → {learner.target}</small></span></span>{learner.skills.map((value,index)=><span className="skill-cell" key={skills[index]}><i><em className={value<60?"amber":value>84?"mint":"violet"} style={{width:`${value}%`}}/></i><b>{value}</b></span>)}<span className="overall-cell"><strong>{learner.overall}%</strong><small>{learner.change}</small></span></button>)}</div></article><aside className="progress-side"><article className="panel skill-insight"><PanelHeader kicker="Insight" title="What to teach next" /><span className="insight-icon"><Sparkles size={20}/></span><h3>Recycle active vocabulary</h3><p>Arda recognizes new words but uses only 42% of them spontaneously. Build retrieval practice into his next three lessons.</p><button className="secondary-button" onClick={()=>announce("Create new vocabulary recycling mini-plan")}>Create mini-plan</button></article><article className="panel cefr-distribution"><PanelHeader kicker="Level mix" title="CEFR distribution" /><div className="level-bars">{[["A1",1,18],["A2",3,48],["B1",4,72],["B2",3,54],["C1",0,4]].map(([level,count,width])=><span key={level}><b>{level}</b><i><em style={{width:`${width}%`}}/></i><strong>{count}</strong></span>)}</div></article></aside></section>;
}

function IELTSProgressArea({ announce }: { announce: Announce }) {
  const candidates=[
    {name:"Deniz Yalçın",test:"12 Oct",scores:[6.5,7,6,6.5],overall:6.5,target:7,tone:"violet"},
    {name:"Zeynep Kaya",test:"21 Nov",scores:[6,6.5,5.5,6],overall:6,target:6.5,tone:"blue"},
    {name:"Ece Aksoy",test:"28 Sep",scores:[7.5,7,6.5,7],overall:7,target:7,tone:"mint"},
    {name:"Can Tunç",test:"14 Dec",scores:[6,5.5,5.5,6],overall:6,target:6.5,tone:"amber"},
  ];
  return <section className="ielts-workspace"><article className="panel ielts-matrix"><PanelHeader kicker="Band score matrix" title="IELTS Academic candidates" action={<button className="filter-button" onClick={()=>announce("IELTS score period opened")}><CalendarDays size={14}/> Latest scores</button>} /><div className="ielts-head"><span>Candidate</span><span>Listening</span><span>Reading</span><span>Writing</span><span>Speaking</span><span>Overall</span><span>Target</span></div>{candidates.map((candidate)=><button className="ielts-row" key={candidate.name} onClick={()=>announce(`${candidate.name} IELTS tracker opened`)}><span className="candidate-cell"><i className={`avatar avatar-small avatar-${candidate.tone}`}>{candidate.name.split(" ").map(part=>part[0]).join("")}</i><span><strong>{candidate.name}</strong><small>Test · {candidate.test}</small></span></span>{candidate.scores.map((score,index)=><span key={index} className={score<6?"low-band":score>=7?"high-band":""}><b>{score.toFixed(1)}</b><small>{index===2 && score<6.5?"Focus":""}</small></span>)}<span className="overall-band"><b>{candidate.overall.toFixed(1)}</b></span><span><strong>{candidate.target.toFixed(1)}</strong><i><em style={{width:`${Math.min(100,(candidate.overall/candidate.target)*100)}%`}}/></i></span></button>)}</article><div className="ielts-bottom"><article className="panel band-trend"><PanelHeader kicker="12-week trend" title="Average band movement" action={<span className="trend-up"><TrendingUp size={14}/> +0.6</span>} /><div className="line-chart"><div className="chart-y"><span>7.0</span><span>6.5</span><span>6.0</span><span>5.5</span></div><div className="chart-plot"><i/><i/><i/><i/><svg viewBox="0 0 500 120" preserveAspectRatio="none" aria-hidden="true"><polyline points="0,105 55,95 110,88 165,82 220,70 275,72 330,55 385,43 440,35 500,25" fill="none" stroke="#6558d7" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/></svg><div className="chart-labels"><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span></div></div></div></article><article className="panel band-focus"><PanelHeader kicker="Weakest skill" title="Writing is the bottleneck" /><div className="focus-band-number"><strong>5.8</strong><span>cohort average</span></div><p>Task response and paragraph development are blocking overall band gains for 4 of 7 candidates.</p><button className="secondary-button" onClick={()=>announce("Writing intervention report opened")}>View intervention plan</button></article></div></section>;
}

function LanguageSkillsArea({ announce }: { announce: Announce }) {
  const [period,setPeriod]=useState("Current unit");
  const systems = [
    { skill:"Grammar", focus:"Past simple vs continuous", recognition:82, controlled:71, independent:58, review:"Today", tone:"amber" },
    { skill:"Vocabulary", focus:"Mystery + sequencing verbs", recognition:68, controlled:61, independent:49, review:"Today", tone:"amber" },
    { skill:"Pronunciation", focus:"-ed endings", recognition:76, controlled:69, independent:63, review:"Fri", tone:"blue" },
    { skill:"Speaking", focus:"Narrative fluency", recognition:74, controlled:65, independent:57, review:"Today", tone:"violet" },
    { skill:"Listening", focus:"Story sequence detail", recognition:72, controlled:70, independent:66, review:"Next unit", tone:"mint" },
    { skill:"Reading", focus:"Short narrative inference", recognition:79, controlled:74, independent:70, review:"Next unit", tone:"mint" },
    { skill:"Writing", focus:"Six-sentence narrative", recognition:65, controlled:59, independent:51, review:"Tue", tone:"blue" },
    { skill:"Confidence", focus:"Retell without notes", recognition:70, controlled:62, independent:55, review:"Today", tone:"violet" },
  ];
  return <section className="language-skills-workspace"><article className="panel language-system-panel"><div className="language-student-bar"><div><span className="avatar avatar-amber">AÇ</span><span><strong>Arda Çelik</strong><small>Young Learner ESL · CEFR A2 · {period}</small></span></div><div className="segmented">{["Current unit","8 weeks","All time"].map(item=><button key={item} className={period===item?"active":""} onClick={()=>setPeriod(item)}>{item}</button>)}</div><button className="filter-button" onClick={()=>announce("ESL student selector opened")}>Change student <ChevronDown size={13}/></button></div><div className="language-system-head"><span>Language system / skill</span><span>Recognizes</span><span>Controlled use</span><span>Independent use</span><span>Review</span><span/></div>{systems.map(system=><button className="language-system-row" key={system.skill} onClick={()=>announce(`${system.skill} evidence opened`)}><span className={`system-icon ${system.tone}`}><Activity size={15}/></span><span><strong>{system.skill}</strong><small>{system.focus}</small></span>{[[system.recognition,"recognition"],[system.controlled,"controlled"],[system.independent,"independent"]].map(([value,label])=><span className={`evidence-meter ${label}`} key={label as string}><i><em style={{width:`${value}%`}}/></i><b>{value}%</b></span>)}<span className={system.review==="Today"?"review-today":""}>{system.review}</span><ChevronRight size={15}/></button>)}</article><aside className="language-side"><article className="panel production-gap-card"><PanelHeader kicker="Key diagnostic" title="Production gap"/><div className="gap-visual"><span><strong>75%</strong><small>understands</small></span><ArrowRight size={18}/><span className="gap-low"><strong>58%</strong><small>uses alone</small></span></div><p>Arda’s knowledge is not transferring consistently into spontaneous speaking. Prioritize retrieval and repeated production.</p><button className="secondary-button" onClick={()=>announce("Create new three-lesson production plan")}>Create 3-lesson plan</button></article><article className="panel recycle-card"><PanelHeader kicker="Spaced review" title="14 items due"/><div className="recycle-list"><span><i className="amber"/>Vocabulary <b>6</b></span><span><i className="violet"/>Grammar patterns <b>4</b></span><span><i className="blue"/>Pronunciation <b>3</b></span><span><i className="mint"/>Functional phrases <b>1</b></span></div></article></aside></section>;
}

function WritingTrackerArea({ announce }: { announce: Announce }) {
  const writers=[
    {name:"Deniz Yalçın",task:"Task 2",scores:[6,6,6.5,6],average:6,target:7,tone:"violet",scripts:12},
    {name:"Zeynep Kaya",task:"Task 1",scores:[5.5,6,6,5.5],average:5.5,target:6.5,tone:"blue",scripts:8},
    {name:"Ece Aksoy",task:"Task 2",scores:[6.5,6.5,7,6.5],average:6.5,target:7,tone:"mint",scripts:10},
    {name:"Buse Kılıç",task:"Task 1",scores:[5,5.5,5.5,5],average:5,target:6.5,tone:"amber",scripts:8},
  ];
  return <section className="criterion-workspace"><article className="panel criterion-matrix"><PanelHeader kicker="IELTS Writing criteria" title="Latest criterion bands" action={<div className="panel-actions"><button className="filter-button" onClick={()=>announce("Writing task filters opened")}>All tasks <ChevronDown size={13}/></button><button className="filter-button" onClick={()=>announce("Latest marked Writing scripts opened")}>Latest marked</button></div>}/><div className="criterion-head"><span>Candidate</span><span>Task</span><span>TA / TR</span><span>CC</span><span>LR</span><span>GRA</span><span>Writing</span><span>Target</span></div>{writers.map(writer=><button className="criterion-row" key={writer.name} onClick={()=>announce(`${writer.name} Writing evidence opened`)}><span className={`avatar avatar-small avatar-${writer.tone}`}>{writer.name.split(" ").map(part=>part[0]).join("")}</span><span><strong>{writer.name}</strong><small>{writer.scripts} scripts</small></span><em>{writer.task}</em>{writer.scores.map((score,index)=><b key={index} className={score<6?"criterion-low":score>=7?"criterion-high":""}>{score.toFixed(1)}</b>)}<strong className="criterion-average">{writer.average.toFixed(1)}</strong><span className="criterion-target"><b>{writer.target.toFixed(1)}</b><i><em style={{width:`${writer.average/writer.target*100}%`}}/></i></span></button>)}</article><div className="criterion-bottom"><article className="panel error-patterns"><PanelHeader kicker="Recurring errors" title="What is suppressing Writing bands"/><div className="error-list">{[["Ideas not fully developed",14,"Task Response","amber"],["Weak paragraph progression",11,"Coherence","violet"],["Article and agreement errors",9,"Grammar","blue"],["Imprecise academic collocations",7,"Lexical","mint"]].map(([error,count,criterion,tone])=><button key={error as string} onClick={()=>announce(`${error} examples opened`)}><span className={`error-count ${tone}`}>{count}</span><span><strong>{error}</strong><small>{criterion} · last 8 weeks</small></span><ChevronRight size={15}/></button>)}</div></article><article className="panel recent-scripts"><PanelHeader kicker="Marking queue" title="2 scripts awaiting bands"/><button onClick={()=>announce("Deniz Task 2 opened for marking")}><span className="file-icon violet"><PenLine size={15}/></span><span><strong>Deniz · Task 2</strong><small>Submitted today · 287 words</small></span><span className="mini-status violet">Mark</span></button><button onClick={()=>announce("Zeynep Task 1 opened for marking")}><span className="file-icon blue"><AlignLeft size={15}/></span><span><strong>Zeynep · Task 1</strong><small>Submitted yesterday · 174 words</small></span><span className="mini-status violet">Mark</span></button></article></div></section>;
}

function SpeakingTrackerArea({ announce }: { announce: Announce }) {
  const speakers=[
    {name:"Deniz Yalçın",scores:[6.5,6.5,6,6.5],average:6.5,target:7,tone:"violet",part:"Part 3"},
    {name:"Zeynep Kaya",scores:[6,6,5.5,6.5],average:6,target:6.5,tone:"blue",part:"Part 2"},
    {name:"Ece Aksoy",scores:[7,7,6.5,7.5],average:7,target:7,tone:"mint",part:"Part 3"},
    {name:"Can Tunç",scores:[6,6,5.5,6],average:6,target:6.5,tone:"amber",part:"Part 2"},
  ];
  return <section className="criterion-workspace"><article className="panel criterion-matrix"><PanelHeader kicker="IELTS Speaking criteria" title="Latest speaking bands" action={<div className="panel-actions"><button className="filter-button" onClick={()=>announce("Speaking mock filters opened")}>Full mocks <ChevronDown size={13}/></button><button className="filter-button" onClick={()=>announce("Speaking score period opened")}>8 weeks</button></div>}/><div className="criterion-head speaking"><span>Candidate</span><span>Weakest part</span><span>Fluency</span><span>Lexical</span><span>Grammar</span><span>Pronunciation</span><span>Speaking</span><span>Target</span></div>{speakers.map(speaker=><button className="criterion-row" key={speaker.name} onClick={()=>announce(`${speaker.name} Speaking evidence opened`)}><span className={`avatar avatar-small avatar-${speaker.tone}`}>{speaker.name.split(" ").map(part=>part[0]).join("")}</span><span><strong>{speaker.name}</strong><small>Latest full mock</small></span><em>{speaker.part}</em>{speaker.scores.map((score,index)=><b key={index} className={score<6?"criterion-low":score>=7?"criterion-high":""}>{score.toFixed(1)}</b>)}<strong className="criterion-average">{speaker.average.toFixed(1)}</strong><span className="criterion-target"><b>{speaker.target.toFixed(1)}</b><i><em style={{width:`${speaker.average/speaker.target*100}%`}}/></i></span></button>)}</article><div className="criterion-bottom"><article className="panel speaking-parts"><PanelHeader kicker="Part performance" title="Average band by speaking part"/><div className="part-bars">{[["Part 1","6.6",88],["Part 2","6.0",72],["Part 3","6.2",78]].map(([part,band,width])=><button key={part as string} onClick={()=>announce(`${part} question-type detail opened`)}><span><strong>{part}</strong><small>{part==="Part 2"?"Fluency drops after 90 sec":"On target"}</small></span><i><em style={{width:`${width}%`}}/></i><b>{band}</b></button>)}</div></article><article className="panel recent-scripts"><PanelHeader kicker="Recording queue" title="1 mock awaiting bands"/><button onClick={()=>announce("Zeynep speaking mock opened")}><span className="file-icon blue"><Mic2 size={15}/></span><span><strong>Zeynep · Full mock</strong><small>18:42 · 14 min recording</small></span><span className="mini-status violet">Score</span></button><div className="speaking-insight"><AudioLines size={17}/><span><strong>Fluency signal</strong><small>Average hesitation frequency fell 18% this month.</small></span></div></article></div></section>;
}

function CalendarArea({ announce }: { announce: Announce }) {
  const [weekIndex,setWeekIndex]=useState(0);
  const [calendarView,setCalendarView]=useState("Week");
  const days=["Mon 10","Tue 11","Wed 12","Thu 13","Fri 14","Sat 15","Sun 16"];
  const events=[
    {day:0,top:21,height:42,title:"Elif",time:"10:00",tone:"mint"},{day:0,top:54,height:42,title:"Mert",time:"16:00",tone:"violet"},
    {day:1,top:29,height:42,title:"Zeynep",time:"11:30",tone:"blue"},{day:1,top:65,height:42,title:"Selin",time:"18:00",tone:"mint"},
    {day:2,top:11,height:54,title:"Planning block",time:"08:30",tone:"focus"},{day:2,top:39,height:42,title:"Arda",time:"14:00",tone:"amber"},
    {day:3,top:20,height:42,title:"Elif",time:"10:00",tone:"mint"},{day:3,top:47,height:42,title:"Deniz",time:"15:00",tone:"violet"},{day:3,top:68,height:42,title:"Selin",time:"18:30",tone:"blue"},
    {day:4,top:34,height:42,title:"Can",time:"13:00",tone:"amber"},{day:4,top:60,height:42,title:"Deniz",time:"17:30",tone:"violet"},
    {day:5,top:22,height:42,title:"Mert",time:"10:30",tone:"mint"},{day:6,top:9,height:73,title:"IELTS full mock",time:"08:30",tone:"blue"},{day:6,top:67,height:42,title:"Review block",time:"18:00",tone:"focus"},
  ];
  const weekLabels=["3–9 August 2026","10–16 August 2026","17–23 August 2026"];
  const visibleWeek=Math.max(-1,Math.min(1,weekIndex));
  return <section className="calendar-workspace"><article className={`panel week-calendar ${calendarView.toLowerCase()}-view`}><div className="calendar-toolbar"><div><button onClick={()=>setWeekIndex(value=>Math.max(-1,value-1))} aria-label="Previous week"><ChevronRight size={16} className="flip"/></button><button onClick={()=>setWeekIndex(value=>Math.min(1,value+1))} aria-label="Next week"><ChevronRight size={16}/></button><button className="today-button" onClick={()=>setWeekIndex(0)}>Today</button><strong>{calendarView==="Month"?"August 2026 overview":weekLabels[visibleWeek+1]}</strong></div><div className="segmented">{["Week","Month"].map(view=><button key={view} className={calendarView===view?"active":""} onClick={()=>setCalendarView(view)}>{view}</button>)}</div></div><div className="calendar-grid"><div className="time-axis">{["08","10","12","14","16","18","20"].map(time=><span key={time}>{time}:00</span>)}</div><div className="calendar-days">{days.map((day,index)=><div key={day} className={`calendar-day ${index===6?"selected":""}`}><header><span>{day.split(" ")[0]}</span><strong>{Number(day.split(" ")[1])+visibleWeek*7}</strong></header><div className="day-grid-lines">{[0,1,2,3,4,5,6].map(line=><i key={line}/>)}</div>{events.filter(event=>event.day===index).map(event=><button key={`${event.title}-${event.time}`} className={`calendar-event ${event.tone}`} style={{top:`${event.top}%`,height:`${event.height}px`}} onClick={()=>announce(`${event.title} event opened`)}><strong>{event.title}</strong><span>{event.time}</span></button>)}</div>)}</div></div></article><aside className="calendar-side"><article className="panel capacity-card"><PanelHeader kicker="Capacity" title="This week" /><div className="capacity-ring" style={{"--progress":"78"} as React.CSSProperties}><span><strong>78%</strong><small>booked</small></span></div><div className="capacity-legend"><span><i className="violet"/>Teaching <b>21h</b></span><span><i className="blue"/>Prep & marking <b>7h</b></span><span><i className="gray"/>Open <b>8h</b></span></div></article><article className="panel open-blocks"><PanelHeader kicker="Availability" title="Best open blocks" /><button onClick={()=>announce("Wednesday open block selected")}><span><strong>Wed 12 Aug</strong><small>11:00–13:30</small></span><b>2h 30m</b></button><button onClick={()=>announce("Friday open block selected")}><span><strong>Fri 14 Aug</strong><small>09:00–12:00</small></span><b>3h</b></button></article></aside></section>;
}

function TasksArea({ announce }: { announce: Announce }) {
  const groups = [
    { label:"Teaching", tone:"violet", tasks:[
      {id:1,title:"Finish Deniz’s Task 2 lesson plan",meta:"Today · 18:15",priority:"High"},
      {id:2,title:"Check Arda’s vocabulary workbook",meta:"Today · before 17:00",priority:"High"},
      {id:3,title:"Send Zeynep speaking feedback",meta:"Today · 20 min",priority:"Medium"},
      {id:4,title:"Write Elif’s post-class notes",meta:"Today · 10 min",priority:"Low"},
    ]},
    { label:"Business", tone:"blue", tasks:[
      {id:5,title:"Upload August invoice records",meta:"Monday · 25 min",priority:"Medium"},
      {id:6,title:"Review autumn course launch page",meta:"Tuesday · 45 min",priority:"Low"},
    ]},
    { label:"Personal", tone:"mint", tasks:[{id:7,title:"Plan next week’s protected focus blocks",meta:"Sunday · 15 min",priority:"Low"}]},
  ];
  const [done,setDone]=useState<number[]>([4]);
  const [focus,setFocus]=useState("All");
  const [priority,setPriority]=useState("All priorities");
  const [sortHighFirst,setSortHighFirst]=useState(true);
  const priorityOrder: Record<string,number>={High:0,Medium:1,Low:2};
  const visibleGroups=groups.map(group=>({...group,tasks:group.tasks.filter(task=>(focus==="All"||focus==="Today"&&task.meta.startsWith("Today")||focus==="Upcoming"&&!task.meta.startsWith("Today"))&&(priority==="All priorities"||task.priority===priority)).sort((a,b)=>sortHighFirst?priorityOrder[a.priority]-priorityOrder[b.priority]:a.id-b.id)})).filter(group=>group.tasks.length);
  const cyclePriority=()=>setPriority(value=>value==="All priorities"?"High":value==="High"?"Medium":value==="Medium"?"Low":"All priorities");
  return <section className="tasks-workspace"><article className="panel task-list-panel"><div className="task-toolbar"><div className="segmented">{["All","Today","Upcoming"].map(item=><button key={item} className={focus===item?"active":""} onClick={()=>setFocus(item)}>{item}</button>)}</div><div><button className="filter-button" onClick={cyclePriority}><Filter size={14}/> {priority}</button><button className={`filter-button ${sortHighFirst?"active":""}`} onClick={()=>setSortHighFirst(value=>!value)}><ChevronDown size={14}/> {sortHighFirst?"Priority first":"Default order"}</button></div></div>{visibleGroups.map(group=><div className="task-group" key={group.label}><div className="task-group-head"><span className={`group-dot ${group.tone}`}/><strong>{group.label}</strong><b>{group.tasks.filter(task=>!done.includes(task.id)).length}</b><button onClick={()=>announce(`Create new ${group.label} task`)} aria-label={`Add ${group.label} task`}><Plus size={15}/></button></div>{group.tasks.map(task=><button className={`full-task ${done.includes(task.id)?"done":""}`} key={task.id} onClick={()=>setDone(items=>items.includes(task.id)?items.filter(id=>id!==task.id):[...items,task.id])}><span className={`task-check ${done.includes(task.id)?"checked":""}`}>{done.includes(task.id)&&<Check size={14}/>}</span><span><strong>{task.title}</strong><small><CalendarDays size={12}/>{task.meta}</small></span><em className={`priority-label ${task.priority.toLowerCase()}`}>{task.priority}</em><MoreHorizontal size={16}/></button>)}</div>)}{!visibleGroups.length&&<div className="task-empty"><CheckCircle2 size={24}/><strong>No tasks in this view</strong><span>Change the time or priority filter.</span></div>}</article><aside className="tasks-side"><article className="panel task-focus"><PanelHeader kicker="Focus mode" title="Next best action" /><span className="focus-task-icon"><NotebookPen size={21}/></span><h3>Finish Deniz’s lesson plan</h3><p>40 minutes · due before 18:15</p><button className="primary-button" onClick={()=>announce("40-minute focus timer started")}><Play size={14} fill="currentColor"/> Start 40 min focus</button></article><article className="panel task-summary"><PanelHeader kicker="Today" title="Completion" /><div className="completion-ring" style={{"--progress":`${Math.round(done.length/7*100)}`} as React.CSSProperties}><strong>{done.length}/7</strong><span>done</span></div><p>You have about <strong>1h 50m</strong> of focused work remaining.</p></article></aside></section>;
}

function GoalsArea({ announce }: { announce: Announce }) {
  const goals=[
    {title:"Raise IELTS student average by 0.5 band",area:"Student outcomes",progress:68,target:"By 30 Sep",metric:"+0.34 band",tone:"violet",icon:Gauge},
    {title:"Build a complete reusable B1 curriculum",area:"Teaching system",progress:54,target:"By 15 Oct",metric:"13 / 24 units",tone:"blue",icon:BookOpen},
    {title:"Protect one planning morning every week",area:"Sustainable workload",progress:83,target:"12-week streak",metric:"10 / 12 weeks",tone:"mint",icon:CalendarDays},
    {title:"Publish 20 premium teaching materials",area:"Business growth",progress:35,target:"By 31 Dec",metric:"7 / 20 assets",tone:"amber",icon:LibraryBig},
  ];
  return <section className="goals-workspace"><div className="goal-grid">{goals.map((goal)=>{const Icon=goal.icon;return <button className="goal-card panel" key={goal.title} onClick={()=>announce(`${goal.title} opened`)}><div className="goal-top"><span className={`goal-icon ${goal.tone}`}><Icon size={18}/></span><MoreHorizontal size={16}/></div><span className="goal-area">{goal.area}</span><h3>{goal.title}</h3><div className="goal-progress-row"><i><em className={goal.tone} style={{width:`${goal.progress}%`}}/></i><strong>{goal.progress}%</strong></div><footer><span><Flag size={13}/>{goal.target}</span><b>{goal.metric}</b></footer></button>})}</div><aside className="goal-bottom"><article className="panel goal-review"><PanelHeader kicker="Weekly review" title="Three goals are on track" action={<span className="mini-status mint"><Check size={11}/> Healthy</span>} /><div className="goal-review-copy"><span className="review-score">58%</span><div><strong>Quarterly progress</strong><p>Your teaching-system goal needs one extra 90-minute block this week to remain on schedule.</p></div><button className="secondary-button" onClick={()=>announce("Weekly goal review started")}>Start review <ArrowRight size={14}/></button></div></article><article className="goal-quote"><Target size={21}/><p>“Build systems that make excellent teaching easier to repeat.”</p></article></aside></section>;
}

function ProjectsArea({ announce }: { announce: Announce }) {
  const projects=[
    {title:"IELTS Academic Prompt Library",category:"Content product",progress:72,due:"24 Aug",tasks:"18 / 25",members:["MT"],tone:"violet"},
    {title:"A2 Mystery Story Unit",category:"Curriculum",progress:88,due:"12 Aug",tasks:"14 / 16",members:["MT","AÇ"],tone:"amber"},
    {title:"Student Onboarding Refresh",category:"Operations",progress:45,due:"4 Sep",tasks:"5 / 11",members:["MT"],tone:"blue"},
    {title:"Autumn Course Launch",category:"Business",progress:31,due:"30 Sep",tasks:"8 / 26",members:["MT","ED"],tone:"mint"},
  ];
  const [projectView,setProjectView]=useState("Active");
  const [category,setCategory]=useState("All categories");
  const categories=["All categories","Curriculum","Content product","Operations","Business"];
  const shown=projects.filter(project=>(projectView==="All"||projectView==="Active"&&project.progress<85||projectView==="Completed"&&project.progress>=85)&&(category==="All categories"||project.category===category));
  const cycleCategory=()=>setCategory(value=>categories[(categories.indexOf(value)+1)%categories.length]);
  return <section className="projects-workspace"><div className="project-toolbar"><div className="segmented">{["Active","Completed","All"].map(view=><button key={view} className={projectView===view?"active":""} onClick={()=>setProjectView(view)}>{view}</button>)}</div><button className="filter-button" onClick={cycleCategory}><Filter size={14}/> {category}</button></div><div className="project-grid">{shown.map((project)=><button className="project-card panel" key={project.title} onClick={()=>announce(`${project.title} opened`)}><div className={`project-cover ${project.tone}`}><span>{project.category}</span><FolderKanban size={27}/></div><div className="project-body"><h3>{project.title}</h3><div className="project-meta"><span><CalendarDays size={13}/>Due {project.due}</span><span><CheckCircle2 size={13}/>{project.tasks} tasks</span></div><div className="project-progress"><i><em className={project.tone} style={{width:`${project.progress}%`}}/></i><b>{project.progress}%</b></div><footer><div className="stacked-avatars">{project.members.map((member,index)=><span className={`avatar avatar-small avatar-${project.tone}`} key={`${member}-${index}`}>{member}</span>)}</div><span>Updated today <ArrowUpRight size={13}/></span></footer></div></button>)}<button className="new-project-card" onClick={()=>announce("Create new project")}><Plus size={24}/><strong>Start a new project</strong><span>Curriculum, content or business</span></button></div></section>;
}

function ReportsArea({ track, announce }: { track: Track; announce: Announce }) {
  const weeks=track === "ESL" ? [11,13,12,15,14,16,15,17,16,19,18,21] : [7,9,7,9,7,10,8,11,9,11,9,13];
  const reports = track === "ESL" ? [["CEFR mastery movement","Grammar, vocabulary and skill mastery by learner",TrendingUp,"Updated today"],["Independent production gap","Recognition versus spontaneous language use",Activity,"Updated today"],["Unit and curriculum coverage","Outcomes taught, mastered and due for recycling",BookOpen,"Updated yesterday"],["ESL homework habits","Practice type, completion and transfer patterns",ClipboardCheck,"Updated today"],["Confidence and fluency","Communicative performance across eight weeks",MessageSquareText,"Updated 2d ago"],["ESL materials effectiveness","Which resources lead to retained language",LibraryBig,"Updated 4d ago"]] : [["Band movement","Overall and four-skill movement by candidate",Gauge,"Updated today"],["Writing criterion gaps","TR/TA, CC, LR and GRA trends",PenLine,"Updated today"],["Question-type accuracy","Listening and Reading accuracy by task type",FileCheck2,"Updated yesterday"],["Mock test trends","Raw scores, bands and intervention outcomes",BarChart3,"Updated today"],["Official test readiness","Countdown, target gap and risk by candidate",Clock3,"Updated 2d ago"],["IELTS materials effectiveness","Resources linked to measurable band gains",LibraryBig,"Updated 4d ago"]];
  const total=track === "ESL" ? "167" : "106";
  const average=track === "ESL" ? "14.0" : "8.8";
  const health=track === "ESL" ? "82" : "71";
  return <section className="reports-workspace"><div className="report-top"><article className="panel workload-report"><PanelHeader kicker={`${track} teaching workload`} title={`${track} lessons delivered · last 12 weeks`} action={<button className="filter-button" onClick={()=>announce(`${track} report period opened`)}>12 weeks <ChevronDown size={13}/></button>} /><div className="workload-chart"><div className="workload-y"><span>24</span><span>18</span><span>12</span><span>6</span><span>0</span></div><div className="workload-bars">{weeks.map((value,index)=><div key={index}><i className={index===weeks.length-1?"active":""} style={{height:`${value/24*100}%`}}><span>{value}</span></i><small>{index%2===0?`W${index+1}`:""}</small></div>)}</div></div><div className="report-callouts"><span><strong>{total}</strong><small>{track} lessons</small></span><span><strong>{average}</strong><small>Weekly average</small></span><span><strong>{track === "ESL" ? "97%" : "94%"}</strong><small>Attendance</small></span></div></article><article className="panel outcome-report"><PanelHeader kicker={`${track} outcomes`} title={track === "ESL" ? "CEFR goal health" : "Test readiness"} /><div className="outcome-donut" style={{"--progress":health} as React.CSSProperties}><span><strong>{health}%</strong><small>on track</small></span></div><div className="outcome-legend"><span><i className="mint"/>On track <b>{track === "ESL" ? "9" : "5"}</b></span><span><i className="amber"/>Watch <b>1</b></span><span><i className="red"/>At risk <b>1</b></span></div></article></div><div className="report-grid">{reports.map(([title,desc,Icon,updated])=>{const ReportIcon=Icon as React.ElementType;return <button className="report-card panel" key={title as string} onClick={()=>announce(`${title} report opened`)}><span><ReportIcon size={18}/></span><div><strong>{title as string}</strong><p>{desc as string}</p><small>{updated as string}</small></div><ArrowUpRight size={15}/></button>})}</div></section>;
}

const materials=[
  {title:"Task 2 opinion essay toolkit",type:"Worksheet pack",level:"IELTS 5.5–7.0",skill:"Writing",tone:"violet",uses:18,icon:FileText},
  {title:"Speaking Part 2 idea builder",type:"Interactive prompts",level:"IELTS 5.0–7.5",skill:"Speaking",tone:"blue",uses:12,icon:Mic2},
  {title:"A2 mystery story unit",type:"Full lesson pack",level:"CEFR A2",skill:"Grammar",tone:"amber",uses:9,icon:BookOpen},
  {title:"B1 conversation card library",type:"96 prompt cards",level:"CEFR B1",skill:"Speaking",tone:"mint",uses:24,icon:MessageSquareText},
  {title:"IELTS band descriptor guide",type:"Teacher reference",level:"IELTS",skill:"Assessment",tone:"blue",uses:31,icon:Gauge},
  {title:"Workplace small talk audio",type:"Audio lesson",level:"CEFR B1",skill:"Listening",tone:"violet",uses:7,icon:Headphones},
  {title:"Vocabulary retrieval template",type:"Reusable template",level:"All ESL",skill:"Vocabulary",tone:"mint",uses:16,icon:TimerReset},
  {title:"Academic linking language bank",type:"Reference sheet",level:"IELTS 6.0+",skill:"Writing",tone:"amber",uses:22,icon:AlignLeft},
  {title:"Matching headings accuracy drill",type:"Timed practice set",level:"IELTS 5.5–7.5",skill:"Reading",tone:"blue",uses:14,icon:FileCheck2},
  {title:"Maps and plans listening pack",type:"Audio practice",level:"IELTS 5.0–7.0",skill:"Listening",tone:"violet",uses:11,icon:Headphones},
  {title:"-ed endings pronunciation clinic",type:"Audio + speaking",level:"CEFR A2–B1",skill:"Pronunciation",tone:"amber",uses:13,icon:AudioLines},
  {title:"Graded reader discussion kit",type:"Reading lesson",level:"CEFR B1",skill:"Reading",tone:"mint",uses:10,icon:BookOpen},
];

function MaterialsArea({ track, announce }: { track: Track; announce: Announce }) {
  const [query,setQuery]=useState("");
  const [skill,setSkill]=useState("All");
  const trackMaterials=materials.filter(material=>track === "ESL" ? !material.level.includes("IELTS") : material.level.includes("IELTS"));
  const shown=trackMaterials.filter(material=>(skill==="All"||material.skill===skill)&&material.title.toLowerCase().includes(query.toLowerCase()));
  const filters=track === "ESL" ? ["All","Speaking","Grammar","Vocabulary","Listening","Pronunciation"] : ["All","Writing","Speaking","Reading","Listening","Assessment"];
  const collections=track === "ESL" ? [["Young Learners","72 items","amber"],["A1–A2 Core","68 items","blue"],["B1 Core Course","64 items","mint"],["Conversation","51 items","violet"]] : [["IELTS Writing","48 items","violet"],["IELTS Speaking","39 items","blue"],["IELTS Reading","42 items","mint"],["IELTS Listening","43 items","amber"]];
  return <section className="materials-workspace"><div className="materials-toolbar"><label><Search size={16}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={`Search ${track === "ESL" ? "314 ESL" : "172 IELTS"} materials...`}/></label><div className="material-filters">{filters.map(item=><button key={item} className={skill===item?"active":""} onClick={()=>setSkill(item)}>{item}</button>)}</div><button className="filter-button" onClick={()=>announce(`${track} material filters opened`)}><Filter size={14}/> {track === "ESL" ? "CEFR / age" : "Band / question type"}</button></div><div className="materials-layout"><div className="materials-grid">{shown.map((material)=>{const Icon=material.icon;return <button className="material-card panel" key={material.title} onClick={()=>announce(`${material.title} opened`)}><div className={`material-thumb ${material.tone}`}><span className="material-format"><Icon size={19}/></span><span className="material-skill">{material.skill}</span><div className="paper-lines"><i/><i/><i/><i/></div></div><div className="material-body"><span>{material.type}</span><h3>{material.title}</h3><div><span>{material.level}</span><span><Activity size={12}/>{material.uses} uses</span></div></div></button>})}{!shown.length&&<div className="material-empty"><Search size={24}/><strong>No {track} materials found</strong><span>Try another skill or keyword.</span></div>}</div><aside className="materials-side"><article className="panel collection-list"><PanelHeader kicker={`${track} collections`} title={`${track} teaching library`} action={<button className="text-button" onClick={()=>announce(`Create new ${track} material collection`)} aria-label="Create material collection"><Plus size={13}/></button>} />{collections.map(([title,count,tone])=><button key={title} onClick={()=>announce(`${title} collection opened`)}><span className={`collection-icon ${tone}`}><FolderKanban size={16}/></span><span><strong>{title}</strong><small>{count}</small></span><ChevronRight size={15}/></button>)}</article><article className="panel recently-used"><PanelHeader kicker="Quick access" title="Recently used" /><button onClick={()=>announce(`${track} recent material opened`)}><FileText size={15}/><span>{track === "ESL" ? "B1 conversation cards" : "Task 2 opinion toolkit"}</span><small>Today</small></button><button onClick={()=>announce(`${track} recent material opened`)}><MessageSquareText size={15}/><span>{track === "ESL" ? "A2 mystery unit" : "Speaking Part 2 builder"}</span><small>Yesterday</small></button></article></aside></div></section>;
}

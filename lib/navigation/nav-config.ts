/**
 * Sidebar navigation structure.
 *
 * Product structure, not data. ESL and IELTS expose deliberately different
 * areas — this is where CLAUDE.md rule 2 ("different dashboards, navigation,
 * progress models, assessments and reports") is expressed in the shell.
 *
 * Note what is absent: badge counts. They previously read "2", "3", "7" as
 * literals. A pending-work count is data and must be derived from a query, so
 * `NavItem.badge` is now optional and left undefined until there is something
 * to count.
 */

import {
  Activity,
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  FolderKanban,
  Gauge,
  LayoutDashboard,
  LibraryBig,
  ListTodo,
  Mic2,
  NotebookPen,
  PenLine,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";

import type { NavGroup, Track } from "@/lib/types/ui";

/** Areas unique to each track. Never shared, never merged. */
export const trackNavGroups: Record<Track, NavGroup[]> = {
  ESL: [
    {
      label: "ESL Teaching",
      items: [
        { name: "Dashboard", label: "ESL Dashboard", icon: LayoutDashboard },
        { name: "Today", label: "ESL Today", icon: Clock3 },
        { name: "Students", label: "ESL Students", icon: Users },
        { name: "Lessons", label: "ESL Lessons", icon: BookOpen },
        { name: "Lesson Planner", label: "ESL Planner", icon: NotebookPen },
      ],
    },
    {
      label: "ESL Learning",
      items: [
        { name: "Homework", label: "ESL Homework", icon: ClipboardCheck },
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
        { name: "Today", label: "IELTS Today", icon: Clock3 },
        { name: "Students", label: "IELTS Students", icon: Users },
        { name: "Lessons", label: "IELTS Lessons", icon: BookOpen },
        { name: "Lesson Planner", label: "IELTS Planner", icon: NotebookPen },
      ],
    },
    {
      label: "IELTS Performance",
      items: [
        { name: "Homework", label: "IELTS Assignments", icon: ClipboardCheck },
        { name: "Assessments", label: "Mock Tests", icon: FileCheck2 },
        { name: "IELTS Progress", label: "Band Progress", icon: Gauge },
        { name: "Writing Tracker", label: "Writing Tracker", icon: PenLine },
        { name: "Speaking Tracker", label: "Speaking Tracker", icon: Mic2 },
        { name: "Reports", label: "IELTS Reports", icon: BarChart3 },
      ],
    },
  ],
};

/** Operational areas legitimately shared by both tracks (CLAUDE.md rule 3). */
export const sharedNavGroups: NavGroup[] = [
  {
    label: "Shared Planning",
    items: [
      { name: "Calendar", label: "Calendar", icon: CalendarDays },
      { name: "Tasks", label: "Tasks", icon: ListTodo },
      { name: "Goals", label: "Goals", icon: Target },
      { name: "Projects", label: "Projects", icon: FolderKanban },
    ],
  },
  {
    label: "Library",
    items: [{ name: "Materials", label: "Materials", icon: LibraryBig }],
  },
];

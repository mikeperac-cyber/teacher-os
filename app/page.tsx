"use client";

/**
 * Teacher OS workspace shell.
 *
 * The demo records that used to be declared at the top of this file were
 * removed on 10 August 2026. Their shapes survive as types in
 * `lib/types/domain.ts`, and every collection they fed now resolves through
 * `lib/fixtures/`, which currently returns empty.
 *
 * That means every screen below renders its empty state. That is correct, not
 * broken: it is exactly what a teacher sees before creating their first
 * student. The original records remain in git at `294b548`.
 *
 * Structure, layout, class names and the `?track=…&view=…&detail=…` URL
 * contract are unchanged.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock3,
  Command,
  FileCheck2,
  FileText,
  Filter,
  FolderKanban,
  Gauge,
  GraduationCap,
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
  Target,
  TrendingUp,
  UserRound,
  Users,
  Video,
  WandSparkles,
  X,
} from "lucide-react";
import { EmptyState, PanelHeader } from "@/components/primitives";
import { CreateRecordModal } from "@/components/dashboard/QuickActions";
import {
  ESLDashboard,
  IELTSDashboard,
} from "@/components/dashboard/TrackDashboards";
import type { RecordKind } from "@/lib/actions/create-record";
import { areaMetaFor } from "@/lib/content/area-meta";
import { areaFromSlug, areaSlug } from "@/lib/navigation/areas";
import { buildDestination } from "@/lib/navigation/destination";
import { sharedNavGroups, trackNavGroups } from "@/lib/navigation/nav-config";
import {
  HOMEWORK_COLUMN_LABELS,
  HOMEWORK_COLUMNS,
  activeLessonPlanByTrack,
  calendarEvents,
  cefrDistribution,
  collectionsByTrack,
  currentUser,
  dayBlocksByTrack,
  eslProgressRows,
  eslStudents,
  goals,
  homeworkBoardByTrack,
  ieltsBandRows,
  ieltsCandidates,
  ieltsSpeakingRows,
  ieltsWritingRows,
  languageSystemRows,
  lessonRecordsByTrack,
  markingQueueByTrack,
  materialSkillFiltersByTrack,
  materials,
  projectCategories,
  projects,
  recentMaterialsByTrack,
  reportsByTrack,
  searchResultsByTrack,
  speakingPartAverages,
  taskGroups,
  upcomingAssessmentsByTrack,
  weeklyGoalByTrack,
  weeklyLessonCountsByTrack,
  writingErrorPatterns,
} from "@/lib/fixtures";
import { ESL_SKILL_LABELS } from "@/lib/types/domain";
import type { HomeworkBoard, HomeworkColumn } from "@/lib/types/domain";
import type { DeepLink } from "@/lib/types/dashboard";
import type { Announce, Area, DestinationPanel, Track } from "@/lib/types/ui";

/** Shown wherever a figure cannot be computed because there are no records. */
const NO_VALUE = "—";

/** Formats a percentage that cannot be derived without records. */
const percent = (value: number | null) =>
  value === null ? NO_VALUE : `${value}%`;

export default function Home() {
  const [activeTrack, setActiveTrack] = useState<Track>("ESL");
  const [activeArea, setActiveArea] = useState<Area>("Dashboard");
  const [sidebarCompact, setSidebarCompact] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showLessonPanel, setShowLessonPanel] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [quickCreate, setQuickCreate] = useState<RecordKind | null>(null);
  const [destination, setDestination] = useState<DestinationPanel | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const navGroups = useMemo(
    () => [...trackNavGroups[activeTrack], ...sharedNavGroups],
    [activeTrack],
  );
  const activePlan = activeLessonPlanByTrack[activeTrack];

  const syncUrl = (
    track: Track,
    area: Area,
    detail?: string,
    mode: "push" | "replace" = "push",
  ) => {
    const params = new URLSearchParams();
    params.set("track", track.toLowerCase());
    params.set("view", areaSlug(area));
    if (detail)
      params.set(
        "detail",
        detail
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, ""),
      );
    window.history[mode === "push" ? "pushState" : "replaceState"](
      {},
      "",
      `${window.location.pathname}?${params.toString()}`,
    );
  };

  const navigateTo = (area: Area, detail?: string) => {
    setActiveArea(area);
    setDestination(null);
    setShowQuickAdd(false);
    setShowSearch(false);
    syncUrl(activeTrack, area, detail);
    window.requestAnimationFrame(() =>
      document.querySelector(".main-content")?.scrollTo({ top: 0, behavior: "smooth" }),
    );
  };

  /**
   * Follows a deep link from a dashboard triage item.
   *
   * Every item on the dashboard carries its own destination so it is actionable
   * in one click — that is what makes it triage rather than a report.
   */
  const navigate = (link: DeepLink) => navigateTo(link.area, link.detail);

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

  const announce: Announce = (message, openPanel) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
    const shouldOpen =
      openPanel ??
      /(opened|selected|started|created|refreshed|captured|optimized|ready|create|^new\s)/i.test(
        message,
      );
    if (shouldOpen) openDestination(message);
  };

  const weeklyGoal = weeklyGoalByTrack[activeTrack];

  return (
    <div
      className={`app-shell track-${activeTrack.toLowerCase()} ${sidebarCompact ? "is-compact" : ""}`}
    >
      <aside className="sidebar">
        <div className="brand-row">
          <button
            className="brand"
            onClick={() => navigateTo("Dashboard")}
            aria-label="Open dashboard"
          >
            <span className="brand-mark">
              <GraduationCap size={19} strokeWidth={2.2} />
            </span>
            <span className="brand-copy">
              <strong>Teacher</strong>
              <em>OS</em>
            </span>
          </button>
          <button
            className="icon-button sidebar-toggle"
            onClick={() => setSidebarCompact((value) => !value)}
            aria-label="Toggle sidebar"
          >
            <PanelLeftClose size={17} />
          </button>
        </div>

        <div className="track-switcher" aria-label="Teaching track">
          <button
            className={activeTrack === "ESL" ? "active" : ""}
            onClick={() => changeTrack("ESL")}
          >
            <span>ESL</span>
            <small>CEFR</small>
          </button>
          <button
            className={activeTrack === "IELTS" ? "active" : ""}
            onClick={() => changeTrack("IELTS")}
          >
            <span>IELTS</span>
            <small>Academic</small>
          </button>
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
            <div className="weekly-card-top">
              <span>{activeTrack} weekly goal</span>
              <strong>{percent(weeklyGoal)}</strong>
            </div>
            <div className="progress-track">
              <i style={{ width: `${weeklyGoal ?? 0}%` }} />
            </div>
            <small>
              {weeklyGoal === null
                ? "No learners tracked yet"
                : `${activeTrack} progress this week`}
            </small>
          </div>
          <button
            className="profile-button"
            onClick={() => announce("Teacher profile opened")}
          >
            <span className="avatar teacher-avatar">
              {currentUser?.initials ?? <UserRound size={16} />}
            </span>
            <span>
              <strong>{currentUser?.displayName ?? "Not signed in"}</strong>
              <small>{currentUser?.role ?? "Sign in to continue"}</small>
            </span>
            <MoreHorizontal size={17} />
          </button>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <button className="search-trigger" onClick={() => setShowSearch(true)}>
            <Search size={17} />
            <span>Search {activeTrack} students, lessons, materials...</span>
            <kbd>
              <Command size={12} /> K
            </kbd>
          </button>
          <div className="topbar-actions">
            <span className={`workspace-badge ${activeTrack.toLowerCase()}`}>
              {activeTrack === "ESL" ? "ESL · CEFR" : "IELTS Academic"}
            </span>
            <span className="today-label">
              <CalendarDays size={16} /> Today
            </span>
            <button
              className="icon-button notification-button"
              onClick={() => announce("Notifications opened")}
              aria-label="Notifications"
            >
              <Bell size={18} />
            </button>
            <div className="quick-add-wrap">
              <button
                className="primary-button"
                onClick={() => setShowQuickAdd((value) => !value)}
              >
                <Plus size={17} /> Quick add <ChevronDown size={14} />
              </button>
              {showQuickAdd && (
                /* Same modal as the dashboard's quick-action row — one write
                   path, so "Add student" means the same thing wherever the
                   teacher reaches for it. */
                <div className="quick-menu">
                  <button
                    onClick={() => {
                      setShowQuickAdd(false);
                      setQuickCreate("student");
                    }}
                  >
                    <UserRound size={17} />
                    <span>
                      <strong>
                        {activeTrack === "ESL" ? "ESL learner" : "IELTS candidate"}
                      </strong>
                      <small>
                        {activeTrack === "ESL"
                          ? "Create a CEFR learner profile"
                          : "Create a band-score profile"}
                      </small>
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setShowQuickAdd(false);
                      setQuickCreate("lesson");
                    }}
                  >
                    <BookOpen size={17} />
                    <span>
                      <strong>{activeTrack} lesson</strong>
                      <small>
                        {activeTrack === "ESL"
                          ? "Plan from a CEFR outcome"
                          : "Plan from a target band"}
                      </small>
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setShowQuickAdd(false);
                      setQuickCreate("homework");
                    }}
                  >
                    <ListTodo size={17} />
                    <span>
                      <strong>
                        {activeTrack === "ESL" ? "ESL homework" : "IELTS practice"}
                      </strong>
                      <small>Assign the next piece of work</small>
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="main-content">
          {activeArea === "Dashboard" ? (
            activeTrack === "ESL" ? (
              <ESLDashboard
                navigate={navigate}
                onStartLesson={() => setShowLessonPanel(true)}
                announce={announce}
              />
            ) : (
              <IELTSDashboard
                navigate={navigate}
                onStartLesson={() => setShowLessonPanel(true)}
                announce={announce}
              />
            )
          ) : (
            <AreaPreview area={activeArea} track={activeTrack} announce={announce} />
          )}
        </main>
      </div>

      {showLessonPanel && activePlan && (
        <div className="drawer-backdrop" onMouseDown={() => setShowLessonPanel(false)}>
          <aside
            className="lesson-drawer"
            onMouseDown={(event) => event.stopPropagation()}
            aria-label="Upcoming lesson panel"
          >
            <div className="drawer-head">
              <div>
                <span className="eyebrow">Upcoming {activeTrack} lesson</span>
                <h2>{activePlan.student}</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setShowLessonPanel(false)}
                aria-label="Close"
              >
                <X size={19} />
              </button>
            </div>
            <div className="drawer-section">
              <span className="section-kicker">Today’s objective</span>
              <h3>{activePlan.objective}</h3>
              <p>{activePlan.note}</p>
            </div>
            <div className="drawer-actions">
              <button
                className="secondary-button"
                onClick={() => {
                  setShowLessonPanel(false);
                  navigateTo("Lesson Planner");
                }}
              >
                Open plan
              </button>
              <button
                className="primary-button grow"
                onClick={() => {
                  setShowLessonPanel(false);
                  announce(`${activeTrack} lesson delivery room opened`);
                }}
              >
                <Play size={16} fill="currentColor" /> Start lesson
              </button>
            </div>
          </aside>
        </div>
      )}

      {quickCreate && (
        <CreateRecordModal
          kind={quickCreate}
          track={activeTrack}
          close={() => setQuickCreate(null)}
        />
      )}

      {showSearch && (
        <GlobalSearch
          track={activeTrack}
          close={() => setShowSearch(false)}
          setActiveArea={navigateTo}
          announce={announce}
        />
      )}

      {destination && (
        <DestinationDrawer
          key={destination.title}
          panel={destination}
          track={activeTrack}
          close={closeDestination}
          navigate={navigateTo}
          announce={announce}
        />
      )}

      {toast && (
        <div className="toast">
          <CheckCircle2 size={17} /> {toast}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Overlays                                                            */
/* ------------------------------------------------------------------ */

function DestinationDrawer({
  panel,
  track,
  close,
  navigate,
  announce,
}: {
  panel: DestinationPanel;
  track: Track;
  close: () => void;
  navigate: (area: Area) => void;
  announce: Announce;
}) {
  const [saved, setSaved] = useState(false);

  /**
   * Nothing is persisted. This previously reported "created successfully" for a
   * write that never happened; it now states plainly that saving is unavailable
   * until Supabase is connected in Phase 3.
   */
  const saveDraft = (event: React.FormEvent) => {
    event.preventDefault();
    setSaved(true);
    announce("Saving is not available yet — no database is connected", false);
  };

  return (
    <div className="destination-backdrop" onMouseDown={close}>
      <aside
        className="destination-drawer"
        onMouseDown={(event) => event.stopPropagation()}
        aria-label={`${panel.title} destination`}
      >
        <header className="destination-head">
          <div>
            <span className="eyebrow">{panel.eyebrow}</span>
            <h2>{panel.title}</h2>
            <p>{panel.description}</p>
          </div>
          <button className="icon-button" onClick={close} aria-label="Close destination">
            <X size={18} />
          </button>
        </header>

        {panel.mode === "notifications" ? (
          <div className="destination-body">
            <div className="destination-section">
              <PanelHeader kicker="Inbox" title="Nothing to review" />
              <EmptyState
                icon={Bell}
                title="No notifications"
                hint="Submissions, upcoming lessons and due progress updates appear here."
              />
            </div>
          </div>
        ) : panel.mode === "profile" ? (
          <div className="destination-body">
            <div className="destination-profile">
              <span className="avatar teacher-avatar">
                <UserRound size={18} />
              </span>
              <div>
                <strong>{currentUser?.displayName ?? "Not signed in"}</strong>
                <span>
                  {currentUser?.role ?? "Authentication arrives in Phase 2"}
                </span>
              </div>
            </div>
            <div className="destination-section">
              <PanelHeader kicker="Workspace" title="Teacher shortcuts" />
              <div className="destination-shortcuts">
                <button onClick={() => navigate("Calendar")}>
                  <CalendarDays size={16} />
                  Calendar
                </button>
                <button onClick={() => navigate("Goals")}>
                  <Target size={16} />
                  Goals
                </button>
                <button onClick={() => navigate("Reports")}>
                  <TrendingUp size={16} />
                  Reports
                </button>
              </div>
            </div>
          </div>
        ) : panel.mode === "delivery" ? (
          <div className="destination-body">
            <div className={`delivery-status ${track.toLowerCase()}`}>
              <span className="destination-icon">
                <Video size={18} />
              </span>
              <div>
                <strong>No lesson to deliver</strong>
                <small>Schedule a {track} lesson to open the delivery room.</small>
              </div>
            </div>
            <div className="destination-section">
              <PanelHeader
                kicker="Delivery sequence"
                title="Everything stays connected"
              />
              <div className="delivery-steps">
                {[
                  "Open teaching materials",
                  "Run the timed lesson flow",
                  "Capture post-class notes",
                  "Assign the next homework",
                ].map((step, index) => (
                  <button
                    key={step}
                    onClick={() =>
                      navigate(
                        index === 0
                          ? "Materials"
                          : index === 1
                            ? "Lesson Planner"
                            : index === 2
                              ? "Lessons"
                              : "Homework",
                      )
                    }
                  >
                    <span>{index + 1}</span>
                    <strong>{step}</strong>
                    <ChevronRight size={15} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : panel.mode === "create" ? (
          <form className="destination-body destination-form" onSubmit={saveDraft}>
            <div className="destination-section">
              <PanelHeader
                kicker={`${track} creation flow`}
                title="Start with the essentials"
              />
              <label>
                <span>Title</span>
                <input
                  required
                  defaultValue={panel.title.replace(/^Create\s+/i, "")}
                  placeholder="Add a clear title"
                />
              </label>
              <label>
                <span>
                  {panel.area === "Students"
                    ? track === "ESL"
                      ? "CEFR level and learning goal"
                      : "Current band and target band"
                    : "Linked student or project"}
                </span>
                <input
                  required
                  placeholder={
                    panel.area === "Students"
                      ? track === "ESL"
                        ? "A2 → B1 · confident speaking"
                        : "6.0 → 7.0 · IELTS Academic"
                      : "Choose or type a name"
                  }
                />
              </label>
              <label>
                <span>Next action</span>
                <textarea placeholder="What should happen next?" />
              </label>
              <div className="destination-facts compact">
                {panel.facts.map(([label, value]) => (
                  <span key={label}>
                    <small>{label}</small>
                    <strong>{value}</strong>
                  </span>
                ))}
              </div>
            </div>
            <button
              className={`primary-button destination-save ${saved ? "saved" : ""}`}
              type="submit"
            >
              {saved ? (
                <>
                  <X size={16} /> Not saved — no database
                </>
              ) : (
                <>
                  <Plus size={16} /> Create draft
                </>
              )}
            </button>
          </form>
        ) : (
          <div className="destination-body">
            <div className="destination-facts">
              {panel.facts.map(([label, value]) => (
                <span key={label}>
                  <small>{label}</small>
                  <strong>{value}</strong>
                </span>
              ))}
            </div>
            <div className="destination-section">
              <PanelHeader kicker="Connected record" title="Continue the workflow" />
              <div className="destination-checklist">
                <button onClick={() => navigate(panel.area)}>
                  <ArrowUpRight size={17} />
                  <span>
                    <strong>Open the full {panel.area.toLowerCase()} workspace</strong>
                    <small>Continue with every related control</small>
                  </span>
                </button>
                <button onClick={() => navigate("Tasks")}>
                  <ListTodo size={17} />
                  <span>
                    <strong>Create or update the next action</strong>
                    <small>Keep the workflow moving</small>
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        <footer className="destination-footer">
          <div>
            <span>Related destinations</span>
            <div>
              {panel.related.map((area) => (
                <button key={area} onClick={() => navigate(area)}>
                  {area}
                  <ArrowRight size={12} />
                </button>
              ))}
            </div>
          </div>
          <button className="primary-button" onClick={() => navigate(panel.area)}>
            Open {panel.area}
            <ArrowRight size={15} />
          </button>
        </footer>
      </aside>
    </div>
  );
}

function GlobalSearch({
  track,
  close,
  setActiveArea,
  announce,
}: {
  track: Track;
  close: () => void;
  setActiveArea: (area: Area) => void;
  announce: Announce;
}) {
  const [query, setQuery] = useState("");
  const results = searchResultsByTrack[track].filter((result) =>
    `${result.title} ${result.meta}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="search-backdrop" onMouseDown={close}>
      <section
        className="global-search"
        onMouseDown={(event) => event.stopPropagation()}
        aria-label="Global search dialog"
      >
        <div className="global-search-input">
          <Search size={19} />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search the ${track} workspace...`}
          />
          <kbd>ESC</kbd>
        </div>
        <div className="search-result-label">
          <span>{query ? `${results.length} results` : `${track} workspace`}</span>
          <small>Search only this teaching track</small>
        </div>
        <div className="search-results">
          {results.map((result) => {
            const Icon = result.icon;
            return (
              <button
                key={result.title}
                onClick={() => {
                  close();
                  setActiveArea(result.area);
                  announce(`${result.title} opened`);
                }}
              >
                <span>
                  <Icon size={17} />
                </span>
                <div>
                  <strong>{result.title}</strong>
                  <small>{result.meta}</small>
                </div>
                <span className="search-area">{result.area}</span>
                <ArrowRight size={15} />
              </button>
            );
          })}
          {!results.length && (
            <div className="search-empty">
              <Search size={25} />
              <strong>Nothing to search yet</strong>
              <span>Students, lessons and materials become searchable once created.</span>
            </div>
          )}
        </div>
        <div className="search-footer">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> move
          </span>
          <span>
            <kbd>↵</kbd> open
          </span>
          <span>
            <Command size={12} /> K to search anywhere
          </span>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Areas                                                               */
/* ------------------------------------------------------------------ */

function AreaPreview({
  area,
  track,
  announce,
}: {
  area: Exclude<Area, "Dashboard">;
  track: Track;
  announce: Announce;
}) {
  const meta = areaMetaFor(track, area);
  if (!meta) return null;
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">{meta.eyebrow}</p>
          <h1>{meta.title}</h1>
          <p>{meta.description}</p>
        </div>
        <button
          className="primary-button"
          onClick={() => announce(`Create new ${track} ${area.toLowerCase()} item`)}
        >
          <Plus size={16} /> New
        </button>
      </section>
      <DetailedArea area={area} track={track} announce={announce} />
    </>
  );
}

function DetailedArea({
  area,
  track,
  announce,
}: {
  area: Exclude<Area, "Dashboard">;
  track: Track;
  announce: Announce;
}) {
  switch (area) {
    case "Today":
      return <TodayArea track={track} />;
    case "Students":
      return track === "ESL" ? (
        <ESLStudentsArea announce={announce} />
      ) : (
        <IELTSStudentsArea announce={announce} />
      );
    case "Lessons":
      return <LessonsArea track={track} announce={announce} />;
    case "Lesson Planner":
      return <LessonPlannerArea track={track} announce={announce} />;
    case "Homework":
      return <HomeworkArea track={track} announce={announce} />;
    case "Assessments":
      return <AssessmentsArea track={track} announce={announce} />;
    case "ESL Progress":
      return <ESLProgressArea announce={announce} />;
    case "IELTS Progress":
      return <IELTSProgressArea announce={announce} />;
    case "Language Skills":
      return <LanguageSkillsArea announce={announce} />;
    case "Writing Tracker":
      return <WritingTrackerArea announce={announce} />;
    case "Speaking Tracker":
      return <SpeakingTrackerArea announce={announce} />;
    case "Calendar":
      return <CalendarArea />;
    case "Tasks":
      return <TasksArea announce={announce} />;
    case "Goals":
      return <GoalsArea announce={announce} />;
    case "Projects":
      return <ProjectsArea announce={announce} />;
    case "Reports":
      return <ReportsArea track={track} announce={announce} />;
    case "Materials":
      return <MaterialsArea track={track} announce={announce} />;
  }
}

function TodayArea({ track }: { track: Track }) {
  const blocks = dayBlocksByTrack[track];
  return (
    <section className="today-workspace">
      <article className="panel day-agenda">
        <PanelHeader kicker={`${track} timeline`} title={`Today’s ${track} agenda`} />
        {blocks.length ? (
          <div className="day-blocks">
            {blocks.map((block) => {
              const Icon = block.icon;
              return (
                <div
                  key={`${block.time}-${block.title}`}
                  className={`day-block ${block.kind.replace(" ", "-")}`}
                >
                  <div className="day-time">
                    <strong>{block.time}</strong>
                    <span>{block.duration}</span>
                  </div>
                  <span className="day-line" />
                  <span className="day-icon">
                    <Icon size={16} />
                  </span>
                  <div>
                    <strong>{block.title}</strong>
                    <span>{block.meta}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={CalendarDays}
            title="Nothing scheduled today"
            hint={`Lessons, preparation and marking blocks for ${track} appear here in time order.`}
          />
        )}
      </article>
      <aside className="today-side">
        <article className="panel readiness-panel">
          <PanelHeader kicker={`${track} readiness`} title="Readiness" />
          <EmptyState
            icon={Target}
            title="Nothing to prepare"
            hint="Readiness is calculated from the preparation steps of today’s lessons."
          />
        </article>
      </aside>
    </section>
  );
}

function ESLStudentsArea({ announce }: { announce: Announce }) {
  const [query, setQuery] = useState("");
  const [levelGroup, setLevelGroup] = useState("All");
  const filtered = eslStudents.filter(
    (student) =>
      (levelGroup === "All" ||
        (levelGroup === "A1–A2"
          ? student.level.startsWith("A")
          : student.level.startsWith("B"))) &&
      student.name.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <section className="students-workspace">
      <article className="panel students-table-panel">
        <div className="table-tools">
          <label>
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find an ESL student..."
            />
          </label>
          <div className="segmented">
            {["All", "A1–A2", "B1–B2"].map((item) => (
              <button
                key={item}
                className={levelGroup === item ? "active" : ""}
                onClick={() => setLevelGroup(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <button
            className="filter-button"
            onClick={() => announce("ESL age and course filters opened")}
          >
            <Filter size={14} /> Age / course
          </button>
        </div>
        {filtered.length ? (
          <div className="student-table">
            <div className="student-table-head">
              <span>ESL student</span>
              <span>Course / CEFR</span>
              <span>Next lesson</span>
              <span>Homework</span>
              <span>Mastery</span>
              <span />
            </div>
            {filtered.map((student) => (
              <button
                className="student-table-row"
                key={student.name}
                onClick={() => announce(`${student.name} ESL profile opened`)}
              >
                <span className={`avatar avatar-${student.tone}`}>
                  {student.initials}
                </span>
                <span className="student-name">
                  <strong>{student.name}</strong>
                  <small>1:1 ESL learner</small>
                </span>
                <span>
                  <strong>{student.program}</strong>
                  <small>CEFR {student.level}</small>
                </span>
                <span>
                  <strong>{student.next}</strong>
                </span>
                <span>
                  <em
                    className={`hw-state ${student.hw.toLowerCase().replace(" ", "-")}`}
                  >
                    {student.hw}
                  </em>
                </span>
                <span className="table-progress">
                  <i>
                    <em style={{ width: `${student.progress}%` }} />
                  </i>
                  <b>{student.progress}%</b>
                </span>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Users}
            title="No ESL students yet"
            hint="Create your first learner to start the teaching workflow."
          />
        )}
      </article>
      <aside className="student-insights">
        <article className="panel attention-students">
          <PanelHeader kicker="ESL attention" title="Follow up this week" />
          <EmptyState
            icon={Users}
            title="Nobody to follow up"
            hint="Learners whose progress slips appear here automatically."
          />
        </article>
        <article className="panel cohort-card">
          <PanelHeader
            kicker="CEFR mix"
            title={`${eslStudents.length} ESL learners`}
          />
          <div className="cohort-legend">
            {cefrDistribution.map(([level, learners]) => (
              <span key={level}>
                <i className="violet" />
                {level} <b>{learners}</b>
              </span>
            ))}
          </div>
        </article>
      </aside>
    </section>
  );
}

function IELTSStudentsArea({ announce }: { announce: Announce }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const shown = ieltsCandidates.filter(
    (candidate) =>
      candidate.name.toLowerCase().includes(query.toLowerCase()) &&
      (filter === "All" ||
        (filter === "Test ≤ 60d" &&
          Number(candidate.test.match(/(\d+)d/)?.[1] ?? 999) <= 60) ||
        (filter === "At risk" && candidate.ready < 65)),
  );

  return (
    <section className="students-workspace ielts-students-workspace">
      <article className="panel students-table-panel">
        <div className="table-tools">
          <label>
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find an IELTS candidate..."
            />
          </label>
          <div className="segmented">
            {["All", "Test ≤ 60d", "At risk"].map((item) => (
              <button
                key={item}
                className={filter === item ? "active" : ""}
                onClick={() => setFilter(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        {shown.length ? (
          <div className="candidate-table">
            <div className="candidate-head">
              <span>Candidate</span>
              <span>Current → target</span>
              <span>Test date</span>
              <span>Weakest skill</span>
              <span>Latest mock</span>
              <span>Readiness</span>
              <span />
            </div>
            {shown.map((candidate) => (
              <button
                className="candidate-row"
                key={candidate.name}
                onClick={() => announce(`${candidate.name} IELTS profile opened`)}
              >
                <span className={`avatar avatar-${candidate.tone}`}>
                  {candidate.initials}
                </span>
                <span className="candidate-name">
                  <strong>{candidate.name}</strong>
                  <small>IELTS Academic</small>
                </span>
                <span>
                  <b>{candidate.current}</b>
                  <ArrowRight size={12} />
                  <strong>{candidate.target}</strong>
                </span>
                <span>
                  <strong>{candidate.test}</strong>
                </span>
                <span>
                  <em className="weak-skill">{candidate.weakest}</em>
                </span>
                <span>
                  <strong>{candidate.mock}</strong>
                </span>
                <span className="candidate-ready">
                  <i>
                    <em style={{ width: `${candidate.ready}%` }} />
                  </i>
                  <b>{candidate.ready}%</b>
                </span>
                <ChevronRight size={15} />
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Users}
            title="No IELTS candidates yet"
            hint="Create a candidate with a current band, target band and test date."
          />
        )}
      </article>
      <aside className="student-insights">
        <article className="panel attention-students">
          <PanelHeader kicker="Test risk" title="Candidates to intervene" />
          <EmptyState
            icon={Gauge}
            title="No candidates at risk"
            hint="Candidates tracking below their target band appear here."
          />
        </article>
      </aside>
    </section>
  );
}

function LessonsArea({ track, announce }: { track: Track; announce: Announce }) {
  const lessons = lessonRecordsByTrack[track];
  return (
    <section className="area-layout lessons-layout">
      <article className="panel lesson-records">
        <PanelHeader
          kicker={`${track} lesson history`}
          title={`Recent ${track} lessons`}
          action={
            <button
              className="filter-button"
              onClick={() => announce(`${track} lesson filters opened`)}
            >
              <Filter size={14} /> {track === "ESL" ? "CEFR level" : "Skill"}
            </button>
          }
        />
        {lessons.length ? (
          <>
            <div className="record-head">
              <span>Date</span>
              <span>Student</span>
              <span>{track === "ESL" ? "Language outcome" : "Question type / focus"}</span>
              <span>Length</span>
              <span>Status</span>
              <span />
            </div>
            {lessons.map((lesson) => (
              <button
                className="record-row"
                key={`${lesson.date}-${lesson.student}`}
                onClick={() =>
                  announce(`${lesson.student} ${track} lesson record opened`)
                }
              >
                <span>{lesson.date}</span>
                <span>
                  <strong>{lesson.student}</strong>
                  <small>{track === "ESL" ? "ESL · CEFR" : "IELTS Academic"}</small>
                </span>
                <span>{lesson.focus}</span>
                <span>{lesson.length}</span>
                <span>
                  <em
                    className={`record-status ${lesson.status === "Notes due" ? "amber" : "mint"}`}
                  >
                    {lesson.status}
                  </em>
                </span>
                <ChevronRight size={16} />
              </button>
            ))}
          </>
        ) : (
          <EmptyState
            icon={BookOpen}
            title={`No ${track} lessons delivered`}
            hint="Delivered lessons, objectives and post-class notes appear here."
          />
        )}
      </article>
      <aside className="area-side-panel">
        <article className="panel lesson-month">
          <PanelHeader kicker="This month" title={`${track} lesson activity`} />
          <div className="big-number">
            0 <small>lessons</small>
          </div>
        </article>
      </aside>
    </section>
  );
}

function LessonPlannerArea({ track, announce }: { track: Track; announce: Announce }) {
  const plan = activeLessonPlanByTrack[track];
  const [prepChecks, setPrepChecks] = useState([false, false, false, false]);

  if (!plan) {
    return (
      <section className="planner-workspace">
        <article className="panel planner-brief">
          <PanelHeader kicker={`${track} lesson brief`} title="No lesson to prepare" />
          <EmptyState
            icon={NotebookPen}
            title="Nothing scheduled"
            hint={
              track === "ESL"
                ? "Schedule an ESL lesson to plan from a CEFR outcome."
                : "Schedule an IELTS lesson to plan from a target band and rubric gap."
            }
          />
        </article>
      </section>
    );
  }

  return (
    <section className="planner-workspace">
      <article className="panel planner-brief">
        <PanelHeader kicker={`${track} lesson brief`} title={plan.student} />
        <div className="planner-form">
          <label>
            <span>
              {track === "ESL" ? "CEFR learning outcome" : "Band-score objective"}
            </span>
            <textarea defaultValue={plan.objective} />
          </label>
          <div className="form-row">
            <label>
              <span>Course</span>
              <input defaultValue={plan.course} />
            </label>
            <label>
              <span>{track === "ESL" ? "Language focus" : "Skill / task"}</span>
              <input defaultValue={plan.skill} />
            </label>
          </div>
          <button
            className="ai-plan-button"
            onClick={() => announce(`${track} lesson suggestions refreshed`)}
          >
            <WandSparkles size={16} /> Suggest from{" "}
            {track === "ESL" ? "CEFR gaps" : "recent rubric gaps"}
          </button>
        </div>
      </article>
      <article className="panel lesson-rundown">
        <PanelHeader
          kicker={track === "ESL" ? "ESA-aligned rundown" : "Score-focused rundown"}
          title="60-minute lesson flow"
        />
        <div className="rundown-list">
          {plan.blocks.map((block, index) => (
            <div className="rundown-row" key={`${block.time}-${index}`}>
              <span className={`rundown-index ${block.tone}`}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <strong>{block.title}</strong>
                <small>{block.detail}</small>
              </div>
              <span className="rundown-time">{block.time} min</span>
            </div>
          ))}
        </div>
      </article>
      <aside className="planner-resources">
        <article className="panel prep-check">
          <PanelHeader kicker="Pre-class" title="Readiness check" />
          {[
            "Homework reviewed",
            track === "ESL" ? "CEFR outcome is observable" : "Rubric gap is explicit",
            track === "ESL" ? "Production task prepared" : "Model paragraph finalized",
            "Shared board opened",
          ].map((label, index) => (
            <button
              key={label}
              className={prepChecks[index] ? "done" : ""}
              onClick={() =>
                setPrepChecks((items) =>
                  items.map((value, itemIndex) =>
                    itemIndex === index ? !value : value,
                  ),
                )
              }
            >
              {prepChecks[index] ? <Check size={13} /> : <Circle size={13} />} {label}
            </button>
          ))}
          <div className="prep-score">
            <span>{track} lesson readiness</span>
            <strong>
              {Math.round((prepChecks.filter(Boolean).length / 4) * 100)}%
            </strong>
          </div>
        </article>
      </aside>
    </section>
  );
}

function HomeworkArea({ track, announce }: { track: Track; announce: Announce }) {
  const [board, setBoard] = useState<HomeworkBoard>(homeworkBoardByTrack[track]);

  const advance = (column: HomeworkColumn, id: number) => {
    const index = HOMEWORK_COLUMNS.indexOf(column);
    const item = board[column].find((entry) => entry.id === id);
    if (!item) return;
    if (index === HOMEWORK_COLUMNS.length - 1) {
      announce(`${item.name} ${track} homework record opened`);
      return;
    }
    const nextColumn = HOMEWORK_COLUMNS[index + 1];
    setBoard({
      ...board,
      [column]: board[column].filter((entry) => entry.id !== id),
      [nextColumn]: [...board[nextColumn], item],
    });
  };

  return (
    <section className="homework-board">
      {HOMEWORK_COLUMNS.map((column) => (
        <article className="homework-column" key={column}>
          <div className="homework-column-head">
            <span className={`column-dot ${column}`} />
            <strong>{HOMEWORK_COLUMN_LABELS[column]}</strong>
            <b>{board[column].length}</b>
          </div>
          <div className="homework-cards">
            {board[column].map((item) => (
              <button
                key={item.id}
                className="homework-card"
                onClick={() => advance(column, item.id)}
              >
                <div>
                  <span className={`avatar avatar-small avatar-${item.tone}`}>
                    {item.name
                      .split(" ")
                      .map((part) => part[0])
                      .join("")}
                  </span>
                </div>
                <h3>{item.task}</h3>
                <p>
                  {item.name} · {track}
                </p>
                <footer>
                  <span className={item.due.includes("Late") ? "late" : ""}>
                    <Clock3 size={13} />
                    {item.due}
                  </span>
                </footer>
              </button>
            ))}
          </div>
        </article>
      ))}
    </section>
  );
}

function AssessmentsArea({ track, announce }: { track: Track; announce: Announce }) {
  const queue = markingQueueByTrack[track];
  return (
    <section className="assessment-layout">
      <article className="panel marking-queue">
        <PanelHeader
          kicker={track === "ESL" ? "Mastery review queue" : "Mock marking queue"}
          title={
            track === "ESL"
              ? "ESL progress checks awaiting feedback"
              : "IELTS mocks and timed sections"
          }
        />
        {queue.length ? (
          <div className="assessment-list">
            {queue.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.title}
                  onClick={() =>
                    announce(
                      `${item.title} opened for ${track === "ESL" ? "mastery review" : "band marking"}`,
                    )
                  }
                >
                  <span className={`assessment-icon ${item.tone}`}>
                    <Icon size={18} />
                  </span>
                  <div className="assessment-copy">
                    <strong>{item.title}</strong>
                    <span>
                      {item.name} · {item.type}
                    </span>
                    <small>{item.submitted}</small>
                  </div>
                  <span className="mark-button">
                    {track === "ESL" ? "Review" : "Mark bands"} <ArrowRight size={14} />
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={FileCheck2}
            title="Nothing to mark"
            hint={
              track === "ESL"
                ? "CEFR progress checks awaiting review appear here."
                : "Mocks and timed sections awaiting band scores appear here."
            }
          />
        )}
      </article>
      <aside className="assessment-side">
        <article className="panel upcoming-mocks">
          <PanelHeader
            kicker="Scheduled"
            title={track === "ESL" ? "Upcoming progress checks" : "Upcoming IELTS mocks"}
          />
          {upcomingAssessmentsByTrack[track].length ? null : (
            <EmptyState
              icon={CalendarDays}
              title="None scheduled"
              hint="Schedule an assessment to see it here."
            />
          )}
        </article>
      </aside>
    </section>
  );
}

function ESLProgressArea({ announce }: { announce: Announce }) {
  return (
    <section className="progress-workspace">
      <article className="panel progress-matrix">
        <PanelHeader kicker="CEFR skill matrix" title="Active ESL learners" />
        {eslProgressRows.length ? (
          <div className="matrix-scroll">
            <div className="progress-head">
              <span>Student</span>
              {ESL_SKILL_LABELS.map((skill) => (
                <span key={skill}>{skill}</span>
              ))}
              <span>Overall</span>
            </div>
            {eslProgressRows.map((learner) => (
              <button
                className="progress-row"
                key={learner.name}
                onClick={() => announce(`${learner.name} progress profile opened`)}
              >
                <span className="learner-cell">
                  <i className={`avatar avatar-small avatar-${learner.tone}`}>
                    {learner.name
                      .split(" ")
                      .map((part) => part[0])
                      .join("")}
                  </i>
                  <span>
                    <strong>{learner.name}</strong>
                    <small>
                      {learner.level} → {learner.target}
                    </small>
                  </span>
                </span>
                {learner.skills.map((value, index) => (
                  <span className="skill-cell" key={ESL_SKILL_LABELS[index]}>
                    <i>
                      <em
                        className={value < 60 ? "amber" : value > 84 ? "mint" : "violet"}
                        style={{ width: `${value}%` }}
                      />
                    </i>
                    <b>{value}</b>
                  </span>
                ))}
                <span className="overall-cell">
                  <strong>{learner.overall}%</strong>
                  <small>{learner.change}</small>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={TrendingUp}
            title="No CEFR progress recorded"
            hint="Grammar, vocabulary, speaking, listening, reading and confidence are tracked per learner."
          />
        )}
      </article>
      <aside className="progress-side">
        <article className="panel cefr-distribution">
          <PanelHeader kicker="Level mix" title="CEFR distribution" />
          <div className="level-bars">
            {cefrDistribution.map(([level, learners]) => (
              <span key={level}>
                <b>{level}</b>
                <i>
                  <em style={{ width: "0%" }} />
                </i>
                <strong>{learners}</strong>
              </span>
            ))}
          </div>
        </article>
      </aside>
    </section>
  );
}

function IELTSProgressArea({ announce }: { announce: Announce }) {
  return (
    <section className="ielts-workspace">
      <article className="panel ielts-matrix">
        <PanelHeader kicker="Band score matrix" title="IELTS Academic candidates" />
        {ieltsBandRows.length ? (
          <>
            <div className="ielts-head">
              <span>Candidate</span>
              <span>Listening</span>
              <span>Reading</span>
              <span>Writing</span>
              <span>Speaking</span>
              <span>Overall</span>
              <span>Target</span>
            </div>
            {ieltsBandRows.map((candidate) => (
              <button
                className="ielts-row"
                key={candidate.name}
                onClick={() => announce(`${candidate.name} IELTS tracker opened`)}
              >
                <span className="candidate-cell">
                  <i className={`avatar avatar-small avatar-${candidate.tone}`}>
                    {candidate.name
                      .split(" ")
                      .map((part) => part[0])
                      .join("")}
                  </i>
                  <span>
                    <strong>{candidate.name}</strong>
                    <small>Test · {candidate.test}</small>
                  </span>
                </span>
                {candidate.scores.map((score, index) => (
                  <span
                    key={index}
                    className={score < 6 ? "low-band" : score >= 7 ? "high-band" : ""}
                  >
                    <b>{score.toFixed(1)}</b>
                  </span>
                ))}
                <span className="overall-band">
                  <b>{candidate.overall.toFixed(1)}</b>
                </span>
                <span>
                  <strong>{candidate.target.toFixed(1)}</strong>
                </span>
              </button>
            ))}
          </>
        ) : (
          <EmptyState
            icon={Gauge}
            title="No band scores recorded"
            hint="Bands are tracked per skill against each candidate’s target and test date."
          />
        )}
      </article>
    </section>
  );
}

function LanguageSkillsArea({ announce }: { announce: Announce }) {
  return (
    <section className="language-skills-workspace">
      <article className="panel language-system-panel">
        <PanelHeader
          kicker="ESL language systems"
          title="Recognition, controlled use and independent use"
        />
        {languageSystemRows.length ? (
          <>
            <div className="language-system-head">
              <span>Language system / skill</span>
              <span>Recognizes</span>
              <span>Controlled use</span>
              <span>Independent use</span>
              <span>Review</span>
              <span />
            </div>
            {languageSystemRows.map((system) => (
              <button
                className="language-system-row"
                key={system.skill}
                onClick={() => announce(`${system.skill} evidence opened`)}
              >
                <span className={`system-icon ${system.tone}`}>
                  <Activity size={15} />
                </span>
                <span>
                  <strong>{system.skill}</strong>
                  <small>{system.focus}</small>
                </span>
                {(
                  [
                    [system.recognition, "recognition"],
                    [system.controlled, "controlled"],
                    [system.independent, "independent"],
                  ] as const
                ).map(([value, label]) => (
                  <span className={`evidence-meter ${label}`} key={label}>
                    <i>
                      <em style={{ width: `${value}%` }} />
                    </i>
                    <b>{value}%</b>
                  </span>
                ))}
                <span>{system.review}</span>
                <ChevronRight size={15} />
              </button>
            ))}
          </>
        ) : (
          <EmptyState
            icon={Activity}
            title="No language evidence yet"
            hint="Each system is tracked three ways: recognized, used in controlled practice, and used independently."
          />
        )}
      </article>
    </section>
  );
}

function WritingTrackerArea({ announce }: { announce: Announce }) {
  return (
    <section className="criterion-workspace">
      <article className="panel criterion-matrix">
        <PanelHeader kicker="IELTS Writing criteria" title="Latest criterion bands" />
        {ieltsWritingRows.length ? (
          <>
            <div className="criterion-head">
              <span>Candidate</span>
              <span>Task</span>
              <span>TA / TR</span>
              <span>CC</span>
              <span>LR</span>
              <span>GRA</span>
              <span>Writing</span>
              <span>Target</span>
            </div>
            {ieltsWritingRows.map((writer) => (
              <button
                className="criterion-row"
                key={writer.name}
                onClick={() => announce(`${writer.name} Writing evidence opened`)}
              >
                <span className={`avatar avatar-small avatar-${writer.tone}`}>
                  {writer.name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")}
                </span>
                <span>
                  <strong>{writer.name}</strong>
                  <small>{writer.scripts} scripts</small>
                </span>
                <em>{writer.task}</em>
                {writer.scores.map((score, index) => (
                  <b
                    key={index}
                    className={
                      score < 6 ? "criterion-low" : score >= 7 ? "criterion-high" : ""
                    }
                  >
                    {score.toFixed(1)}
                  </b>
                ))}
                <strong className="criterion-average">{writer.average.toFixed(1)}</strong>
                <span className="criterion-target">
                  <b>{writer.target.toFixed(1)}</b>
                </span>
              </button>
            ))}
          </>
        ) : (
          <EmptyState
            icon={PenLine}
            title="No Writing scripts marked"
            hint="Task Achievement/Response, Coherence and Cohesion, Lexical Resource and Grammar are scored per script."
          />
        )}
      </article>
      <div className="criterion-bottom">
        <article className="panel error-patterns">
          <PanelHeader
            kicker="Recurring errors"
            title="What is suppressing Writing bands"
          />
          {writingErrorPatterns.length ? (
            <div className="error-list">
              {writingErrorPatterns.map((pattern) => (
                <button
                  key={pattern.error}
                  onClick={() => announce(`${pattern.error} examples opened`)}
                >
                  <span className={`error-count ${pattern.tone}`}>{pattern.count}</span>
                  <span>
                    <strong>{pattern.error}</strong>
                    <small>{pattern.criterion}</small>
                  </span>
                  <ChevronRight size={15} />
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={MessageSquareText}
              title="No error patterns yet"
              hint="Patterns emerge once several scripts have been marked."
            />
          )}
        </article>
      </div>
    </section>
  );
}

function SpeakingTrackerArea({ announce }: { announce: Announce }) {
  return (
    <section className="criterion-workspace">
      <article className="panel criterion-matrix">
        <PanelHeader kicker="IELTS Speaking criteria" title="Latest speaking bands" />
        {ieltsSpeakingRows.length ? (
          <>
            <div className="criterion-head speaking">
              <span>Candidate</span>
              <span>Weakest part</span>
              <span>Fluency</span>
              <span>Lexical</span>
              <span>Grammar</span>
              <span>Pronunciation</span>
              <span>Speaking</span>
              <span>Target</span>
            </div>
            {ieltsSpeakingRows.map((speaker) => (
              <button
                className="criterion-row"
                key={speaker.name}
                onClick={() => announce(`${speaker.name} Speaking evidence opened`)}
              >
                <span className={`avatar avatar-small avatar-${speaker.tone}`}>
                  {speaker.name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")}
                </span>
                <span>
                  <strong>{speaker.name}</strong>
                  <small>Latest full mock</small>
                </span>
                <em>{speaker.part}</em>
                {speaker.scores.map((score, index) => (
                  <b
                    key={index}
                    className={
                      score < 6 ? "criterion-low" : score >= 7 ? "criterion-high" : ""
                    }
                  >
                    {score.toFixed(1)}
                  </b>
                ))}
                <strong className="criterion-average">
                  {speaker.average.toFixed(1)}
                </strong>
                <span className="criterion-target">
                  <b>{speaker.target.toFixed(1)}</b>
                </span>
              </button>
            ))}
          </>
        ) : (
          <EmptyState
            icon={Mic2}
            title="No Speaking mocks scored"
            hint="Fluency and Coherence, Lexical Resource, Grammar and Pronunciation are scored per recording."
          />
        )}
      </article>
      <div className="criterion-bottom">
        <article className="panel speaking-parts">
          <PanelHeader kicker="Part performance" title="Average band by speaking part" />
          {speakingPartAverages.length ? (
            <div className="part-bars">
              {speakingPartAverages.map((entry) => (
                <button
                  key={entry.part}
                  onClick={() => announce(`${entry.part} question-type detail opened`)}
                >
                  <span>
                    <strong>{entry.part}</strong>
                  </span>
                  <i>
                    <em style={{ width: `${entry.width}%` }} />
                  </i>
                  <b>{entry.band}</b>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Mic2}
              title="No part averages"
              hint="Parts 1–3 are compared once recordings have been scored."
            />
          )}
        </article>
      </div>
    </section>
  );
}

function CalendarArea() {
  const [weekIndex, setWeekIndex] = useState(0);
  const [calendarView, setCalendarView] = useState("Week");

  return (
    <section className="calendar-workspace">
      <article className={`panel week-calendar ${calendarView.toLowerCase()}-view`}>
        <div className="calendar-toolbar">
          <div>
            <button
              onClick={() => setWeekIndex((value) => value - 1)}
              aria-label="Previous week"
            >
              <ChevronRight size={16} className="flip" />
            </button>
            <button
              onClick={() => setWeekIndex((value) => value + 1)}
              aria-label="Next week"
            >
              <ChevronRight size={16} />
            </button>
            <button className="today-button" onClick={() => setWeekIndex(0)}>
              Today
            </button>
            <strong>
              {weekIndex === 0
                ? "This week"
                : weekIndex < 0
                  ? `${Math.abs(weekIndex)} week(s) earlier`
                  : `${weekIndex} week(s) ahead`}
            </strong>
          </div>
          <div className="segmented">
            {["Week", "Month"].map((view) => (
              <button
                key={view}
                className={calendarView === view ? "active" : ""}
                onClick={() => setCalendarView(view)}
              >
                {view}
              </button>
            ))}
          </div>
        </div>
        {calendarEvents.length ? null : (
          <EmptyState
            icon={CalendarDays}
            title="Nothing scheduled"
            hint="Lessons, preparation blocks and personal commitments appear on this grid."
          />
        )}
      </article>
      <aside className="calendar-side">
        <article className="panel capacity-card">
          <PanelHeader kicker="Capacity" title="This week" />
          <EmptyState
            icon={Clock3}
            title="No bookings"
            hint="Teaching hours and open blocks are calculated from scheduled lessons."
          />
        </article>
      </aside>
    </section>
  );
}

function TasksArea({ announce }: { announce: Announce }) {
  const [done, setDone] = useState<number[]>([]);
  const [focus, setFocus] = useState("All");
  const [priority, setPriority] = useState("All priorities");

  const priorityOrder: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
  const visibleGroups = taskGroups
    .map((group) => ({
      ...group,
      tasks: group.tasks
        .filter(
          (task) =>
            (focus === "All" ||
              (focus === "Today" && task.meta.startsWith("Today")) ||
              (focus === "Upcoming" && !task.meta.startsWith("Today"))) &&
            (priority === "All priorities" || task.priority === priority),
        )
        .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]),
    }))
    .filter((group) => group.tasks.length);

  const cyclePriority = () =>
    setPriority((value) =>
      value === "All priorities"
        ? "High"
        : value === "High"
          ? "Medium"
          : value === "Medium"
            ? "Low"
            : "All priorities",
    );

  return (
    <section className="tasks-workspace">
      <article className="panel task-list-panel">
        <div className="task-toolbar">
          <div className="segmented">
            {["All", "Today", "Upcoming"].map((item) => (
              <button
                key={item}
                className={focus === item ? "active" : ""}
                onClick={() => setFocus(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <div>
            <button className="filter-button" onClick={cyclePriority}>
              <Filter size={14} /> {priority}
            </button>
          </div>
        </div>
        {visibleGroups.map((group) => (
          <div className="task-group" key={group.label}>
            <div className="task-group-head">
              <span className={`group-dot ${group.tone}`} />
              <strong>{group.label}</strong>
              <b>{group.tasks.filter((task) => !done.includes(task.id)).length}</b>
              <button
                onClick={() => announce(`Create new ${group.label} task`)}
                aria-label={`Add ${group.label} task`}
              >
                <Plus size={15} />
              </button>
            </div>
            {group.tasks.map((task) => (
              <button
                className={`full-task ${done.includes(task.id) ? "done" : ""}`}
                key={task.id}
                onClick={() =>
                  setDone((items) =>
                    items.includes(task.id)
                      ? items.filter((id) => id !== task.id)
                      : [...items, task.id],
                  )
                }
              >
                <span className={`task-check ${done.includes(task.id) ? "checked" : ""}`}>
                  {done.includes(task.id) && <Check size={14} />}
                </span>
                <span>
                  <strong>{task.title}</strong>
                  <small>
                    <CalendarDays size={12} />
                    {task.meta}
                  </small>
                </span>
                <em className={`priority-label ${task.priority.toLowerCase()}`}>
                  {task.priority}
                </em>
              </button>
            ))}
          </div>
        ))}
        {!visibleGroups.length && (
          <div className="task-empty">
            <CheckCircle2 size={24} />
            <strong>No tasks yet</strong>
            <span>Capture a next action with Quick add.</span>
          </div>
        )}
      </article>
      <aside className="tasks-side">
        <article className="panel task-focus">
          <PanelHeader kicker="Focus mode" title="Next best action" />
          <EmptyState
            icon={NotebookPen}
            title="Nothing to focus on"
            hint="Your highest-priority task appears here."
          />
        </article>
      </aside>
    </section>
  );
}

function GoalsArea({ announce }: { announce: Announce }) {
  return (
    <section className="goals-workspace">
      {goals.length ? (
        <div className="goal-grid">
          {goals.map((goal) => {
            const Icon = goal.icon;
            return (
              <button
                className="goal-card panel"
                key={goal.title}
                onClick={() => announce(`${goal.title} opened`)}
              >
                <div className="goal-top">
                  <span className={`goal-icon ${goal.tone}`}>
                    <Icon size={18} />
                  </span>
                </div>
                <span className="goal-area">{goal.area}</span>
                <h3>{goal.title}</h3>
                <div className="goal-progress-row">
                  <i>
                    <em className={goal.tone} style={{ width: `${goal.progress}%` }} />
                  </i>
                  <strong>{goal.progress}%</strong>
                </div>
                <footer>
                  <span>{goal.target}</span>
                  <b>{goal.metric}</b>
                </footer>
              </button>
            );
          })}
        </div>
      ) : (
        <article className="panel">
          <EmptyState
            icon={Target}
            title="No goals set"
            hint="Connect student outcomes, teaching quality and business growth to concrete work."
          />
        </article>
      )}
    </section>
  );
}

function ProjectsArea({ announce }: { announce: Announce }) {
  const [projectView, setProjectView] = useState("Active");
  const shown = projects.filter(
    (project) =>
      projectView === "All" ||
      (projectView === "Active" && project.progress < 85) ||
      (projectView === "Completed" && project.progress >= 85),
  );

  return (
    <section className="projects-workspace">
      <div className="project-toolbar">
        <div className="segmented">
          {["Active", "Completed", "All"].map((view) => (
            <button
              key={view}
              className={projectView === view ? "active" : ""}
              onClick={() => setProjectView(view)}
            >
              {view}
            </button>
          ))}
        </div>
        {projectCategories.length > 0 && (
          <button className="filter-button" onClick={() => announce("Categories opened")}>
            <Filter size={14} /> All categories
          </button>
        )}
      </div>
      <div className="project-grid">
        {shown.map((project) => (
          <button
            className="project-card panel"
            key={project.title}
            onClick={() => announce(`${project.title} opened`)}
          >
            <div className={`project-cover ${project.tone}`}>
              <span>{project.category}</span>
              <FolderKanban size={27} />
            </div>
            <div className="project-body">
              <h3>{project.title}</h3>
              <div className="project-progress">
                <i>
                  <em className={project.tone} style={{ width: `${project.progress}%` }} />
                </i>
                <b>{project.progress}%</b>
              </div>
            </div>
          </button>
        ))}
        <button className="new-project-card" onClick={() => announce("Create new project")}>
          <Plus size={24} />
          <strong>Start a new project</strong>
          <span>Curriculum, content or business</span>
        </button>
      </div>
    </section>
  );
}

function ReportsArea({ track, announce }: { track: Track; announce: Announce }) {
  const reports = reportsByTrack[track];
  const weeks = weeklyLessonCountsByTrack[track];

  return (
    <section className="reports-workspace">
      <div className="report-top">
        <article className="panel workload-report">
          <PanelHeader
            kicker={`${track} teaching workload`}
            title={`${track} lessons delivered`}
          />
          {weeks.length ? null : (
            <EmptyState
              icon={TrendingUp}
              title="No lessons to report"
              hint="Workload, attendance and delivery trends are calculated from delivered lessons."
            />
          )}
        </article>
      </div>
      {reports.length ? (
        <div className="report-grid">
          {reports.map((report) => {
            const Icon = report.icon;
            return (
              <button
                className="report-card panel"
                key={report.title}
                onClick={() => announce(`${report.title} report opened`)}
              >
                <span>
                  <Icon size={18} />
                </span>
                <div>
                  <strong>{report.title}</strong>
                  <p>{report.description}</p>
                  <small>{report.updated}</small>
                </div>
                <ArrowUpRight size={15} />
              </button>
            );
          })}
        </div>
      ) : (
        <article className="panel">
          <EmptyState
            icon={FileText}
            title={`No ${track} reports available`}
            hint={
              track === "ESL"
                ? "CEFR movement, production gaps and unit coverage need progress records first."
                : "Band movement, rubric gaps and mock trends need scored assessments first."
            }
          />
        </article>
      )}
    </section>
  );
}

function MaterialsArea({ track, announce }: { track: Track; announce: Announce }) {
  const [query, setQuery] = useState("");
  const [skill, setSkill] = useState("All");
  const trackMaterials = materials.filter((material) =>
    track === "ESL"
      ? !material.level.includes("IELTS")
      : material.level.includes("IELTS"),
  );
  const shown = trackMaterials.filter(
    (material) =>
      (skill === "All" || material.skill === skill) &&
      material.title.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <section className="materials-workspace">
      <div className="materials-toolbar">
        <label>
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${track} materials...`}
          />
        </label>
        <div className="material-filters">
          {materialSkillFiltersByTrack[track].map((item) => (
            <button
              key={item}
              className={skill === item ? "active" : ""}
              onClick={() => setSkill(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="materials-layout">
        <div className="materials-grid">
          {shown.map((material) => {
            const Icon = material.icon;
            return (
              <button
                className="material-card panel"
                key={material.title}
                onClick={() => announce(`${material.title} opened`)}
              >
                <div className={`material-thumb ${material.tone}`}>
                  <span className="material-format">
                    <Icon size={19} />
                  </span>
                  <span className="material-skill">{material.skill}</span>
                </div>
                <div className="material-body">
                  <span>{material.type}</span>
                  <h3>{material.title}</h3>
                  <div>
                    <span>{material.level}</span>
                  </div>
                </div>
              </button>
            );
          })}
          {!shown.length && (
            <div className="material-empty">
              <Search size={24} />
              <strong>No {track} materials yet</strong>
              <span>Upload worksheets, prompts, audio and rubrics to build your library.</span>
            </div>
          )}
        </div>
        <aside className="materials-side">
          <article className="panel collection-list">
            <PanelHeader
              kicker={`${track} collections`}
              title={`${track} teaching library`}
            />
            {collectionsByTrack[track].length ? (
              collectionsByTrack[track].map(([title, itemCount, tone]) => (
                <button key={title} onClick={() => announce(`${title} collection opened`)}>
                  <span className={`collection-icon ${tone}`}>
                    <FolderKanban size={16} />
                  </span>
                  <span>
                    <strong>{title}</strong>
                    <small>{itemCount}</small>
                  </span>
                  <ChevronRight size={15} />
                </button>
              ))
            ) : (
              <EmptyState
                icon={FolderKanban}
                title="No collections"
                hint="Group materials by level, skill or course."
              />
            )}
          </article>
          <article className="panel recently-used">
            <PanelHeader kicker="Quick access" title="Recently used" />
            {recentMaterialsByTrack[track].length ? null : (
              <EmptyState
                icon={FileText}
                title="Nothing used yet"
                hint="Materials opened during lessons appear here."
              />
            )}
          </article>
        </aside>
      </div>
    </section>
  );
}

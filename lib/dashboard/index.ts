/**
 * Dashboard triage.
 *
 * Pure derivations over the records in `lib/types/domain.ts`. No component
 * imports, no data fetching, no clock access — every function takes `now`
 * explicitly so the rules can be tested and so server and client renders agree.
 *
 * The organising principle is the productivity rule this dashboard was built
 * to: **decide and act in under 30 seconds.** Today runs the day; Reports is
 * for reflection. Anything here that does not help the teacher decide what to
 * do in the next half-minute belongs on one of those two instead.
 */

export * from "./action-inbox";
export * from "./at-risk";
export * from "./capacity";
export * from "./goals-due";
export * from "./next-lesson";
export * from "./prep-checklist";
export * from "./stats";
export * from "./time";

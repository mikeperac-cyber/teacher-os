"use client";

/**
 * Feature 8 — derived, clickable stats.
 *
 * Each tile is a route into the filtered list that explains it, so a number is
 * never a dead end. Figures are computed in `lib/dashboard/stats.ts`; a value
 * that cannot be derived renders "—" rather than an invented one.
 */

import { ArrowRight } from "lucide-react";

import type { DashboardStat, DeepLink } from "@/lib/types/dashboard";

export function StatTiles({
  stats,
  navigate,
}: {
  stats: DashboardStat[];
  navigate: (link: DeepLink) => void;
}) {
  return (
    <section className="stat-grid">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <button
            key={stat.id}
            className={`metric-card ${stat.pending ? "is-pending" : ""}`}
            onClick={() => navigate(stat.link)}
            aria-label={`Open ${stat.label}`}
          >
            <div className={`metric-icon ${stat.tone}`}>
              <Icon size={19} />
            </div>
            <div>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              <small>{stat.note}</small>
            </div>
            <span className="metric-open">
              <ArrowRight size={15} />
            </span>
          </button>
        );
      })}
    </section>
  );
}

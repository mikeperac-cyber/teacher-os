"use client";

import { useEffect, useState } from "react";
import { FileText, TrendingUp, CalendarDays, Loader2 } from "lucide-react";
import { EmptyState, PanelHeader } from "@/components/primitives";
import type { Track } from "@/lib/types/ui";

type ReportData = {
  totalLessons: number;
  deliveredLessons: number;
  upcomingLessons: number;
  weeklyCounts: { weekStart: string; count: number }[];
  eslTrends: { at: string; value: number }[];
  ieltsTrends: { at: string; value: number }[];
  capacityUtilization: { date: string; lessons: number; capacity: number | null }[];
};

export function ReportsContent({ workspaceId, track }: { workspaceId: string | null; track: Track }) {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) {
      setLoading(false);
      return;
    }
    void fetch(`/api/reports?workspaceId=${workspaceId}&track=${track.toLowerCase()}`)
      .then((r) => r.json())
      .then((json) => {
        setData(json as ReportData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [workspaceId, track]);

  if (loading) {
    return (
      <section className="reports-workspace">
        <div className="panel" style={{ padding: 24 }}>
          <Loader2 size={18} className="spin" /> Building reports…
        </div>
      </section>
    );
  }

  if (!workspaceId) {
    return (
      <section className="reports-workspace">
        <article className="panel">
          <EmptyState icon={FileText} title="Sign in to see reports" hint="Reports are built from your lessons, homework and progress records." />
        </article>
      </section>
    );
  }

  if (!data || (data.totalLessons === 0 && data.eslTrends.length === 0 && data.ieltsTrends.length === 0)) {
    return (
      <section className="reports-workspace">
        <div className="report-top">
          <article className="panel workload-report">
            <PanelHeader kicker={`${track} teaching workload`} title={`${track} lessons delivered`} />
            <EmptyState icon={TrendingUp} title="No lessons to report" hint="Workload, attendance and delivery trends are calculated from delivered lessons." />
          </article>
        </div>
        <article className="panel">
          <EmptyState
            icon={FileText}
            title={`No ${track} reports available`}
            hint={track === "ESL" ? "CEFR movement, production gaps and unit coverage need progress records first." : "Band movement, rubric gaps and mock trends need scored assessments first."}
          />
        </article>
      </section>
    );
  }

  const maxCount = Math.max(1, ...data.weeklyCounts.map((w) => w.count));

  return (
    <section className="reports-workspace">
      <div className="report-top">
        <article className="panel workload-report">
          <PanelHeader kicker={`${track} teaching workload`} title={`${track} lessons delivered`} />
          <div className="workload-chart">
            <div className="workload-y">
              <span>{maxCount}</span>
              <span>0</span>
            </div>
            <div className="workload-bars">
              {data.weeklyCounts.map((w) => (
                <div key={w.weekStart} title={`${w.weekStart}: ${w.count}`}>
                  <i className={w.count === maxCount ? "active" : ""} style={{ height: `${(w.count / maxCount) * 120 + 10}px` }}>
                    <span>{w.count}</span>
                  </i>
                  <small>{w.weekStart.slice(5)}</small>
                </div>
              ))}
              {data.weeklyCounts.length === 0 && <small>No weekly data</small>}
            </div>
          </div>
          <div className="report-callouts">
            <span>
              <strong>{data.deliveredLessons}</strong>
              <small>delivered</small>
            </span>
            <span>
              <strong>{data.upcomingLessons}</strong>
              <small>upcoming</small>
            </span>
            <span>
              <strong>{data.totalLessons}</strong>
              <small>total in window</small>
            </span>
          </div>
        </article>
        <article className="panel outcome-report">
          <PanelHeader kicker="Capacity" title="Lessons vs capacity (14 days)" />
          <div style={{ padding: 12 }}>
            {data.capacityUtilization.map((row) => (
              <div key={row.date} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: "1px solid #f0f0f2", fontSize: 11 }}>
                <span>{row.date}</span>
                <span>
                  {row.lessons} lessons {row.capacity !== null ? `· capacity ${row.capacity}` : "· no capacity set"}
                  {row.capacity !== null && row.lessons > row.capacity && <em style={{ color: "#b85252", marginLeft: 6 }}>overbooked</em>}
                </span>
              </div>
            ))}
            {data.capacityUtilization.length === 0 && <EmptyState icon={CalendarDays} title="No utilization yet" hint="Set day capacities in Calendar to see overbooking." />}
          </div>
        </article>
      </div>

      <div className="report-grid">
        {track === "ESL" ? (
          <article className="panel report-card">
            <span>
              <TrendingUp size={18} />
            </span>
            <div>
              <strong>CEFR mastery trend</strong>
              <p>{data.eslTrends.length ? `${data.eslTrends.length} progress entries — latest ${data.eslTrends[data.eslTrends.length - 1].value}%` : "No progress yet"}</p>
              <small>{data.eslTrends.length ? `From ${data.eslTrends[0].at.slice(0, 10)} to ${data.eslTrends[data.eslTrends.length - 1].at.slice(0, 10)}` : "Record ESL progress to see movement"}</small>
            </div>
          </article>
        ) : (
          <article className="panel report-card">
            <span>
              <TrendingUp size={18} />
            </span>
            <div>
              <strong>Band movement</strong>
              <p>{data.ieltsTrends.length ? `${data.ieltsTrends.length} band points — latest ${data.ieltsTrends[data.ieltsTrends.length - 1].value.toFixed(1)}` : "No bands yet"}</p>
              <small>{data.ieltsTrends.length ? `From ${data.ieltsTrends[0].at} to ${data.ieltsTrends[data.ieltsTrends.length - 1].at}` : "Record IELTS bands to see movement"}</small>
            </div>
          </article>
        )}

        <article className="panel report-card">
          <span>
            <CalendarDays size={18} />
          </span>
          <div>
            <strong>Delivery consistency</strong>
            <p>{data.weeklyCounts.length ? `${data.weeklyCounts.filter((w) => w.count > 0).length} active weeks of ${data.weeklyCounts.length}` : "No weeks yet"}</p>
            <small>Weeks with at least one lesson</small>
          </div>
        </article>

        <article className="panel report-card">
          <span>
            <FileText size={18} />
          </span>
          <div>
            <strong>Next steps</strong>
            <p>Keep recording lessons, progress and feedback — reports grow automatically.</p>
            <small>All reports are per-track and never merge ESL/IELTS scores.</small>
          </div>
        </article>
      </div>
    </section>
  );
}

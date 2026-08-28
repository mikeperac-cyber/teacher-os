"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, CalendarDays, Mail, Link2, Loader2, Plug, Unplug } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/browser";
import { upsertIntegration, disconnectIntegration } from "@/lib/actions/integrations";
import { PanelHeader } from "@/components/primitives";

type Integration = {
  id: string;
  provider: string;
  status: string;
  last_synced_at: string | null;
  config: Record<string, unknown>;
};

const PROVIDERS: { id: string; label: string; icon: typeof Mail; hint: string }[] = [
  { id: "google_calendar", label: "Google Calendar", icon: CalendarDays, hint: "Sync lessons and prep blocks to your calendar." },
  { id: "outlook_calendar", label: "Outlook Calendar", icon: CalendarDays, hint: "Sync via Microsoft Graph." },
  { id: "resend", label: "Email (Resend)", icon: Mail, hint: "Send homework and feedback notifications." },
  { id: "google_gmail", label: "Gmail", icon: Mail, hint: "Send via Gmail API." },
  { id: "ical", label: "iCal feed", icon: Link2, hint: "Subscribe to your teaching calendar from any app." },
];

export function IntegrationPanel({ workspaceId }: { workspaceId: string | null }) {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    if (!workspaceId) {
      setLoading(false);
      return;
    }
    const supabase = getBrowserClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    const { data } = await supabase.from("integrations").select("id, provider, status, last_synced_at, config").eq("workspace_id", workspaceId);
    setIntegrations((data ?? []) as Integration[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [workspaceId]);

  const connect = async (provider: string) => {
    if (!workspaceId) {
      setMessage("Not signed in to a workspace.");
      return;
    }
    setBusy(provider);
    const res = await upsertIntegration({ workspaceId, provider: provider as never, status: "connected", config: { connectedAt: new Date().toISOString() } });
    if (!res.ok) setMessage(res.error);
    else {
      setMessage(`Connected ${provider}.`);
      void load();
    }
    setBusy(null);
  };

  const disconnect = async (integrationId: string) => {
    setBusy(integrationId);
    const res = await disconnectIntegration({ integrationId });
    if (!res.ok) setMessage(res.error);
    else {
      setMessage("Disconnected.");
      void load();
    }
    setBusy(null);
  };

  if (loading) {
    return (
      <section className="panel" style={{ padding: 20 }}>
        <Loader2 size={18} className="spin" /> Loading integrations…
      </section>
    );
  }

  if (!workspaceId) {
    return (
      <section className="panel" style={{ padding: 20, color: "#6f7789" }}>
        Sign in to a workspace to manage integrations.
      </section>
    );
  }

  const byProvider = new Map(integrations.map((i) => [i.provider, i]));

  return (
    <section className="integrations-workspace">
      <article className="panel">
        <PanelHeader kicker="Connected services" title="Email & Calendar" />
        <div style={{ padding: 12, display: "grid", gap: 10 }}>
          {PROVIDERS.map((p) => {
            const existing = byProvider.get(p.id);
            const connected = existing?.status === "connected";
            const Icon = p.icon;
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, border: "1px solid #e8e8ec", borderRadius: 10, background: connected ? "#f6f5fb" : "#fff" }}>
                <span className={`material-format ${connected ? "violet" : "blue"}`} style={{ width: 38, height: 38, display: "grid", placeItems: "center", borderRadius: 9 }}>
                  <Icon size={18} />
                </span>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: 12 }}>{p.label}</strong>
                  <p style={{ margin: "2px 0 0", color: "#6f7789", fontSize: 11 }}>{p.hint}</p>
                  {connected && existing?.last_synced_at && <small style={{ color: "#9a9fab", fontSize: 10 }}>Last synced {new Date(existing.last_synced_at).toLocaleString()}</small>}
                </div>
                <span
                  style={{
                    padding: "4px 8px",
                    borderRadius: 6,
                    fontSize: 10,
                    background: connected ? "#d9f3e9" : "#f1f1f4",
                    color: connected ? "#217d5f" : "#6f7789",
                  }}
                >
                  {connected ? "Connected" : "Not connected"}
                </span>
                {connected ? (
                  <button className="secondary-button" onClick={() => void disconnect(existing.id)} disabled={busy === existing.id}>
                    {busy === existing.id ? <Loader2 size={14} className="spin" /> : <Unplug size={14} />} Disconnect
                  </button>
                ) : (
                  <button className="primary-button" onClick={() => void connect(p.id)} disabled={busy === p.id}>
                    {busy === p.id ? <Loader2 size={14} className="spin" /> : <Plug size={14} />} Connect
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {message && (
          <div style={{ padding: "0 16px 16px", fontSize: 11, color: message.includes("Connected") ? "#2ca77b" : "#b85252", display: "flex", gap: 6, alignItems: "center" }}>
            {message.includes("Connected") ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />} {message}
          </div>
        )}
        <div style={{ padding: "0 16px 16px", color: "#6f7789", fontSize: 11 }}>
          Calendar pushes pull lessons and preparation blocks to your external calendar via the provider API (stubbed until OAuth credentials are provisioned in Supabase Vault / Vercel env). Email uses <code>RESEND_API_KEY</code> when set — otherwise it logs a dry run so you can test locally without keys.
        </div>
      </article>

      {byProvider.has("ical") && (
        <article className="panel" style={{ padding: 16 }}>
          <PanelHeader kicker="iCal" title="Subscribe URL" />
          <code style={{ display: "block", padding: 10, background: "#f6f7f9", borderRadius: 8, fontSize: 11, wordBreak: "break-all" }}>
            {typeof window !== "undefined" ? `${window.location.origin}/api/calendar/ical?workspaceId=${workspaceId}` : `/api/calendar/ical?workspaceId=${workspaceId}`}
          </code>
          <small style={{ color: "#6f7789", fontSize: 10 }}>Add this URL to Google Calendar, Outlook or Apple Calendar. It updates automatically.</small>
        </article>
      )}
    </section>
  );
}

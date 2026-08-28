"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, FileText, Loader2, Paperclip, X } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/browser";
import { attachMaterialToLesson, detachMaterialFromLesson } from "@/lib/actions/materials";
import { PanelHeader } from "@/components/primitives";

type Material = { id: string; title: string; kind: string | null; skill: string | null; level_label: string | null };

export function LessonMaterials({
  workspaceId,
  lessonId,
}: {
  workspaceId: string | null;
  lessonId: string;
}) {
  const [attached, setAttached] = useState<Material[]>([]);
  const [available, setAvailable] = useState<Material[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const load = async () => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    const { data: links } = await supabase
      .from("lesson_materials")
      .select("material_id, materials ( id, title, kind, skill, level_label )")
      .eq("lesson_id", lessonId);
    const mats = ((links ?? []) as unknown as { materials: Material }[]).map((r) => r.materials).filter(Boolean);
    setAttached(mats);

    if (workspaceId) {
      const { data: all } = await supabase.from("materials").select("id, title, kind, skill, level_label").eq("workspace_id", workspaceId).limit(100);
      const attachedIds = new Set(mats.map((m) => m.id));
      setAvailable(((all ?? []) as Material[]).filter((m) => !attachedIds.has(m.id)));
    }
  };

  useEffect(() => {
    void load();
  }, [lessonId, workspaceId]);

  const attach = async (materialId: string) => {
    if (!workspaceId) return;
    const res = await attachMaterialToLesson({ workspaceId, lessonId, materialId });
    if (!res.ok) setStatus(res.error);
    else {
      setStatus("Attached.");
      void load();
    }
  };

  const detach = async (materialId: string) => {
    const res = await detachMaterialFromLesson({ lessonId, materialId });
    if (!res.ok) setStatus(res.error);
    else {
      setStatus("Removed.");
      void load();
    }
  };

  return (
    <article className="panel">
      <PanelHeader kicker="Lesson resources" title="Materials attached" action={<button className="ghost-button" onClick={() => setPicking((v) => !v)}><Paperclip size={14} /> {picking ? "Done" : "Add"}</button>} />
      <div className="attached-list">
        {attached.length === 0 && <p style={{ padding: 12, color: "#6f7789", fontSize: 11 }}>No materials attached. Attach worksheets or prompts the learner will need.</p>}
        {attached.map((m) => (
          <div key={m.id} className="attached-item">
            <span className="file-icon violet"><FileText size={15} /></span>
            <span>
              <strong>{m.title}</strong>
              <small>{[m.kind, m.skill].filter(Boolean).join(" · ")}</small>
            </span>
            <button onClick={() => void detach(m.id)} aria-label={`Remove ${m.title}`}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      {picking && (
        <div style={{ padding: 12, borderTop: "1px solid #e8e8ec" }}>
          {available.length === 0 ? (
            <p style={{ color: "#6f7789", fontSize: 11 }}>No more materials in this workspace. Upload one in the Materials area.</p>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {available.map((m) => (
                <button key={m.id} className="secondary-button" onClick={() => void attach(m.id)}>
                  <FileText size={14} /> {m.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {status && <p style={{ padding: "0 12px 12px", fontSize: 11, color: status.includes("Attached") || status.includes("Removed") ? "#2ca77b" : "#b85252" }}>{status}</p>}
    </article>
  );
}

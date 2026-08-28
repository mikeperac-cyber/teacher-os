"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, FileText, FolderKanban, Loader2, Search, Upload, Trash2 } from "lucide-react";
import { EmptyState, PanelHeader } from "@/components/primitives";
import { createMaterial } from "@/lib/actions/files";
import { getBrowserClient } from "@/lib/supabase/browser";
import { FileUpload } from "@/components/files/FileUpload";
import type { Track } from "@/lib/types/ui";

type Material = {
  id: string;
  title: string;
  kind: string | null;
  skill: string | null;
  level_label: string | null;
  track: string | null;
  storage_path: string | null;
  use_count: number;
};

export function MaterialsLibrary({ workspaceId, track }: { workspaceId: string | null; track: Track }) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("");
  const [skill, setSkill] = useState("");
  const [level, setLevel] = useState("");
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
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
    const { data } = await supabase
      .from("materials")
      .select("id, title, kind, skill, level_label, track, storage_path, use_count")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    setMaterials((data ?? []) as Material[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [workspaceId]);

  const filtered = materials.filter((m) => {
    const matchesQuery = !query || `${m.title} ${m.kind ?? ""} ${m.skill ?? ""}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery;
  });

  const saveMaterial = async () => {
    if (!workspaceId) {
      setStatus("failed");
      setMessage("Not signed in to a workspace.");
      return;
    }
    if (!title.trim()) {
      setStatus("failed");
      setMessage("Give the material a title.");
      return;
    }
    setStatus("saving");
    setMessage(null);
    const result = await createMaterial({
      workspaceId,
      title: title.trim(),
      kind: kind || undefined,
      skill: skill || undefined,
      levelLabel: level || undefined,
      track: track,
      storagePath: pendingPath ?? undefined,
    });
    if (result.ok) {
      setStatus("saved");
      setMessage("Material added.");
      setTitle("");
      setKind("");
      setSkill("");
      setLevel("");
      setPendingPath(null);
      setShowUpload(false);
      void load();
      return;
    }
    setStatus("failed");
    setMessage(result.error);
  };

  if (loading) {
    return (
      <section className="materials-workspace">
        <div className="panel" style={{ padding: 24 }}>
          <Loader2 size={18} className="spin" /> Loading materials…
        </div>
      </section>
    );
  }

  return (
    <section className="materials-workspace">
      <div className="materials-toolbar">
        <label>
          <Search size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${track} materials…`} />
        </label>
        <div className="material-filters">
          {["All", "Worksheet", "Audio", "Slides", "Rubric"].map((item) => (
            <button key={item} className={kind === item ? "active" : ""} onClick={() => setKind((v) => (v === item ? "" : item))}>
              {item}
            </button>
          ))}
        </div>
        <button className="primary-button" onClick={() => setShowUpload((v) => !v)}>
          <Upload size={15} /> Upload
        </button>
      </div>

      {showUpload && (
        <article className="panel" style={{ padding: 16 }}>
          <PanelHeader kicker="New material" title="Add to library" />
          <div className="workflow-form">
            <label>
              <span>Title</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Past tenses — controlled practice pack" />
            </label>
            <div className="form-row">
              <label>
                <span>Kind</span>
                <input value={kind} onChange={(e) => setKind(e.target.value)} placeholder="Worksheet pack" />
              </label>
              <label>
                <span>Skill</span>
                <input value={skill} onChange={(e) => setSkill(e.target.value)} placeholder={track === "ESL" ? "Grammar" : "Writing"} />
              </label>
            </div>
            <label>
              <span>Level</span>
              <input value={level} onChange={(e) => setLevel(e.target.value)} placeholder={track === "ESL" ? "CEFR B1" : "IELTS 5.5–7.0"} />
            </label>

            {workspaceId && (
              <FileUpload
                workspaceId={workspaceId}
                bucketId="materials"
                onUploaded={(path) => setPendingPath(path)}
                label="Drop file or click to attach"
                accept=".pdf,.docx,.pptx,.png,.jpg,.webp,.svg,.mp3,.wav,.mp4,.txt,.md"
                maxSizeMB={50}
              />
            )}
            {pendingPath && <p className="file-status is-success"><CheckCircle2 size={14} /> File attached: {pendingPath.split("/").pop()}</p>}

            {status === "failed" && message && (
              <p className="create-modal-error"><AlertCircle size={15} /> {message}</p>
            )}
            {status === "saved" && message && (
              <p className="create-modal-notice"><CheckCircle2 size={15} /> {message}</p>
            )}

            <div className="workflow-actions">
              <button className="secondary-button" onClick={() => setShowUpload(false)}>Cancel</button>
              <button className="primary-button" onClick={() => void saveMaterial()} disabled={status === "saving"}>
                {status === "saving" ? <><Loader2 size={14} className="spin" /> Saving…</> : "Add material"}
              </button>
            </div>
          </div>
        </article>
      )}

      <div className="materials-layout">
        <div className="materials-grid">
          {filtered.map((material) => (
            <article key={material.id} className="material-card panel">
              <div className={`material-thumb ${material.track === "esl" ? "mint" : material.track === "ielts" ? "violet" : "blue"}`}>
                <span className="material-format"><FileText size={19} /></span>
                {material.skill && <span className="material-skill">{material.skill}</span>}
              </div>
              <div className="material-body">
                <span>{material.kind ?? "Material"} · {material.use_count} uses</span>
                <h3>{material.title}</h3>
                <div>
                  <span>{material.level_label ?? material.track ?? track}</span>
                </div>
              </div>
            </article>
          ))}
          {!filtered.length && (
            <div className="material-empty panel">
              <Search size={24} />
              <strong>No {track} materials yet</strong>
              <span>Upload worksheets, prompts, audio and rubrics to build your library.</span>
            </div>
          )}
        </div>
        <aside className="materials-side">
          <article className="panel collection-list">
            <PanelHeader kicker={`${track} library`} title={`${filtered.length} materials`} />
            <div style={{ padding: 12, color: "#6f7789", fontSize: 12 }}>
              {filtered.length === 0 ? "No materials yet." : "All materials are private. Link one to a lesson to share with the learner."}
            </div>
          </article>
        </aside>
      </div>
    </section>
  );
}

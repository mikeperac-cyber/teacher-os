"use client";

import { useState, useRef } from "react";
import { AlertCircle, CheckCircle2, Loader2, Upload, X } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/browser";
import { recordFile } from "@/lib/actions/files";

type BucketId = "homework-submissions" | "speaking-recordings" | "materials" | "avatars";

export function FileUpload({
  workspaceId,
  studentId,
  bucketId,
  submissionId,
  materialId,
  onUploaded,
  accept,
  maxSizeMB,
  label,
}: {
  workspaceId: string;
  studentId?: string;
  bucketId: BucketId;
  submissionId?: string;
  materialId?: string;
  onUploaded?: (path: string, file: { name: string; size: number; type: string }) => void;
  accept?: string;
  maxSizeMB?: number;
  label?: string;
}) {
  const [status, setStatus] = useState<"idle" | "uploading" | "saved" | "failed">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const limit = (maxSizeMB ?? (bucketId === "materials" ? 50 : bucketId === "speaking-recordings" ? 100 : 25)) * 1024 * 1024;
    if (file.size > limit) {
      setStatus("failed");
      setMessage(`File too large. Limit is ${Math.round(limit / 1024 / 1024)} MB.`);
      return;
    }

    setStatus("uploading");
    setMessage(null);

    // Build storage path per DATA_MODEL.md convention
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const stamp = Date.now();
    let storagePath: string;
    if (bucketId === "materials") {
      const mid = materialId ?? crypto.randomUUID();
      storagePath = `${workspaceId}/${mid}/${stamp}-${safeName}`;
    } else if (bucketId === "avatars") {
      // workspaceId param is userId for avatars
      const browserForAuth = getBrowserClient();
      const { data: { user } } = browserForAuth ? await browserForAuth.auth.getUser() : { data: { user: null } };
      const uid = user?.id ?? workspaceId;
      storagePath = `${uid}/${stamp}-${safeName}`;
    } else {
      const sid = studentId;
      const sub = submissionId ?? crypto.randomUUID();
      if (!sid) {
        setStatus("failed");
        setMessage("Missing student for this upload.");
        return;
      }
      storagePath = `${workspaceId}/${sid}/${sub}/${stamp}-${safeName}`;
    }

    try {
      const supabase = getBrowserClient();
      if (!supabase) {
        setStatus("failed");
        setMessage("Supabase not configured.");
        return;
      }
      const { error: uploadError } = await supabase.storage.from(bucketId).upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (uploadError) {
        setStatus("failed");
        setMessage(uploadError.message);
        return;
      }

      const result = await recordFile({
        workspaceId,
        bucketId,
        storagePath,
        originalName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        studentId,
        submissionId,
      });

      if (!result.ok) {
        setStatus("failed");
        setMessage(result.error);
        return;
      }

      setStatus("saved");
      setMessage("Uploaded.");
      onUploaded?.(storagePath, { name: file.name, size: file.size, type: file.type });
      setTimeout(() => {
        setStatus("idle");
        setMessage(null);
      }, 2000);
    } catch (e) {
      setStatus("failed");
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className={`file-upload ${dragOver ? "is-dragging" : ""}`}>
      <label
        className="file-drop"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleFiles(e.dataTransfer.files);
        }}
      >
        <Upload size={18} />
        <span>{label ?? `Drop file here or click to upload`}</span>
        <small>{accept ?? "PDF, images, audio, docx, txt"} · {(maxSizeMB ?? 25)} MB max</small>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          hidden
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </label>

      {status === "uploading" && (
        <p className="file-status is-uploading">
          <Loader2 size={14} className="spin" /> Uploading…
        </p>
      )}
      {status === "failed" && message && (
        <p className="file-status is-error" role="alert">
          <AlertCircle size={14} /> {message}
        </p>
      )}
      {status === "saved" && message && (
        <p className="file-status is-success" role="status">
          <CheckCircle2 size={14} /> {message}
        </p>
      )}
    </div>
  );
}

export function InlineFileDrop({
  workspaceId,
  studentId,
  bucketId,
  submissionId,
  onUploaded,
}: {
  workspaceId: string;
  studentId?: string;
  bucketId: BucketId;
  submissionId?: string;
  onUploaded?: (path: string) => void;
}) {
  return (
    <FileUpload
      workspaceId={workspaceId}
      studentId={studentId}
      bucketId={bucketId}
      submissionId={submissionId}
      onUploaded={(path) => onUploaded?.(path)}
      label="Attach a file"
    />
  );
}

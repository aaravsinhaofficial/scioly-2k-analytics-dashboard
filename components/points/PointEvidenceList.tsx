import { ExternalLink, FileAudio, FileImage, FileText, FileVideo, Paperclip } from "lucide-react";
import type { PointEvidence } from "@/lib/types";

function EvidenceIcon({ evidence }: { evidence: PointEvidence }) {
  if (evidence.kind === "link") return <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />;
  if (evidence.mimeType?.startsWith("image/")) return <FileImage className="h-3.5 w-3.5" aria-hidden="true" />;
  if (evidence.mimeType?.startsWith("video/")) return <FileVideo className="h-3.5 w-3.5" aria-hidden="true" />;
  if (evidence.mimeType?.startsWith("audio/")) return <FileAudio className="h-3.5 w-3.5" aria-hidden="true" />;
  if (evidence.mimeType === "application/pdf") return <FileText className="h-3.5 w-3.5" aria-hidden="true" />;
  return <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />;
}

export function PointEvidenceList({ evidence = [] }: { evidence?: PointEvidence[] }) {
  if (evidence.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Submission evidence">
      {evidence.map((item) => (
        <a
          key={item.id}
          href={item.href}
          target="_blank"
          rel="noreferrer"
          title={item.name}
          className="inline-flex max-w-48 items-center gap-1.5 rounded-md border border-court-line bg-court-elevated px-2 py-1 text-xs font-medium text-zinc-600 transition hover:border-cyan-400 hover:text-white"
        >
          <EvidenceIcon evidence={item} />
          <span className="truncate">{item.name}</span>
        </a>
      ))}
    </div>
  );
}

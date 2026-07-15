"use client";

import { DndContext, type DragEndEvent, useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ReadinessBadge } from "@/components/ReadinessBadge";
import { AdminDialog } from "@/components/admin/AdminDialog";

interface RosterMember {
  id: string;
  name: string;
  readiness: number;
  status: "Needs data" | "Developing" | "On track" | "Ready";
}

interface RosterGroup {
  id: string;
  name?: string;
  schoolName?: string;
  label: string;
  designation?: string;
  version?: number;
  readiness: number;
  members: RosterMember[];
}

interface TeamEditorState {
  mode: "create" | "edit";
  teamId?: string;
  name: string;
  schoolName: string;
  designation: string;
}

interface TeamMutationPayload {
  ok?: boolean;
  persisted?: boolean;
  message?: string;
  error?: string;
  team?: {
    id: string;
    name: string;
    schoolName: string;
    designation: string;
    version: number;
  };
}

interface RosterManagerProps {
  rosters: RosterGroup[];
}

function DraggableMember({ member, groupId, groups, onMove }: { member: RosterMember; groupId: string; groups: RosterGroup[]; onMove: (memberId: string, targetGroupId: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: member.id });
  const style = { transform: CSS.Translate.toString(transform) };

  return (
    <div ref={setNodeRef} style={style} className={`min-w-0 rounded-md border border-court-line bg-court-elevated p-3 shadow-sm transition ${isDragging ? "opacity-60" : "hover:border-cyan-400/60"}`}>
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" {...listeners} {...attributes} className="hidden h-10 w-8 shrink-0 cursor-grab place-items-center rounded-md text-zinc-500 hover:bg-court-panel hover:text-white md:grid" aria-label={`Move ${member.name}`}>
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-white">{member.name}</div><div className="text-xs text-zinc-500">{member.status}</div></div>
        <ReadinessBadge value={member.readiness} status={member.status} size="sm" />
      </div>
      <label className="mt-3 grid min-w-0 gap-1 text-xs font-medium text-zinc-500 md:hidden">
        Move to
        <select value={groupId} onChange={(event) => onMove(member.id, event.target.value)} className="w-full min-w-0 rounded-md border border-court-line bg-court-panel px-3 text-sm text-white">
          {groups.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}
        </select>
      </label>
    </div>
  );
}

function TeamDropColumn({ group, groups, onMove, onEdit, onRemove }: { group: RosterGroup; groups: RosterGroup[]; onMove: (memberId: string, targetGroupId: string) => void; onEdit: (group: RosterGroup) => void; onRemove: (group: RosterGroup) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: group.id });
  const isUnassigned = group.id === "unassigned";

  return (
    <section id={`admin-team-${group.id}`} ref={setNodeRef} aria-labelledby={`admin-team-${group.id}-heading`} className={`scroll-mt-24 min-w-0 rounded-md border bg-court-panel p-4 transition ${isOver ? "border-cyan-400" : "border-court-line"}`}>
      <div className="mb-4 flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0"><h3 id={`admin-team-${group.id}-heading`} className="break-words text-sm font-semibold text-white">{group.label}</h3><div className="mt-1 text-xs text-zinc-500">{group.members.length} members</div></div>
        <div className="flex shrink-0 items-center gap-2">
          <ReadinessBadge value={group.readiness} size="sm" />
          {!isUnassigned ? (
            <>
              <button type="button" onClick={() => onEdit(group)} className="grid h-10 w-10 place-items-center rounded-md text-zinc-500 hover:bg-court-elevated hover:text-white" aria-label={`Edit ${group.label}`}><Pencil className="h-4 w-4" aria-hidden="true" /></button>
              <button type="button" onClick={() => onRemove(group)} className="grid h-10 w-10 place-items-center rounded-md text-red-300 hover:bg-red-300/10" aria-label={`Remove ${group.label}`}><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
            </>
          ) : null}
        </div>
      </div>
      <div className="space-y-2">
        {group.members.length ? group.members.map((member) => <DraggableMember key={member.id} member={member} groupId={group.id} groups={groups} onMove={onMove} />) : <div className="rounded-md border border-dashed border-court-line p-5 text-center text-sm text-zinc-500">No students assigned</div>}
      </div>
    </section>
  );
}

export function RosterManager({ rosters }: RosterManagerProps) {
  const router = useRouter();
  const [groups, setGroups] = useState(rosters);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [teamSaving, setTeamSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [rosterDirty, setRosterDirty] = useState(false);
  const [editor, setEditor] = useState<TeamEditorState | null>(null);
  const [teamToRemove, setTeamToRemove] = useState<RosterGroup | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const previousRosters = useRef(rosters);
  const teamNameRef = useRef<HTMLInputElement>(null);
  const deleteConfirmationRef = useRef<HTMLInputElement>(null);
  const realTeams = useMemo(() => groups.filter((group) => group.id !== "unassigned"), [groups]);
  const expectedDeleteName = teamToRemove?.name || teamToRemove?.label || "";

  useEffect(() => {
    if (previousRosters.current === rosters || rosterDirty || editor || teamToRemove) return;
    previousRosters.current = rosters;
    setGroups(rosters);
  }, [editor, rosterDirty, rosters, teamToRemove]);

  function findGroupByMember(memberId: string) {
    return groups.find((group) => group.members.some((member) => member.id === memberId));
  }

  function moveMember(memberId: string, targetGroupId: string) {
    const sourceGroup = findGroupByMember(memberId);
    const targetGroup = groups.find((group) => group.id === targetGroupId);
    if (!sourceGroup || !targetGroup || sourceGroup.id === targetGroup.id) return;
    const member = sourceGroup.members.find((entry) => entry.id === memberId);
    if (!member) return;

    setGroups((current) => current.map((group) => group.id === sourceGroup.id
      ? { ...group, members: group.members.filter((entry) => entry.id !== memberId) }
      : group.id === targetGroup.id
        ? { ...group, members: [...group.members, member] }
        : group));
    setRosterDirty(true);
    setMessage(`${member.name} moved to ${targetGroup.label}. Save the roster to apply this change.`);
    setError(null);
  }

  function onDragEnd(event: DragEndEvent) {
    if (event.over) moveMember(String(event.active.id), String(event.over.id));
  }

  async function saveRosters() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/rosters", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ groups: groups.map((group) => ({ teamId: group.id, memberIds: group.members.map((member) => member.id) })) })
      });
      const payload = await response.json() as { ok?: boolean; message?: string; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Could not save rosters.");
      setMessage(payload.message ?? "Team rosters saved.");
      setRosterDirty(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save rosters.");
    } finally {
      setSaving(false);
    }
  }

  function requireCleanRoster(action: string) {
    if (!rosterDirty) return true;
    setError(`Save the pending roster moves before ${action}.`);
    setMessage(null);
    return false;
  }

  function openCreateTeam() {
    if (!requireCleanRoster("adding a team")) return;
    setEditor({
      mode: "create",
      name: "",
      schoolName: realTeams[0]?.schoolName ?? "",
      designation: ""
    });
    setError(null);
  }

  function openEditTeam(group: RosterGroup) {
    if (!requireCleanRoster("editing a team")) return;
    setEditor({
      mode: "edit",
      teamId: group.id,
      name: group.name || group.label,
      schoolName: group.schoolName ?? "",
      designation: group.designation ?? ""
    });
    setError(null);
  }

  function openRemoveTeam(group: RosterGroup) {
    if (!requireCleanRoster("removing a team")) return;
    setDeleteConfirmation("");
    setTeamToRemove(group);
    setError(null);
  }

  async function saveTeam() {
    if (!editor) return;
    setTeamSaving(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/rosters", {
        method: editor.mode === "create" ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          teamId: editor.teamId,
          name: editor.name,
          schoolName: editor.schoolName,
          designation: editor.designation
        })
      });
      const payload = await response.json() as TeamMutationPayload;
      if (!response.ok || !payload.ok || !payload.team) throw new Error(payload.error ?? "Could not save the team.");
      const savedTeam = payload.team;
      if (editor.mode === "create") {
        const newGroup: RosterGroup = {
          id: savedTeam.id,
          name: savedTeam.name,
          schoolName: savedTeam.schoolName,
          label: savedTeam.name,
          designation: savedTeam.designation,
          version: savedTeam.version,
          readiness: 0,
          members: []
        };
        setGroups((current) => {
          const unassignedIndex = current.findIndex((group) => group.id === "unassigned");
          if (unassignedIndex < 0) return [...current, newGroup];
          return [...current.slice(0, unassignedIndex), newGroup, ...current.slice(unassignedIndex)];
        });
      } else {
        setGroups((current) => current.map((group) => group.id === savedTeam.id ? {
          ...group,
          name: savedTeam.name,
          schoolName: savedTeam.schoolName,
          label: savedTeam.name,
          designation: savedTeam.designation,
          version: savedTeam.version
        } : group));
      }
      setEditor(null);
      setMessage(payload.message ?? (editor.mode === "create" ? "Team added." : "Team updated."));
      if (payload.persisted !== false) router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the team.");
    } finally {
      setTeamSaving(false);
    }
  }

  async function removeTeam() {
    if (!teamToRemove) return;
    setRemoving(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/rosters", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ teamId: teamToRemove.id, name: expectedDeleteName, confirmation: deleteConfirmation })
      });
      const payload = await response.json() as TeamMutationPayload;
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Could not remove the team.");
      const removedId = teamToRemove.id;
      const removedMembers = teamToRemove.members;
      setGroups((current) => current.filter((group) => group.id !== removedId).map((group) => group.id === "unassigned" ? { ...group, members: [...group.members, ...removedMembers] } : group));
      setTeamToRemove(null);
      setDeleteConfirmation("");
      setMessage(payload.message ?? "Team removed.");
      if (payload.persisted !== false) router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not remove the team.");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-md border border-court-line bg-court-panel p-4 sm:p-5 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0"><h2 id="teams-rosters-heading" className="text-xl font-semibold text-white">Teams and rosters</h2><p className="mt-1 text-sm leading-6 text-zinc-500">Add, rename, edit, or remove any team. Use Move to on mobile or drag on larger screens, then save roster changes. Team changes can be restored from the audit log.</p></div>
        <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
          <button type="button" onClick={openCreateTeam} disabled={saving || teamSaving || removing} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-court-line px-4 text-sm font-semibold text-white hover:bg-court-elevated md:w-auto">
            <Plus className="h-4 w-4" aria-hidden="true" /> Add team
          </button>
          <button type="button" onClick={() => void saveRosters()} disabled={saving || !rosterDirty} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-black hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />} {saving ? "Saving roster…" : rosterDirty ? "Save roster" : "Roster saved"}
          </button>
        </div>
      </div>
      {message ? <div className="rounded-md border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-300" role="status">{message}</div> : null}
      {error ? <div className="rounded-md border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300" role="alert">{error}</div> : null}

      <DndContext onDragEnd={onDragEnd}>
        <div className="grid min-w-0 gap-4 xl:grid-cols-3">
          {groups.map((group) => <TeamDropColumn key={group.id} group={group} groups={groups} onMove={moveMember} onEdit={openEditTeam} onRemove={openRemoveTeam} />)}
        </div>
      </DndContext>

      {editor ? (
        <AdminDialog
          labelledBy="team-editor-heading"
          describedBy="team-editor-description"
          initialFocusRef={teamNameRef}
          closeDisabled={teamSaving}
          busy={teamSaving}
          onClose={() => setEditor(null)}
          panelClassName="max-w-lg p-5"
        >
          <form onSubmit={(event) => { event.preventDefault(); void saveTeam(); }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 id="team-editor-heading" className="text-xl font-semibold text-white">{editor.mode === "create" ? "Add team" : "Edit team"}</h2>
                <p id="team-editor-description" className="mt-1 text-sm leading-6 text-zinc-500">The display name appears across roster and team views. School and designation are used to match tournament imports.</p>
              </div>
              <button type="button" onClick={() => setEditor(null)} disabled={teamSaving} className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-zinc-500 hover:bg-court-elevated hover:text-white" aria-label="Close team editor"><X className="h-4 w-4" aria-hidden="true" /></button>
            </div>
            <div className="mt-5 grid min-w-0 gap-4">
              <label className="grid min-w-0 gap-1.5 text-sm font-medium text-white">
                Team name
                <input ref={teamNameRef} required minLength={2} maxLength={80} disabled={teamSaving} value={editor.name} onChange={(event) => setEditor((current) => current ? { ...current, name: event.target.value } : current)} placeholder="Tompkins A" className="min-h-11 w-full min-w-0 rounded-md border border-court-line bg-court-elevated px-3 text-white" />
              </label>
              <label className="grid min-w-0 gap-1.5 text-sm font-medium text-white">
                School
                <input required minLength={2} maxLength={120} disabled={teamSaving} value={editor.schoolName} onChange={(event) => setEditor((current) => current ? { ...current, schoolName: event.target.value } : current)} placeholder="Obra D Tompkins High School" className="min-h-11 w-full min-w-0 rounded-md border border-court-line bg-court-elevated px-3 text-white" />
              </label>
              <label className="grid min-w-0 gap-1.5 text-sm font-medium text-white">
                Designation
                <input required minLength={1} maxLength={20} disabled={teamSaving} value={editor.designation} onChange={(event) => setEditor((current) => current ? { ...current, designation: event.target.value.toUpperCase() } : current)} placeholder="A" className="min-h-11 w-full min-w-0 rounded-md border border-court-line bg-court-elevated px-3 text-white" />
              </label>
            </div>
            {error ? <div className="mt-4 rounded-md border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300" role="alert">{error}</div> : null}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setEditor(null)} disabled={teamSaving} className="min-h-11 rounded-md border border-court-line px-4 text-sm font-medium text-zinc-600">Cancel</button>
              <button type="submit" disabled={teamSaving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-black hover:bg-cyan-200 disabled:opacity-60">
                {teamSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : editor.mode === "create" ? <Plus className="h-4 w-4" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
                {teamSaving ? "Saving…" : editor.mode === "create" ? "Add team" : "Save team"}
              </button>
            </div>
          </form>
        </AdminDialog>
      ) : null}

      {teamToRemove ? (
        <AdminDialog
          labelledBy="remove-team-heading"
          describedBy="remove-team-description"
          initialFocusRef={deleteConfirmationRef}
          closeDisabled={removing}
          busy={removing}
          onClose={() => { setTeamToRemove(null); setDeleteConfirmation(""); }}
          panelClassName="max-w-md p-5"
        >
          <form onSubmit={(event) => { event.preventDefault(); void removeTeam(); }}>
            <h2 id="remove-team-heading" className="break-words text-xl font-semibold text-white">Remove {expectedDeleteName}?</h2>
            <p id="remove-team-description" className="mt-2 text-sm leading-6 text-zinc-500">Its {teamToRemove.members.length} members will become unassigned. Tournament history remains intact, and an admin can restore the team and its roster from the audit log.</p>
            <label className="mt-4 grid min-w-0 gap-1.5 text-sm font-medium text-white">
              Type <span className="break-all font-semibold text-red-300">{expectedDeleteName}</span> to confirm
              <input ref={deleteConfirmationRef} required autoComplete="off" disabled={removing} value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} className="min-h-11 w-full min-w-0 rounded-md border border-court-line bg-court-elevated px-3 text-white" />
            </label>
            {error ? <div className="mt-4 rounded-md border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300" role="alert">{error}</div> : null}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => { setTeamToRemove(null); setDeleteConfirmation(""); }} disabled={removing} className="min-h-11 rounded-md border border-court-line px-4 text-sm font-medium text-zinc-600">Cancel</button>
              <button type="submit" disabled={removing || deleteConfirmation.trim().toLocaleLowerCase() !== expectedDeleteName.toLocaleLowerCase()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-red-400 px-4 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50">{removing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />} {removing ? "Removing…" : "Remove team"}</button>
            </div>
          </form>
        </AdminDialog>
      ) : null}
    </div>
  );
}

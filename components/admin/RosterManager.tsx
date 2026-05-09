"use client";

import { DndContext, type DragEndEvent, useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Save } from "lucide-react";
import { useState } from "react";
import { OvrBadge } from "@/components/OvrBadge";

interface RosterMember {
  id: string;
  name: string;
  ovr: number;
  tier: string;
}

interface RosterGroup {
  id: string;
  label: string;
  ovr: number;
  members: RosterMember[];
}

interface RosterManagerProps {
  rosters: RosterGroup[];
}

function DraggableMember({ member }: { member: RosterMember }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: member.id });
  const style = {
    transform: CSS.Translate.toString(transform)
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`flex cursor-grab items-center gap-3 rounded-md border border-court-line bg-court-elevated p-3 shadow-sm transition ${
        isDragging ? "opacity-60" : "hover:border-cyan-400/60"
      }`}
    >
      <GripVertical className="h-4 w-4 text-zinc-500" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-black text-white">{member.name}</div>
        <div className="text-[11px] font-black uppercase text-zinc-500">{member.tier}</div>
      </div>
      <OvrBadge value={member.ovr} size="sm" />
    </div>
  );
}

function TeamDropColumn({ group }: { group: RosterGroup }) {
  const { setNodeRef, isOver } = useDroppable({ id: group.id });

  return (
    <section
      ref={setNodeRef}
      className={`min-h-80 rounded-md border bg-court-panel p-4 transition ${
        isOver ? "border-cyan-400" : "border-court-line"
      }`}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase text-zinc-500">{group.label}</div>
          <div className="text-sm font-bold text-zinc-300">{group.members.length} members</div>
        </div>
        <OvrBadge value={group.ovr} size="sm" />
      </div>
      <div className="space-y-2">
        {group.members.map((member) => (
          <DraggableMember key={member.id} member={member} />
        ))}
      </div>
    </section>
  );
}

export function RosterManager({ rosters }: RosterManagerProps) {
  const [groups, setGroups] = useState(rosters);
  const [message, setMessage] = useState<string | null>(null);

  function findGroupByMember(memberId: string) {
    return groups.find((group) => group.members.some((member) => member.id === memberId));
  }

  function onDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const targetGroupId = event.over ? String(event.over.id) : null;
    if (!targetGroupId) return;

    const sourceGroup = findGroupByMember(activeId);
    const targetGroup = groups.find((group) => group.id === targetGroupId);
    if (!sourceGroup || !targetGroup || sourceGroup.id === targetGroup.id) return;

    const member = sourceGroup.members.find((entry) => entry.id === activeId);
    if (!member) return;

    setGroups((current) =>
      current.map((group) => {
        if (group.id === sourceGroup.id) {
          return { ...group, members: group.members.filter((entry) => entry.id !== activeId) };
        }
        if (group.id === targetGroup.id) {
          return { ...group, members: [...group.members, member] };
        }
        return group;
      })
    );
    setMessage(`${member.name} moved to ${targetGroup.label}.`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-md border border-court-line bg-court-panel p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-black italic uppercase text-white">Roster Editor</h2>
          <p className="mt-1 text-sm text-zinc-400">Drag students between teams. Changes are audit-ready in production.</p>
        </div>
        <button
          type="button"
          onClick={() => setMessage("Roster changes staged locally. Wire Supabase credentials to persist them.")}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-black uppercase text-black transition hover:bg-cyan-200"
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          Save Roster
        </button>
      </div>

      {message ? <div className="rounded-md border border-court-line bg-court-elevated p-3 text-sm text-zinc-300">{message}</div> : null}

      <DndContext onDragEnd={onDragEnd}>
        <div className="grid gap-4 xl:grid-cols-3">
          {groups.map((group) => (
            <TeamDropColumn key={group.id} group={group} />
          ))}
        </div>
      </DndContext>
    </div>
  );
}

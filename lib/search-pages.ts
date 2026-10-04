import type { SearchCandidate } from "@/lib/search-types";
import type { UserRole } from "@/lib/types";

const roleRank: Record<UserRole, number> = { viewer: 0, officer: 1, admin: 2 };

const pageCandidates: SearchCandidate[] = [
  {
    id: "page:dashboard",
    kind: "page",
    group: "Pages",
    title: "Dashboard",
    subtitle: "Team readiness, roster, recent preparation, and activity",
    href: "/dashboard",
    keywords: ["home", "overview", "readiness", "leaderboard", "roster", "students", "30 day points"],
    minimumRole: "viewer",
    quickRank: 3
  },
  {
    id: "page:points",
    kind: "page",
    group: "Quick actions",
    title: "Log practice",
    subtitle: "Submit points or review and withdraw your entries",
    href: "/points",
    keywords: ["points", "study", "practice log", "submit", "minutes", "build testing", "history", "withdraw"],
    minimumRole: "viewer",
    quickRank: 1
  },
  {
    id: "page:teams",
    kind: "page",
    group: "Pages",
    title: "Teams and rosters",
    subtitle: "Compare active team assignments",
    href: "/teams",
    keywords: ["teams", "rosters", "members", "compare", "team readiness", "assignments"],
    minimumRole: "viewer",
    quickRank: 5
  },
  {
    id: "page:testoffs",
    kind: "page",
    group: "Pages",
    title: "Testoff rankings",
    subtitle: "Weighted scores, sessions, seasons, and event rankings",
    href: "/testoffs",
    keywords: ["testoff", "tryout", "scores", "rankings", "weighted", "composite", "season", "session"],
    minimumRole: "viewer",
    quickRank: 6
  },
  {
    id: "page:resources",
    kind: "page",
    group: "Pages",
    title: "Event resources",
    subtitle: "Vetted 2027 links, topics, starter paths, and team materials",
    href: "/resources",
    keywords: ["resources", "events", "2027", "notes", "guides", "starter", "study", "official sources"],
    minimumRole: "viewer",
    quickRank: 4
  },
  {
    id: "page:practice",
    kind: "page",
    group: "Pages",
    title: "Practice library",
    subtitle: "Original printable sets and interactive tests across the official 2027 slate",
    href: "/practice",
    keywords: ["practice", "questions", "answers", "tests", "quiz", "mcq", "frq", "interactive", "2027", "rookie", "pro", "all star"],
    minimumRole: "viewer",
    quickRank: 7
  },
  {
    id: "page:flashcards",
    kind: "page",
    group: "Pages",
    title: "Team flashcards",
    subtitle: "Create, import, share, study, and vote on team decks",
    href: "/flashcards",
    keywords: ["flashcards", "cards", "csv", "import", "share", "study deck", "upvote", "downvote"],
    minimumRole: "viewer",
    quickRank: 8
  },
  {
    id: "admin:approve",
    kind: "page",
    group: "Administration",
    title: "Approval queue",
    subtitle: "Approve or reject submitted practice points",
    href: "/admin/approve",
    keywords: ["approve", "reject", "pending", "review points", "officer"],
    minimumRole: "officer",
    quickRank: 8
  },
  {
    id: "admin:testoffs",
    kind: "page",
    group: "Administration",
    title: "Enter testoff scores",
    subtitle: "Create sessions and publish ranked scores",
    href: "/admin/testoffs",
    keywords: ["enter scores", "testoff", "session", "raw score", "max score", "weight", "officer"],
    minimumRole: "officer",
    quickRank: 9
  },
  {
    id: "admin:upload",
    kind: "page",
    group: "Administration",
    title: "Import tournament results",
    subtitle: "Upload Duosmium CSV results and match participants",
    href: "/admin/upload",
    keywords: ["import", "upload", "csv", "duosmium", "tournament", "results", "placements", "medals"],
    minimumRole: "officer",
    quickRank: 10
  },
  {
    id: "admin:library",
    kind: "page",
    group: "Administration",
    title: "Manage event library",
    subtitle: "Add resources, guide text, practice questions, and tests",
    href: "/admin/library",
    keywords: ["resources", "library", "add guide", "practice question", "practice test", "event materials", "officer"],
    minimumRole: "officer",
    quickRank: 11
  },
  {
    id: "admin:reports",
    kind: "page",
    group: "Administration",
    title: "Generate reports",
    subtitle: "Filter team data, preview a report, print it, or download CSV",
    href: "/admin/reports",
    keywords: ["report", "export", "print", "csv", "analytics", "team report", "student report"],
    minimumRole: "admin",
    quickRank: 11
  },
  {
    id: "admin:manage",
    kind: "page",
    group: "Administration",
    title: "Manage team",
    subtitle: "Rosters, points, people, roles, and event assignments",
    href: "/admin/manage",
    keywords: ["admin", "manage", "roster", "accounts", "people", "add person", "remove person", "roles", "categories", "assign students"],
    minimumRole: "admin",
    quickRank: 11
  },
  {
    id: "admin:manage-rosters",
    kind: "page",
    group: "Administration",
    title: "Edit team rosters",
    subtitle: "Create, rename, remove, and assign students to any team",
    href: "/admin/manage?tab=roster",
    keywords: ["roster", "move students", "assign", "create team", "rename team", "remove team", "unassigned"],
    minimumRole: "admin"
  },
  {
    id: "admin:manage-points",
    kind: "page",
    group: "Administration",
    title: "Manage all points",
    subtitle: "Add, edit, or remove any point record",
    href: "/admin/manage?tab=points",
    keywords: ["admin points", "manual points", "add points", "edit points", "remove points", "point records", "adjustment"],
    minimumRole: "admin"
  },
  {
    id: "admin:manage-categories",
    kind: "page",
    group: "Administration",
    title: "Manage point categories",
    subtitle: "Create custom activities and point limits",
    href: "/admin/manage?tab=categories",
    keywords: ["point categories", "custom activity", "default points", "maximum points"],
    minimumRole: "admin"
  },
  {
    id: "admin:manage-accounts",
    kind: "page",
    group: "Administration",
    title: "Add or remove people",
    subtitle: "Add profiles, edit details, archive people, or restore them later",
    href: "/admin/manage?tab=accounts",
    keywords: ["people", "add person", "add student", "remove person", "remove student", "archive", "restore", "accounts", "profiles", "student roles", "viewer", "officer", "admin", "grade", "event assignments"],
    minimumRole: "admin"
  },
  {
    id: "admin:audit",
    kind: "page",
    group: "Administration",
    title: "Audit log",
    subtitle: "Review changes and restore reversible actions",
    href: "/admin/audit",
    keywords: ["audit", "activity log", "undo", "reverse", "restore", "admin changes"],
    minimumRole: "admin",
    quickRank: 12
  }
];

export function pageSearchCandidatesForUser(role: UserRole, userId: string): SearchCandidate[] {
  const personalized: SearchCandidate[] = [
    {
      id: "action:profile",
      kind: "student",
      group: "Quick actions",
      title: "My profile",
      subtitle: "Readiness, events, competition, and point history",
      href: `/profile/${userId}`,
      keywords: ["me", "my account", "profile"],
      quickRank: 2
    },
    {
      id: "action:tour",
      kind: "action",
      group: "Quick actions",
      title: "Take a tour",
      subtitle: "Show the website walkthrough",
      action: "tour",
      keywords: ["help", "onboarding", "walkthrough", "how to use"],
      quickRank: 13
    }
  ];

  return [
    ...personalized,
    ...pageCandidates.filter((candidate) => roleRank[role] >= roleRank[candidate.minimumRole ?? "viewer"])
  ];
}

import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy" };

const sections = [
  {
    title: "Information we collect",
    items: [
      "Account information, including your name, email address, grade, role, and profile details.",
      "Team activity, including event assignments, tournament results, testoff scores, practice activity, and point submissions.",
      "Evidence you choose to attach to a point submission, including uploaded media, PDFs, and Google Drive or Google Docs links.",
      "Flashcard content you publish, your display name as the deck author, and your upvote or downvote on a deck.",
      "Basic security and audit information, such as sign-in records, action history, and the IP address associated with audited administrative actions."
    ]
  },
  {
    title: "How we use information",
    paragraphs: [
      "We use this information to operate the team workspace, authenticate accounts, calculate team analytics, review practice submissions, publish team study material, aggregate deck votes, maintain accurate records, and protect the integrity of the service."
    ]
  },
  {
    title: "Who can see information",
    paragraphs: [
      "Signed-in team members may see team rosters, profiles, rankings, results, published flashcard decks, and each deck author's display name as part of the shared workspace. Point-submission evidence is limited to the member who submitted it and authorized officers or administrators. Flashcard votes are shown to members only as totals; administrators with database access may inspect individual vote records to investigate abuse. We also use service providers for authentication, database storage, file storage, and website hosting. A Google Drive or Google Docs link remains subject to the sharing settings you choose in Google."
    ]
  },
  {
    title: "Retention and deletion",
    paragraphs: [
      "We keep account and team records while they are needed for team operations, historical results, security, or audit recovery. Evidence is retained with its point submission and may remain during an administrative recovery period after a submission is removed. Flashcard authors and authorized officers can remove a published deck, which also removes its cards and votes. Ask a team administrator to correct or delete information associated with your account."
    ]
  },
  {
    title: "Your choices and responsibilities",
    paragraphs: [
      "Only upload evidence needed to verify team activity. Do not include private health, financial, government identification, or other sensitive personal information. Do not place personal data in flashcard decks. When sharing a Google link, use the narrowest sharing setting that still lets the reviewing officers open it. CSV flashcard imports are parsed in your browser; the original CSV file is not stored, but the card text you publish is stored."
    ]
  },
  {
    title: "Security and student use",
    paragraphs: [
      "We use access controls, private file storage, file-type and size limits, and server-side validation designed to limit evidence to authorized users. These controls reduce risk but do not prove that every file is harmless. This service is intended for authorized Science Olympiad team members and their supervising adults. Students or guardians with questions should contact a team administrator or sponsor."
    ]
  },
  {
    title: "Policy changes and contact",
    paragraphs: [
      "We may update this policy as the service changes. The effective date above identifies the current version. Contact a team administrator or sponsor with privacy questions or requests."
    ]
  }
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="This policy explains how SciOly Tracker handles information for the Obra D. Tompkins Science Olympiad team workspace."
      sections={sections}
    />
  );
}

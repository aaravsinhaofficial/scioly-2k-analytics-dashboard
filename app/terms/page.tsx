import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Terms of Service" };

const sections = [
  {
    title: "Eligibility and accounts",
    paragraphs: [
      "SciOly Tracker is a team workspace for authorized Science Olympiad members, officers, administrators, and supervising adults. Use your own account, provide accurate information, protect your password, and notify a team administrator if you believe your account has been accessed without permission."
    ]
  },
  {
    title: "Acceptable use",
    items: [
      "Submit accurate practice, testoff, and competition information.",
      "Upload only evidence that you created, are allowed to share, or have permission to use.",
      "Publish only flashcards you created or are authorized to share. Do not copy official rulebooks, paid resources, tournament test banks, answer keys, or other copyrighted material into a deck without permission.",
      "Do not upload harmful code, unlawful or inappropriate content, confidential third-party information, or unnecessary sensitive personal information.",
      "Do not attempt to bypass access controls, impersonate another person, disrupt the service, or manipulate rankings, points, or flashcard votes."
    ]
  },
  {
    title: "Point submissions and evidence",
    paragraphs: [
      "Practice points remain pending until an authorized officer or administrator reviews them. Reviewers may approve, reject, edit, or remove records to keep team data accurate. You are responsible for ensuring that uploaded files and linked Google content remain available to the reviewers and use appropriate sharing permissions."
    ]
  },
  {
    title: "Shared flashcards",
    paragraphs: [
      "When you publish a deck, you allow authorized team members to view and study it inside the team workspace. You keep ownership of your original content and give the team a limited permission to store, display, and copy it only as needed to operate the workspace. Deck authors and authorized officers may remove inaccurate, unsafe, infringing, private, or disruptive content. Votes are limited to one current choice per member for each deck.",
      "Automated file or legal screening cannot determine whether you own content or whether every use is lawful. You remain responsible for the material you publish and for following school policies, tournament rules, and applicable intellectual-property and privacy requirements."
    ]
  },
  {
    title: "Team administration",
    paragraphs: [
      "Team administrators may manage accounts, roles, rosters, submissions, and access to protect the workspace and enforce these terms. Access may be suspended or removed when a person leaves the team, misuses the service, or creates a security or integrity risk."
    ]
  },
  {
    title: "Service availability and changes",
    paragraphs: [
      "The service may change, pause, or become unavailable for maintenance, security, or team needs. Features and calculations may be updated as Science Olympiad seasons and team processes change."
    ]
  },
  {
    title: "Disclaimer and responsibility",
    paragraphs: [
      "SciOly Tracker is provided for internal team coordination and analytics. It does not replace official tournament records, school rules, or Science Olympiad rules. Use the service responsibly and verify important decisions against official sources."
    ]
  },
  {
    title: "Changes and contact",
    paragraphs: [
      "We may update these terms as the service changes. Continuing to use the service after an update means the current terms apply. Contact a team administrator or sponsor with questions."
    ]
  }
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro="These terms govern use of the SciOly Tracker team workspace. By creating an account or continuing to use the service, you agree to follow them."
      sections={sections}
    />
  );
}

/**
 * Marketing copy for the public site.
 *
 * Kept in one place so the wording can be edited without touching layout code.
 * The testimonials and customer names below are placeholders — replace them
 * with real, attributable quotes before launch.
 */

export const NAV_LINKS = [
  { label: "Product", href: "#features" },
  { label: "Solutions", href: "#solutions" },
  { label: "Why Mentework", href: "#why" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
] as const;

export const SOLUTIONS = [
  {
    title: "Marketing",
    description: "Run campaigns end to end, from brief and review to launch day.",
  },
  {
    title: "Engineering",
    description: "Plan sprints, track bugs and ship releases without leaving the workspace.",
  },
  {
    title: "Creative",
    description: "Collect feedback directly on designs instead of in scattered email threads.",
  },
  {
    title: "Operations",
    description: "Standardise recurring processes with templates and repeatable workflows.",
  },
  {
    title: "Product",
    description: "Turn a roadmap into scheduled, owned and measurable work.",
  },
  {
    title: "Agencies",
    description: "Give every client their own space, with the right people in each one.",
  },
  {
    title: "Education",
    description: "Coordinate programmes, cohorts and staff from a shared calendar.",
  },
  {
    title: "Company-wide",
    description: "One workspace every department can actually agree on.",
  },
] as const;

export const FEATURES = [
  {
    id: "boards",
    name: "Boards",
    headline: "See the whole pipeline at a glance",
    description:
      "Drag work through stages you define. Every card carries its owner, due date and discussion, so status meetings get shorter.",
    bullets: ["Custom stages per project", "Assignees and due dates on every card", "Filters saved per person"],
  },
  {
    id: "tasks",
    name: "Tasks",
    headline: "Work that never loses its owner",
    description:
      "Subtasks, dependencies and recurring items, with a clear answer to who is doing what by when.",
    bullets: ["Subtasks and dependencies", "Recurring tasks", "Bulk edits across a list"],
  },
  {
    id: "timeline",
    name: "Timeline",
    headline: "Plan dates that survive contact with reality",
    description:
      "A Gantt-style timeline that shows overlap and slippage early, while there is still time to move something.",
    bullets: ["Drag to reschedule", "Dependency lines", "Milestones and baselines"],
  },
  {
    id: "proofing",
    name: "Proofing",
    headline: "Feedback on the file, not around it",
    description:
      "Annotate designs and documents in place, resolve comments, and keep every revision side by side.",
    bullets: ["Pin comments to a region", "Version history", "Approve or request changes"],
  },
  {
    id: "time",
    name: "Time tracking",
    headline: "Know where the hours actually went",
    description:
      "Timers and manual entries roll up into timesheets you can bill from or learn from.",
    bullets: ["Start/stop timers", "Editable timesheets", "Export for invoicing"],
  },
  {
    id: "reports",
    name: "Reports",
    headline: "Answers without a spreadsheet export",
    description:
      "Workload, progress and time reports across every project, refreshed as work moves.",
    bullets: ["Workload by person", "Project burn-down", "Scheduled email digests"],
  },
] as const;

export const BENEFITS = [
  {
    title: "One workspace, not seven tabs",
    description:
      "Tasks, files, chat and schedules live together, so context does not get lost between tools.",
  },
  {
    title: "Control over who sees what",
    description:
      "Custom roles decide what each person can open, edit and approve — down to the project.",
  },
  {
    title: "Flat, predictable pricing",
    description: "One price for the whole organisation. No per-seat maths every time you hire.",
  },
  {
    title: "Built for many organisations",
    description:
      "Every tenant gets its own subdomain and its own data, isolated from every other one.",
  },
] as const;

export const TESTIMONIALS = [
  {
    quote:
      "We replaced three tools with Mentework in a fortnight. The part that stuck was proofing — feedback stopped living in inboxes.",
    name: "Priya Raman",
    role: "Head of Delivery",
    company: "Northwind Studio",
  },
  {
    quote:
      "Custom roles were the reason we moved. Clients see exactly one project and nothing else, which we could not do before.",
    name: "Daniel Okafor",
    role: "Operations Lead",
    company: "Fieldpost Agency",
  },
  {
    quote:
      "The timeline view caught a two-week overlap before it happened. That alone paid for the year.",
    name: "Mei Lin Tan",
    role: "Programme Manager",
    company: "Halden Group",
  },
] as const;

export const FAQS = [
  {
    question: "What is Mentework?",
    answer:
      "Mentework is a project management workspace that keeps planning, tasks, files, proofing and discussions in one place, so teams spend less time reconciling tools.",
  },
  {
    question: "Does each organisation get its own space?",
    answer:
      "Yes. Every organisation runs on its own subdomain with its own data and its own members. Nothing is shared between tenants.",
  },
  {
    question: "How does access control work?",
    answer:
      "Members are assigned roles that determine what they can view, edit and approve. Roles can be scoped to the whole organisation or to individual projects.",
  },
  {
    question: "Can we invite clients or contractors?",
    answer:
      "Yes. Guests can be added to specific projects only, so they see the work they are involved in and nothing else.",
  },
  {
    question: "Can we import from our current tool?",
    answer:
      "Projects, tasks and members can be imported from CSV, and we help with larger migrations during onboarding.",
  },
] as const;

export const FOOTER_COLUMNS = [
  {
    title: "Product",
    links: ["Boards", "Tasks", "Timeline", "Proofing", "Time tracking", "Reports"],
  },
  {
    title: "Solutions",
    links: ["Marketing", "Engineering", "Creative", "Operations", "Agencies", "Education"],
  },
  {
    title: "Resources",
    links: ["Documentation", "Guides", "Changelog", "Status", "Support"],
  },
  {
    title: "Company",
    links: ["About", "Careers", "Contact", "Privacy", "Terms"],
  },
] as const;

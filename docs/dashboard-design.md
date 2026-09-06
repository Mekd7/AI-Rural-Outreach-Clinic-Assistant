# AI Clinic Assistant — Dashboard & Visual Design Brief

## 1. Objective

Create a new mobile dashboard/home screen for the AI Clinic Assistant.

The dashboard should communicate the story:

Remote community
→ outreach clinicians arrive
→ patients receive care
→ patient records are created
→ patients are handed over to nearby healthcare facilities
→ continuity of care.

The dashboard should feel like a story, not a generic medical SaaS dashboard.

Core emotional message:

> They may be far from healthcare, but they are not forgotten.

---

## 2. CRITICAL: Preserve Existing Functionality

This is a visual/design task.

DO NOT change existing application functionality.

Do not modify:
- clinical workflows
- business logic
- APIs
- database operations
- authentication
- state management
- offline storage
- synchronization logic
- navigation behavior
- existing functional page behavior

Existing functionality should be treated as PROTECTED.

Only make changes necessary to:
1. add the new dashboard/home screen
2. introduce the new visual design system/theme into existing pages
3. improve visual consistency without changing how those pages work

---

## 3. Dashboard Story

The dashboard should visually represent a rural/outskirt Ethiopian community.

### Background

A distant healthcare facility should be visible on a mountain/hill.

This distance is intentional.

It represents the physical gap between the community and formal healthcare.

### Middle ground

Show an outreach healthcare session:
- clinicians arriving
- vehicle
- treatment table
- medical supplies
- simple shade/canopy
- patients receiving/awaiting care

### Foreground

Show people naturally scattered throughout the community:
- mothers with infants
- elderly people
- children
- families
- people waiting
- people looking toward the clinicians

Avoid portraying the community as helpless or stereotypical.

The people should feel like a real community.

---

## 4. Visual Identity

Use the provided visual references as inspiration.

Primary visual language:
- warm cream / parchment
- earthy brown
- deep burgundy / red
- muted gold
- natural greens / teal
- dark linework

Use subtle Ethiopian-inspired:
- textile/geometric patterns
- architectural details
- clothing details
- environmental elements

Avoid generic "African" visual stereotypes.

The design should feel specifically inspired by Ethiopia while remaining modern and professional.

---

## 5. UI Direction

The illustration is the STORY layer.

The clinical UI remains clean and functional.

Do not turn the entire application into a cartoon.

Use:
- clean cards
- readable typography
- clear hierarchy
- restrained decorative elements
- subtle cultural patterns
- warm backgrounds
- professional medical UI components

The visual identity should extend naturally into the existing functional pages.

---

## 6. Animation

Animations should be subtle and purposeful.

Possible examples:
- gentle tree/leaf movement
- drifting clouds
- subtle fabric movement
- sunlight/shadow changes
- small movements from people
- subtle clinician/vehicle arrival

Animations must:
- remain performant on mobile
- not interfere with usability
- not distract from clinical tasks
- respect reduced-motion preferences

---

## 7. Offline-First Identity

The application is offline-first.

The design can reinforce this concept visually.

For example:
- subtle offline indicator
- records waiting to sync
- synchronization status
- visual distinction between local and synced information

DO NOT change the existing synchronization functionality.

Only improve its visual presentation.

---

## 8. Existing Application

Before implementation, inspect the existing application thoroughly.

Identify:
- architecture
- routing/navigation
- existing pages
- reusable components
- styling system
- design tokens
- state management
- API layer
- offline storage
- synchronization
- current dashboard/home behavior, if any

Do not assume how the application works.

---

## 9. Implementation Rules

Before writing code:

1. Inspect the repository.
2. Understand the existing architecture.
3. Identify reusable components.
4. Identify the safest place to add the dashboard.
5. Determine how the visual theme can be introduced without breaking functionality.
6. Produce an implementation plan.

DO NOT immediately modify code.

First report:
- what you found
- what files you intend to modify
- what files should remain untouched
- how you will preserve functionality
- how the dashboard will be integrated
- how the visual theme will propagate to existing pages

Wait for approval before making major implementation changes.

---

## 10. Design Principle

The dashboard should answer this question visually:

"How does this application connect a remote community to continuous healthcare?"

The answer should be understandable even before the user reads all the text.

The interface should feel:

Human
Local
Warm
Trustworthy
Professional
Modern
Ethiopian
Healthcare-focused

—not like a generic hospital administration dashboard.
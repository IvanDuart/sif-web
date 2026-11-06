---
id: product
type: goal-and-requirements
title: sif-web — product goal and requirements
status: draft
---

# Product

## Register

product

## Users
Nutritionists and clinic staff of nutrition clinics are the primary audience: the web app is a staff-first tool used during and around consultations. Patients are a secondary audience on the web — they get a read-mostly view of their own diet, shopping list and evolution; their main client is the separate Flutter mobile app (e.g. patient-side chat lives only there).

## Product Purpose
sif-web is a multi-tenant SaaS web application for running nutrition clinics. A tenant is a clinic or independent professional; a user can belong to several tenants, with one role and a set of permissions in each.

## Capabilities
- Patient records: profile, clinical status, anamnesis, events, body measurements and body-composition evolution.
- Diet menus: build and assign menus and meals, reusable menu templates (including uploaded templates), and shopping lists derived from menus.
- Agenda: appointments, appointment types and pricing, centre schedules and holidays, calendar notes, appointment proposals from patients.
- Clinic operations: staff management, revenue metrics, 1:1 chat between nutritionist and patient.
- Assistant ("mascota"): a conversational assistant for staff that proposes actions and fills forms on screen; the user always confirms and saves (see `assistant-module`).
- Clinic branding: per-tenant logo, primary colour and language; platform admins create tenants.
- In-app help.

## Non-goals
- The assistant does not diagnose, prescribe, or interpret lab results.

## Brand Personality
Professional, clinical, clean, trustworthy, and efficient.

## Anti-references
Cluttered SaaS dashboards with over-saturated gradients, generic stock icons, tiny unreadable font hierarchies, or mismatched UI styles (like mixed HTML native elements and unstyled widgets).

## Design Principles
1. Unified Components: Every table, button, badge, and modal must use a standard Taiga UI v5 implementation.
2. Clinical Clarity: Clean layout, strict typographic hierarchy, and sufficient contrast (following WCAG AA/AAA accessibility).
3. Focus on Data: Clear charts, well-spaced tabular data, and simple forms that minimize cognitive load during patient consultations.

The visual language itself (palette, typography, tokens) is owned by `design-guide`.

## Accessibility & Inclusion
Strict contrast levels (text ≥ 4.5:1), responsive layout across desktop and tablet sizes (for use on clinical tablets), support for reduced motion.

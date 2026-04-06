# HabitFlow — Product Requirements Document

## Original Problem Statement
User built a vanilla JS habit tracker app (HabitFlow, GitHub: https://github.com/Christinphilip33/Habit-tracker) deployed on Vercel. They requested a comprehensive analysis covering code quality, architecture, UI/UX, performance, and security. Then requested Phase 1: Fix all identified bugs + migrate to full-stack with user accounts & cloud data sync.

## Architecture (v2.0 - Full-Stack)
- **Backend**: FastAPI (Python) on port 8001
- **Frontend**: React (CRA) on port 3000
- **Database**: MongoDB (local, `habitflow` database)
- **Auth**: JWT tokens with httpOnly cookies (access + refresh tokens)
- **Design**: Organic & Earthy theme (Outfit + Manrope fonts, terracotta + sage green palette)

## User Personas
1. **Habit Beginner**: Wants simple daily tracking with encouragement
2. **Power User**: Uses all habit types, analytics, multiple categories
3. **Mobile User**: Primarily accesses via phone PWA

## Core Requirements (Static)
- User registration & login with JWT auth
- Track habits (toggle, numeric, timer types)
- Multiple frequency options (daily, specific days, interval, monthly)
- XP/gamification system with leveling
- Plant growth widget for visual progress
- Task management alongside habits
- Analytics with consistency heatmap and weekly charts
- Pomodoro/focus timer
- Data backup/restore via JSON export/import
- Cross-device data sync via cloud backend

## What's Been Implemented (Phase 1 - April 2026)
### Backend
- ✅ FastAPI server with full REST API (20+ endpoints)
- ✅ JWT auth with register, login, logout, refresh, me
- ✅ Brute force protection on login
- ✅ Habit CRUD with toggle/numeric/timer completion
- ✅ Task CRUD with completion toggle
- ✅ Categories (6 defaults seeded per user)
- ✅ XP system with weekly cap (4000 XP)
- ✅ Settings management
- ✅ Data export/import endpoints
- ✅ Analytics endpoint

### Frontend
- ✅ Auth page with sign in / create account
- ✅ Today dashboard with score gauge, level, streak, plant widget
- ✅ Date picker with horizontal scroll
- ✅ Habit cards with toggle, numeric stepper, timer actions
- ✅ XP fly-up animation on completion (+100 XP)
- ✅ Habits master view with 7-day dot grid and stats
- ✅ Habit form modal (create/edit/archive/delete)
- ✅ Tasks view with add/edit/toggle/delete
- ✅ Pomodoro timer with presets and session tracking
- ✅ Analytics with consistency heatmap and weekly bar chart
- ✅ Settings modal with export/import
- ✅ Bottom navigation with 5 tabs
- ✅ Organic & Earthy design theme (Outfit + Manrope fonts)

### Bug Fixes (from original analysis)
- ✅ Fixed streak protection logic (new "streak_protected" status)
- ✅ Fixed analytics stale rendering (now re-fetches on tab switch)
- ✅ Fixed light theme contrast issues (earthy warm palette)
- ✅ Added completion animations (check bounce, XP fly-up)
- ✅ Data loss eliminated (cloud-based persistence)

## Test Results
- Backend: 100% (27/27 tests passed)
- Frontend: 100% (all core flows verified)

## Prioritized Backlog

### P0 — Done ✅

### P1 — Next Phase
- Push notifications / reminders
- Better onboarding flow for first-time users
- Habit reordering via drag & drop
- Password reset flow

### P2 — Future
- Social/sharing features for streak milestones
- Weekly email digest
- Habit templates (pre-built packs)
- Vacation mode
- Reward shop with XP spending

## Next Tasks
- Await user feedback on Phase 1
- If approved, proceed with P1 features
- Consider PWA conversion for installable mobile experience

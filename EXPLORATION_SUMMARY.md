# Care Meeting Assistant - Exploration Summary

This document provides an index to the comprehensive exploration of the Care Meeting Assistant (Miton Console) application.

## Documentation Files

Two comprehensive documentation files have been created:

### 1. ARCHITECTURE_GUIDE.md (1,394 lines)
Complete architectural and technical documentation covering:
- Executive summary and tech stack overview
- Overall architecture with system diagrams
- Complete directory structure (89 TypeScript files)
- All 12+ core components and their responsibilities
- Data models and 9-table database schema
- All 28 API route endpoints with examples
- Authentication, authorization, and RLS policies
- 7 main features with user flows
- Configuration files explanation
- Implementation patterns and best practices
- Future enhancement opportunities

**Use this for:** Understanding the full system, making architectural decisions, adding new features, understanding data flow

### 2. QUICK_REFERENCE.md (345 lines)
Practical quick-lookup guide with:
- Essential file locations indexed
- All API routes mapped quickly
- Database tables summary
- Development commands
- Environment variables needed
- Common tasks with code examples
- Debug tips and troubleshooting
- File structure patterns
- Security and performance checklists

**Use this for:** Daily development, finding files quickly, common tasks, debugging

## Application Overview

### What It Does
Care Meeting Assistant is a Next.js web application that:
- Manages care meetings with real-time transcription
- Integrates AI assistants (Gemini, OpenAI, Google Cloud)
- Generates automatic meeting summaries
- Tracks participants and voice profiles
- Maintains session history

### Technology Stack
- **Frontend:** React 19, Next.js 16, TypeScript 5
- **Backend:** Next.js App Router, Server Components & Actions
- **Database:** Supabase (PostgreSQL + Row-Level Security)
- **AI/ML:** Google Gemini, OpenAI APIs, Google Cloud
- **Styling:** Tailwind CSS 4, PostCSS
- **Auth:** Supabase Authentication

### Core Features
1. **Meeting Management** - Create, schedule, categorize meetings
2. **Live Sessions** - Start/pause/resume/end with streaming transcripts
3. **Real-time Transcription** - Server-Sent Events (SSE) streaming
4. **AI Assistant** - Multiple provider integration with smart triggering
5. **Auto Summaries** - LLM-generated key decisions and action items
6. **Participants** - Voice profiles for speaker identification
7. **Session History** - View and analyze past meetings
8. **Security** - Complete user isolation via RLS policies

## Quick Navigation

### For Understanding Architecture
1. Start with ARCHITECTURE_GUIDE.md section 1 (Executive Summary)
2. Review section 2 (Directory Structure) for file organization
3. Read section 3 (Key Components) to understand the UI layer
4. Study section 4 (Data Models) for database structure
5. Examine section 5 (API Routes) for backend endpoints

### For Development Tasks
1. Check QUICK_REFERENCE.md for file locations
2. Find your feature area in ARCHITECTURE_GUIDE.md's component list
3. Review code patterns in section 10 of ARCHITECTURE_GUIDE.md
4. Use the common tasks section in QUICK_REFERENCE.md
5. Follow the security checklist before deploying

### For Database Changes
1. Read ARCHITECTURE_GUIDE.md section 4 (Data Models)
2. Review RLS policies in section 6 (Authentication)
3. Check /supabase/*.sql files for migration examples
4. Use the database verification queries in QUICK_REFERENCE.md
5. Test RLS policies before deploying

### For Adding AI Features
1. Read ARCHITECTURE_GUIDE.md section 7.6 (AI Assistant)
2. Study meeting-prompt.ts for AI instructions
3. Review AIResponseRecorder pattern for message saving
4. Check summary-service.ts for LLM integration
5. Follow hook patterns in /src/hooks/ for new providers

### For Security Review
1. Read ARCHITECTURE_GUIDE.md section 6 (Auth & Authorization)
2. Review RLS policies in section 4 (Data Models)
3. Check security checklist in QUICK_REFERENCE.md
4. Audit Service Role Key usage in summary-service.ts
5. Verify all user input validation

## Key Statistics

- **89** TypeScript/TSX source files
- **9** database tables with RLS policies
- **28** API route endpoints
- **12+** core React components
- **6** custom integration hooks
- **3** server action modules
- **1,739** total documentation lines

## Development Commands

```bash
# Development
npm run dev          # Start on port 3500

# Production
npm run build        # Build for production
npm start           # Start on port 3501

# Code Quality
npm run lint        # Run ESLint
```

## Essential Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json
GOOGLE_CLOUD_PROJECT=xxx
OPENAI_API_KEY=xxx
GOOGLE_API_KEY=xxx
```

## Database Tables Reference

| Table | Purpose |
|-------|---------|
| categories | Organize meetings by type |
| participants | People in the system |
| meetings | Meeting definitions |
| meeting_sessions | Session instances |
| meeting_participants | Participant assignments |
| voice_profiles | Voice samples for identification |
| transcripts | Conversation lines with timestamps |
| ai_messages | AI responses during sessions |
| meeting_summaries | Auto-generated summaries |

## API Endpoint Categories

- **Authentication** - Login, signup, password reset
- **Meetings** - CRUD operations and joining
- **Sessions** - Lifecycle management (start, pause, resume, end)
- **Streaming** - Real-time transcript delivery via SSE
- **AI Messages** - Saving AI responses
- **Summaries** - Retrieving and generating summaries
- **AI Providers** - Gemini, Google AI, OpenAI integration
- **Speech** - STT upload, TTS synthesis
- **Tools** - Mock data endpoints for testing

## Security Features

- Supabase Authentication with JWT in secure cookies
- Row-Level Security (RLS) on all data tables
- Transitive RLS for relationship-based access control
- Service Role Keys for admin operations
- Complete user data isolation
- HTTPS required in production
- API key rotation support

## File Organization

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Public auth pages
│   ├── (protected)/       # Protected pages
│   └── api/               # API routes
├── actions/               # Server Actions (mutations)
├── components/            # React components
├── hooks/                 # Custom hooks
├── contexts/              # React contexts
└── lib/                   # Utilities & services
```

## Development Workflow

1. **Feature Planning** - Review ARCHITECTURE_GUIDE.md sections 2-3
2. **Database Design** - Check section 4 for schema patterns
3. **API Implementation** - Follow section 5 endpoint patterns
4. **Component Building** - Use examples from section 3
5. **Testing** - Use mock data endpoints in /api/tools/
6. **Security Review** - Check section 6 and QUICK_REFERENCE.md
7. **Deployment** - Verify all environment variables

## Next Steps

For your next development session:
1. Open QUICK_REFERENCE.md for file locations
2. Find your feature in ARCHITECTURE_GUIDE.md
3. Review the code examples and patterns
4. Check the implementation section for best practices
5. Verify your changes against security checklist

## Getting Help

If you need to understand:
- **A specific file** → Use QUICK_REFERENCE.md file index
- **A feature** → Check ARCHITECTURE_GUIDE.md section 7
- **Database schema** → Review section 4 of ARCHITECTURE_GUIDE.md
- **API endpoint** → See section 5 of ARCHITECTURE_GUIDE.md
- **Common task** → Use QUICK_REFERENCE.md common tasks
- **Security concern** → Review section 6 of ARCHITECTURE_GUIDE.md
- **Development pattern** → Check section 10 of ARCHITECTURE_GUIDE.md

## Documentation Updated

- **ARCHITECTURE_GUIDE.md** - Complete technical documentation
- **QUICK_REFERENCE.md** - Daily development reference
- **EXPLORATION_SUMMARY.md** - This file (overview & navigation)

All files are located in the project root at:
```
/Users/TomoyasuSano/study/NextJs/care-meeting-assistant/
```

---

**Last Updated:** November 14, 2025
**Documentation Scope:** Complete application codebase (89 files)
**Version:** 1.0 - Initial comprehensive exploration

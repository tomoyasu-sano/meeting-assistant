# Care Meeting Assistant - Application Architecture & Implementation Guide

## Executive Summary

**Care Meeting Assistant** (Miton Console) is a Next.js-based web application designed to facilitate and manage care meetings with integrated AI assistance. The application records meetings, transcribes conversations, generates AI-powered summaries, and manages meeting participants and sessions.

**Technology Stack:**
- Frontend: React 19, Next.js 16, TypeScript 5
- Backend: Next.js App Router, Server Components & Actions
- Database: Supabase (PostgreSQL + PostgREST API)
- AI/ML: Google Gemini AI, OpenAI APIs, Google Cloud Speech/TTS
- Styling: Tailwind CSS, PostCSS
- Authentication: Supabase Auth

---

## 1. Overall Architecture

### Architecture Diagram Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    User Browser                              │
│  (Login, Dashboard, Meetings, Participants, Categories)     │
└────────────┬────────────────────────────────────────────────┘
             │ HTTP/WebSocket
┌────────────▼────────────────────────────────────────────────┐
│          Next.js 16 Full-Stack Application                   │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Client-Side (React 19 Components)                       ││
│  │  - Live Session UI (transcripts, AI responses)           ││
│  │  - Voice recording & playback                            ││
│  │  - Real-time transcript streaming                        ││
│  │  - Session summaries                                     ││
│  └─────────────────────────────────────────────────────────┘│
│                         │                                    │
│  ┌─────────────────────▼─────────────────────────────────┐ │
│  │  Server-Side (API Routes & Server Actions)             │ │
│  │  - Authentication endpoints                             │ │
│  │  - Meeting/Session lifecycle management                 │ │
│  │  - AI integration (Gemini, OpenAI)                      │ │
│  │  - Transcript streaming & storage                       │ │
│  │  - Summary generation                                   │ │
│  │  - Speech-to-Text & Text-to-Speech                      │ │
│  └─────────────────────────────────────────────────────────┘│
└────────────┬────────────────────────────────────────────────┘
             │ API Calls
┌────────────▼────────────────────────────────────────────────┐
│  External Services                                           │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  Supabase        │  │  Google Cloud    │                │
│  │  - PostgreSQL    │  │  - Speech-to-Text│                │
│  │  - Auth          │  │  - Text-to-Speech│                │
│  │  - Storage       │  │  - Vertex AI     │                │
│  │  - RLS           │  │                  │                │
│  └──────────────────┘  └──────────────────┘                │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  OpenAI          │  │  Google Gemini   │                │
│  │  - Realtime API  │  │  - Gemini Live   │                │
│  │  - Chat API      │  │  - Gemini 1.5    │                │
│  └──────────────────┘  └──────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Patterns

1. **Server Components & Server Actions**: Leverages Next.js 16's server-first architecture
2. **Row-Level Security (RLS)**: PostgreSQL policies enforce user data isolation
3. **Service Role Keys**: Used for admin operations that bypass RLS
4. **Streaming Responses**: Server-Sent Events (SSE) for real-time transcript delivery
5. **AI Provider Abstraction**: Multiple AI providers with unified interfaces

---

## 2. Directory Structure & File Organization

```
care-meeting-assistant/
├── src/
│   ├── app/                              # Next.js App Router
│   │   ├── layout.tsx                    # Root layout (Japanese, Tailwind)
│   │   ├── page.tsx                      # Landing page
│   │   │
│   │   ├── (auth)/                       # Auth routes (public, unprotected)
│   │   │   ├── login/
│   │   │   │   ├── page.tsx
│   │   │   │   └── LoginForm.tsx
│   │   │   ├── signup/
│   │   │   │   ├── page.tsx
│   │   │   │   └── SignupForm.tsx
│   │   │   ├── reset-password/
│   │   │   │   ├── page.tsx
│   │   │   │   └── ResetPasswordForm.tsx
│   │   │   ├── update-password/
│   │   │   │   ├── page.tsx
│   │   │   │   └── UpdatePasswordForm.tsx
│   │   │   └── layout.tsx
│   │   │
│   │   ├── (protected)/                  # Protected routes (authenticated users)
│   │   │   ├── layout.tsx                # Requires auth, shows nav sidebar
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx              # Main dashboard
│   │   │   ├── categories/
│   │   │   │   └── page.tsx              # Category CRUD
│   │   │   ├── participants/
│   │   │   │   └── page.tsx              # Participant CRUD
│   │   │   ├── meetings/
│   │   │   │   ├── page.tsx              # Meetings list & CRUD
│   │   │   │   └── [meetingId]/
│   │   │   │       ├── page.tsx          # Meeting details
│   │   │   │       └── live/
│   │   │   │           └── page.tsx      # Live session UI
│   │   │   ├── settings/
│   │   │   │   └── page.tsx              # User settings
│   │   │   └── _components/
│   │   │       └── SignOutButton.tsx     # Shared component
│   │   │
│   │   ├── api/                          # API routes
│   │   │   ├── auth/
│   │   │   │   ├── reset-password/       # Password reset endpoint
│   │   │   │   └── update-password/      # Update password endpoint
│   │   │   │
│   │   │   ├── meetings/
│   │   │   │   ├── [meetingId]/
│   │   │   │   │   ├── route.ts          # GET/PUT meeting details
│   │   │   │   │   ├── stream/           # SSE streaming transcripts
│   │   │   │   │   ├── sessions/
│   │   │   │   │   │   ├── route.ts      # GET sessions list
│   │   │   │   │   │   ├── start/        # POST start session
│   │   │   │   │   │   ├── active/       # GET active session
│   │   │   │   │   │   └── [sessionId]/
│   │   │   │   │   │       ├── end/      # POST end session + summary
│   │   │   │   │   │       ├── pause/    # POST pause session
│   │   │   │   │   │       ├── resume/   # POST resume session
│   │   │   │   │   │       └── transcripts/ # GET session transcripts
│   │   │   │   │   ├── ai-messages/      # POST save AI messages
│   │   │   │   │   ├── summary/          # GET/POST meeting summary
│   │   │   │   │   └── summaries/
│   │   │   │   │       └── history/      # GET summary history
│   │   │   │   └── join/                 # POST join meeting (token-based)
│   │   │   │
│   │   │   ├── gemini/                   # Gemini AI endpoints
│   │   │   │   ├── generate/             # Generate AI response
│   │   │   │   ├── live-session/         # Gemini Live streaming
│   │   │   │   ├── simple/               # Simple Gemini call
│   │   │   │   └── test/                 # Test endpoint
│   │   │   │
│   │   │   ├── stt/                      # Speech-to-Text endpoints
│   │   │   │   ├── upload/               # POST audio file
│   │   │   │   ├── stream/               # Streaming STT
│   │   │   │   ├── test/                 # Test endpoint
│   │   │   │   └── test-upload/          # Test upload
│   │   │   │
│   │   │   ├── tts/
│   │   │   │   └── synthesize/           # Text-to-Speech endpoint
│   │   │   │
│   │   │   ├── realtime/
│   │   │   │   └── token/                # Generate Realtime API token
│   │   │   │
│   │   │   ├── voice-upload/             # Voice profile upload
│   │   │   │
│   │   │   └── tools/                    # Tool endpoints for AI
│   │   │       ├── mock-search/          # Mock search results
│   │   │       └── mock-past-meeting-summary/ # Mock past summaries
│   │   │
│   │   └── settings/test*/               # Test pages (dev only)
│   │
│   ├── actions/                          # Server Actions
│   │   ├── categories.ts                 # Category CRUD actions
│   │   ├── participants.ts               # Participant CRUD actions
│   │   └── meetings.ts                   # Meeting CRUD actions
│   │
│   ├── components/                       # Reusable React components
│   │   ├── LiveSessionPanel.tsx          # Main live session UI (transcripts + AI)
│   │   ├── LiveSessionContainer.tsx      # Container wrapper
│   │   ├── LiveSessionHeader.tsx         # Header with controls
│   │   ├── SessionSummary.tsx            # Summary display
│   │   ├── ViewerSessionPanel.tsx        # Viewer-only mode
│   │   ├── VoiceRecorder.tsx             # Voice recording component
│   │   ├── VoiceRegistrationSection.tsx  # Voice profile registration
│   │   ├── SessionItem.tsx               # Session list item
│   │   ├── LoadingModal.tsx              # Loading indicator
│   │   ├── AIOutputModeSelector.tsx      # AI mode selector
│   │   └── CopyButton.tsx                # Utility copy button
│   │
│   ├── hooks/                            # Custom React hooks
│   │   ├── useRealtimeAI.ts              # OpenAI Realtime API integration
│   │   ├── useGeminiAI.ts                # Gemini AI integration
│   │   ├── useGoogleAI.ts                # Google AI (assessment) integration
│   │   ├── useGoogleSTT.ts               # Google Speech-to-Text
│   │   ├── useGoogleTTS.ts               # Google Text-to-Speech
│   │   └── useTriggerEngine.ts           # Trigger evaluation for AI responses
│   │
│   ├── contexts/                         # React contexts
│   │   └── AIModeContext.tsx             # AI mode provider & hook
│   │
│   ├── lib/                              # Utility libraries & services
│   │   ├── supabase/
│   │   │   ├── client.ts                 # Browser client (singleton)
│   │   │   ├── server.ts                 # Server-side client
│   │   │   └── service.ts                # Service role client (admin)
│   │   │
│   │   ├── ai/
│   │   │   ├── meeting-prompt.ts         # AI system instructions & helpers
│   │   │   ├── meeting-functions.ts      # Function calling definitions
│   │   │   ├── ai-message-recorder.ts    # Unified AI message saving
│   │   │   ├── summary-service.ts        # Summary generation orchestrator
│   │   │   └── summary-providers.ts      # AI provider abstractions
│   │   │
│   │   ├── google-ai/
│   │   │   ├── config.ts                 # Google Cloud configuration
│   │   │   └── stt-session.ts            # STT session management
│   │   │
│   │   ├── server/
│   │   │   ├── supabaseAdmin.ts          # Admin client helper
│   │   │   └── healthCheck.ts            # Health check utility
│   │   │
│   │   ├── utils/
│   │   │   └── conversation-merger.ts    # Merge transcripts + AI messages
│   │   │
│   │   └── cost-tracker.ts               # Usage & cost tracking
│   │
│   └── public/                           # Static assets
│
├── supabase/                             # Database migrations & setup
│   ├── create_tables_final.sql           # Categories & Participants tables
│   ├── stage4_meetings.sql               # Meetings & meeting_participants
│   ├── stage5_voice_profiles.sql         # Voice profiles for identification
│   ├── stage6_transcripts.sql            # Transcript storage
│   ├── stage8_meeting_sessions.sql       # Session lifecycle & summaries
│   ├── STORAGE_SETUP.md                  # Storage bucket setup guide
│   ├── OPENAI_SETUP.md                   # OpenAI configuration
│   └── migrations/                       # Version-controlled migrations
│
├── package.json                          # Dependencies
├── tsconfig.json                         # TypeScript config
├── next.config.ts                        # Next.js config
├── postcss.config.mjs                    # PostCSS/Tailwind config
├── eslint.config.mjs                     # ESLint config
├── .env.local                            # Environment variables (local)
├── google-credentials.json               # Google Cloud credentials
├── live_api_auth.json                    # Realtime API credentials
└── README.md                             # Project README
```

---

## 3. Key Components & Their Responsibilities

### Frontend Components

#### LiveSessionPanel (Primary Live Session UI)
**Path:** `/src/components/LiveSessionPanel.tsx`

**Responsibilities:**
- Manages live session state (active, paused, ended)
- Displays real-time transcripts with speaker names
- Shows AI responses and suggestions
- Handles session start/pause/resume/end operations
- Integrates with multiple AI providers (Gemini Live, Google AI, OpenAI Realtime)
- Manages AI message recording via AIResponseRecorder
- Displays session summaries on completion

**Key State:**
```typescript
- transcripts: Array of transcript objects
- aiMessages: Array of AI responses
- sessionStatus: 'idle' | 'active' | 'paused' | 'ended'
- currentSession: Session metadata
- elapsedTime: Session duration counter
- speakerCount: Number of unique speakers
```

**AI Integration Points:**
- Gemini Live API integration via `useGeminiAI()`
- Google AI assessment via `useGoogleAI()`
- OpenAI Realtime API via `useRealtimeAI()`

#### LiveSessionHeader
**Path:** `/src/components/LiveSessionHeader.tsx`

Provides session controls:
- Session status indicator
- AI mode selector (Gemini, Google AI, OpenAI)
- Start/Pause/Resume/End buttons
- Timer display
- Speaker count

#### SessionSummary
**Path:** `/src/components/SessionSummary.tsx`

Displays generated summaries including:
- Summary text
- Key decisions
- Action items
- Topics discussed
- Session statistics (duration, participant count)

#### VoiceRecorder
**Path:** `/src/components/VoiceRecorder.tsx`

Handles voice capture:
- Browser audio API integration
- Real-time audio visualization
- Recording controls
- Audio upload to voice profiles

### Server Components & Pages

#### Protected Dashboard Layout
**Path:** `/src/app/(protected)/layout.tsx`

- Enforces authentication via server-side getUser() check
- Renders navigation sidebar with protected routes
- Displays logged-in user email
- SignOut button

#### Meetings Management Page
**Path:** `/src/app/(protected)/meetings/page.tsx`

- Lists all meetings with status
- Form to create new meetings
- Category & participant selection
- Optional password protection setup
- Edit/Delete operations via server actions

#### Live Session Page
**Path:** `/src/app/(protected)/meetings/[meetingId]/live/page.tsx`

- Server-side fetches meeting details
- Renders LiveSessionPanel component
- Provides meeting context to client

---

## 4. Data Models & Database Schema

### Core Tables

#### Users (Via Supabase Auth)
- Managed by Supabase authentication
- All other tables reference `auth.users(id)`

#### categories
```sql
id UUID PRIMARY KEY
created_at TIMESTAMPTZ
user_id UUID -> auth.users(id)
title TEXT NOT NULL
description TEXT
color_code TEXT
```
**Purpose:** Organize meetings by category (e.g., "Care Planning", "Team Standup")
**RLS:** Users see only their own categories

#### participants
```sql
id UUID PRIMARY KEY
created_at TIMESTAMPTZ
user_id UUID -> auth.users(id)
display_name TEXT NOT NULL
role TEXT
organization TEXT
notes TEXT
voice_profile_id UUID (nullable)
```
**Purpose:** Store people involved in meetings
**RLS:** Users manage their own participant lists

#### meetings
```sql
id UUID PRIMARY KEY
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
category_id UUID -> categories(id)
title TEXT NOT NULL
scheduled_at TIMESTAMPTZ
status TEXT ('scheduled', 'in_progress', 'completed', 'cancelled')
join_token TEXT UNIQUE (for shareable links)
join_password_hash TEXT (optional)
max_participants INTEGER DEFAULT 5
ai_config_snapshot JSONB
```
**Purpose:** Define individual meetings
**RLS:** Users access only meetings in their categories

#### meeting_participants
```sql
id UUID PRIMARY KEY
created_at TIMESTAMPTZ
meeting_id UUID -> meetings(id)
participant_id UUID -> participants(id)
is_voice_registered BOOLEAN
joined_at TIMESTAMPTZ
UNIQUE(meeting_id, participant_id)
```
**Purpose:** Maps participants to meetings
**RLS:** Users manage participants for their meetings

#### voice_profiles
```sql
id UUID PRIMARY KEY
created_at TIMESTAMPTZ
participant_id UUID -> participants(id)
feature_blob_path TEXT (Supabase Storage path)
embedding_vector TEXT
model_version TEXT
status TEXT ('pending', 'registered', 'failed')
file_size_bytes INTEGER
duration_seconds REAL
error_message TEXT
```
**Purpose:** Store participant voice samples for speaker identification
**RLS:** Users access profiles of their participants

#### meeting_sessions
```sql
id UUID PRIMARY KEY
meeting_id UUID -> meetings(id)
started_at TIMESTAMPTZ
ended_at TIMESTAMPTZ (nullable)
status TEXT ('active', 'paused', 'ended')
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```
**Purpose:** Track individual session instances for a meeting
**RLS:** Users access sessions of their meetings

#### transcripts
```sql
id UUID PRIMARY KEY
created_at TIMESTAMPTZ
meeting_id UUID -> meetings(id)
session_id UUID -> meeting_sessions(id)
participant_id UUID -> participants(id) (nullable)
text TEXT NOT NULL
start_time REAL (seconds from session start)
end_time REAL (nullable)
confidence REAL (0.0-1.0)
language TEXT ('ja', 'en', etc.)
audio_duration REAL
speaker_label TEXT ('Speaker 1', 'Speaker 2', etc.)
```
**Purpose:** Store timestamped transcript lines
**RLS:** Users access transcripts of their meetings

#### meeting_summaries
```sql
id UUID PRIMARY KEY
session_id UUID -> meeting_sessions(id)
meeting_id UUID -> meetings(id)
summary_text TEXT NOT NULL
key_decisions JSONB (array of decisions)
action_items JSONB (array of action items)
topics_discussed TEXT[] (array of topic strings)
participant_count INTEGER
duration_seconds INTEGER
generated_at TIMESTAMPTZ
created_at TIMESTAMPTZ
```
**Purpose:** Store AI-generated summaries per session
**RLS:** Users access summaries of their meetings

#### ai_messages
```sql
id UUID PRIMARY KEY
meeting_id UUID -> meetings(id)
session_id UUID -> meeting_sessions(id)
content TEXT NOT NULL
source TEXT ('response', 'trigger', 'error')
provider TEXT ('gemini_live', 'gemini_assessment', 'openai_realtime')
mode TEXT ('assistant', 'assessment', 'custom')
turn_id TEXT (for deduplication)
render_format TEXT ('text', 'audio', 'rich_text')
created_at TIMESTAMPTZ
```
**Purpose:** Store all AI-generated responses during meetings
**RLS:** Users access messages from their meetings

### Data Flow in Live Session

```
User Speech Input
    ↓
[STT Provider: Google Cloud Speech-to-Text]
    ↓
transcripts table (INSERT)
    ↓
Display in UI (real-time)
    ↓
[AI Trigger Engine: Evaluate if AI should respond]
    ↓
[AI Provider: Gemini Live / Google AI / OpenAI Realtime]
    ↓
ai_messages table (INSERT)
    ↓
Display in UI
    ↓
[Session End]
    ↓
[Summary Service: Merge transcripts + ai_messages]
    ↓
[LLM: Generate comprehensive summary]
    ↓
meeting_summaries table (INSERT)
    ↓
Display summary in UI
```

---

## 5. API Routes & Functionality

### Authentication Endpoints

#### POST `/api/auth/reset-password`
- Initiates password reset flow
- Sends reset email
- Supabase auth integration

#### POST `/api/auth/update-password`
- Updates user password after reset
- Requires valid reset token

### Meeting Management Endpoints

#### GET/PUT `/api/meetings/[meetingId]`
- **GET:** Retrieve meeting details
- **PUT:** Update meeting (title, scheduled_at, status, etc.)
- **Auth:** Owner only via RLS

#### POST `/api/meetings/join`
- Join meeting via shareable token
- Optional password validation
- Guest access flow

### Session Lifecycle Endpoints

#### POST `/api/meetings/[meetingId]/sessions/start`
**Request Body:**
```json
{
  "aiMode": "gemini_live" | "google_ai" | "openai_realtime" | "mock"
}
```
**Creates:** New `meeting_sessions` record with status='active'
**Returns:** Session object with ID

#### POST `/api/meetings/[meetingId]/sessions/[sessionId]/pause`
**Updates:** Session status to 'paused'

#### POST `/api/meetings/[meetingId]/sessions/[sessionId]/resume`
**Updates:** Session status back to 'active'

#### POST `/api/meetings/[meetingId]/sessions/[sessionId]/end`
**Triggers:**
1. Update session status to 'ended'
2. Call `generateSummaryForSession()` with merged transcripts + AI messages
3. Save summary to `meeting_summaries`
**Returns:** Updated session + summary status

#### GET `/api/meetings/[meetingId]/sessions`
**Returns:** All sessions for a meeting

#### GET `/api/meetings/[meetingId]/sessions/active`
**Returns:** Currently active session (if any)

#### GET `/api/meetings/[meetingId]/sessions/[sessionId]/transcripts`
**Returns:** All transcript lines for session

### Transcript & Streaming Endpoints

#### GET `/api/meetings/[meetingId]/stream`
**Query:** `?sessionId=UUID`
**Protocol:** Server-Sent Events (SSE)
**Behavior:**
- Validates session is active
- Streams mock transcript lines every 2 seconds
- Saves each transcript to DB
- Returns transcript metadata to client
**Message Format:**
```json
{
  "type": "transcript" | "connected" | "end" | "timeout",
  "id": "transcript-uuid",
  "speaker": "Speaker name",
  "text": "Transcript text",
  "timestamp": "ISO 8601",
  "startTime": 123.45
}
```

### AI Message Endpoints

#### POST `/api/meetings/[meetingId]/ai-messages`
**Request Body:**
```json
{
  "sessionId": "UUID",
  "content": "AI response text",
  "source": "response" | "trigger" | "error",
  "provider": "gemini_live" | "gemini_assessment" | "openai_realtime",
  "mode": "assistant" | "assessment" | "custom",
  "turnId": "timestamp-random"
}
```
**Saves:** Message to `ai_messages` table with deduplication via turnId

### Summary Endpoints

#### GET `/api/meetings/[meetingId]/summary`
**Returns:** Latest summary for meeting

#### GET `/api/meetings/[meetingId]/summaries/history`
**Returns:** All summaries across sessions

### Gemini AI Endpoints

#### POST `/api/gemini/generate`
**Request Body:**
```json
{
  "sessionId": "UUID",
  "triggerType": "trigger_reason",
  "conversationHistory": [...],
  "meetingTitle": "string"
}
```
**Behavior:**
- Uses meeting prompt system instructions
- Streams response via HTTP ReadableStream
- Saves response via AIResponseRecorder
**Response:** Streaming text chunks

#### GET `/api/gemini/live-session`
**Protocol:** WebSocket (Gemini Live integration)
**Manages:** Continuous bidirectional AI conversation

### Speech-to-Text Endpoints

#### POST `/api/stt/upload`
**Accepts:** Audio file upload
**Integration:** Google Cloud Speech-to-Text
**Returns:** Transcribed text

#### GET `/api/stt/stream`
**Protocol:** WebRTC/Streaming
**Real-time transcription** from microphone input

### Text-to-Speech Endpoint

#### POST `/api/tts/synthesize`
**Request:** Text content
**Integration:** Google Cloud Text-to-Speech
**Returns:** Audio file or stream

### Tool Endpoints

#### GET `/api/tools/mock-search`
**Returns:** Mock search results for participant info

#### GET `/api/tools/mock-past-meeting-summary`
**Returns:** Mock previous meeting summaries

### Realtime API Token Endpoint

#### POST `/api/realtime/token`
**Returns:** Ephemeral token for OpenAI Realtime API
**Used by:** `useRealtimeAI()` hook for WebRTC

---

## 6. Authentication & Authorization

### Architecture

```
┌──────────────────────────────┐
│   Supabase Authentication    │
│   - Email/Password signup    │
│   - Email verification       │
│   - Password reset flow      │
│   - JWT token management     │
└──────────────┬───────────────┘
               │
       ┌───────▼────────┐
       │  JWT Token     │
       │  (in Cookie)   │
       └───────┬────────┘
               │
    ┌──────────▼──────────┐
    │ Middleware Check    │
    │ (via RLS policies)  │
    └──────────┬──────────┘
               │
    ┌──────────▼─────────────────┐
    │  Row-Level Security (RLS)   │
    │  - User isolation          │
    │  - Category-based access   │
    │  - Transitive checks       │
    └────────────────────────────┘
```

### Auth Flow

#### Signup
1. User enters email + password on `/signup`
2. `SignupForm` calls `supabase.auth.signUp()`
3. Confirmation email sent (if email verification enabled)
4. On verification, user creates account
5. Redirect to `/dashboard`

#### Login
1. User enters credentials on `/login`
2. `LoginForm` calls `supabase.auth.signInWithPassword()`
3. JWT token stored in secure cookie (handled by Supabase)
4. Redirect to `/dashboard`

#### Protected Routes
1. Server Component checks `supabase.auth.getUser()`
2. If no user, redirect to `/login`
3. Session maintained via cookie-based JWT

#### Password Reset
1. User navigates to `/reset-password`
2. Enters email → sends reset link via email
3. User clicks link → `/update-password` page
4. Sets new password via API endpoint

### Row-Level Security (RLS)

All tables implement RLS policies:

**Example - categories table:**
```sql
-- Users can view only their own categories
CREATE POLICY "Users can view their own categories"
  ON public.categories FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can create categories
CREATE POLICY "Users can create categories"
  ON public.categories FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Update/Delete only own categories
CREATE POLICY "Users can update their own categories"
  ON public.categories FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

**Transitive RLS - meetings:**
```sql
-- Users can view meetings in their categories (transitive check)
CREATE POLICY "Users can view meetings in their categories"
  ON public.meetings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.categories
      WHERE categories.id = meetings.category_id
      AND categories.user_id = auth.uid()
    )
  );
```

### Supabase Client Variants

#### Browser Client (`/lib/supabase/client.ts`)
```typescript
// Singleton for client-side operations
// Uses anonymous key (limited scope)
const supabase = getSupabaseBrowserClient();
const { data: { user } } = await supabase.auth.getUser();
```

#### Server Client (`/lib/supabase/server.ts`)
```typescript
// Server-side with session cookie support
// Still respects RLS policies
const supabase = await getSupabaseServerClient();
const { data: { user } } = await supabase.auth.getUser();
```

#### Service Role Client (`/lib/supabase/service.ts`)
```typescript
// Admin access - BYPASSES RLS
// Used only for backend operations (summary generation, etc.)
const supabase = getSupabaseServiceClient();
// Operations here ignore RLS policies
```

---

## 7. Main Features & User Flows

### Feature 1: Meeting Management

**User Flow:**
1. Navigate to `/meetings`
2. Select category from dropdown
3. Fill meeting form:
   - Title
   - Scheduled date/time
   - Select participants
   - Optional password
4. Click "Create" → Server action creates meeting
5. Receive unique `join_token` for sharing
6. Meeting appears in list

**Backend Operations:**
- `createMeeting()` server action
- Creates `meetings` record
- Creates `meeting_participants` records
- Generates unique token

### Feature 2: Live Session Management

**User Flow:**
1. Open meeting → Click "Start Session"
2. Choose AI mode (Gemini Live, Google AI, etc.)
3. POST `/api/meetings/{id}/sessions/start`
4. Session created with status='active'
5. Transcripts begin streaming via SSE
6. AI responses appear in real-time
7. Click "End Session"
8. Session status → 'ended'
9. Automatically triggers summary generation
10. Summary displayed in UI

**Technical Stages:**
1. **Session Start:** `meeting_sessions` INSERT
2. **Transcript Streaming:** Real-time data flow + DB saves
3. **AI Generation:** Trigger evaluation + Provider call
4. **Message Save:** Each AI response saved to `ai_messages`
5. **Session End:** Update status, trigger summary
6. **Summary Generation:** Merge + LLM processing + Save

### Feature 3: Participant Management

**User Flow:**
1. Navigate to `/participants`
2. Form to add participant:
   - Display name (required)
   - Role
   - Organization
   - Notes
3. Click "Add" → Server action creates participant
4. Optionally voice-register participant:
   - Click "Record Voice Profile"
   - Speak into microphone
   - Upload to Supabase Storage
   - Creates `voice_profiles` record

**Backend Operations:**
- `createParticipant()` server action
- Voice upload to Supabase Storage bucket
- `voice_profiles` record with status='registered'

### Feature 4: Category Management

**User Flow:**
1. Navigate to `/categories`
2. Create category with:
   - Title
   - Description
   - Color code
3. Categories group related meetings
4. Used for RLS permission checks

**Backend Operations:**
- `createCategory()` server action
- RLS ensures user-specific isolation

### Feature 5: Real-Time Transcription

**User Flow:**
1. Session started
2. Microphone captures speech
3. Speech-to-Text API processes audio
4. Transcript appears in UI (2-second latency in mock)
5. Speaker name (from participant lookup) shown
6. Transcript saved to DB in real-time

**Technical Implementation:**
- SSE streaming from `/api/meetings/{id}/stream`
- Mock data streamed every 2 seconds
- Each transcript inserted to DB
- UI uses streaming to display in real-time

### Feature 6: AI-Powered Meeting Assistant

**User Flow:**
1. During session, AI listens to conversation
2. Evaluates if it should speak (via trigger engine)
3. Generates contextual response
4. Speaks response (if audio mode) or displays text
5. All AI messages saved for summary generation

**AI Providers Available:**
- **Gemini Live**: Streaming conversation
- **Google AI**: Assessment & analysis mode
- **OpenAI Realtime**: WebRTC-based real-time interaction

**Trigger Conditions (from meeting-prompt.ts):**
1. Direct question to AI ("Miton, what do you think?")
2. Discussion stuck (no progress, confusion)
3. Important historical data to reference
4. Contradiction detected
5. Long silence (45+ seconds)

### Feature 7: Automatic Summary Generation

**User Flow:**
1. Meeting session ends
2. Summary generation triggered automatically
3. Conversation logs merged (human + AI)
4. LLM analyzes conversation
5. Summary includes:
   - Overview of meeting
   - Key decisions made
   - Action items
   - Topics discussed
6. Summary displayed in UI
7. Saved for historical reference

**Backend Process (summary-service.ts):**
1. Fetch `transcripts` for session
2. Fetch `ai_messages` for session
3. Merge into unified conversation timeline
4. Create summary prompt
5. Call LLM (Gemini by default)
6. Parse response (structured JSON)
7. Save to `meeting_summaries`
8. Return stats (message counts, duration, etc.)

---

## 8. Configuration Files

### package.json
```json
{
  "name": "care-meeting-assistant",
  "version": "0.1.0",
  "scripts": {
    "dev": "next dev --port 3500",
    "build": "next build",
    "start": "next start -p 3501",
    "lint": "eslint"
  },
  "dependencies": {
    "next": "16.0.1",
    "react": "19.2.0",
    "react-dom": "19.2.0",
    "@supabase/supabase-js": "^2.78.0",
    "@supabase/ssr": "^0.7.0",
    "@google-cloud/speech": "^7.2.1",
    "@google-cloud/text-to-speech": "^6.4.0",
    "@google-cloud/vertexai": "^1.10.0",
    "@google/generative-ai": "^0.24.1",
    "openai": "^6.8.1",
    "ws": "^8.18.3"
  },
  "devDependencies": {
    "typescript": "^5",
    "tailwindcss": "^4",
    "@tailwindcss/postcss": "^4"
  }
}
```

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "jsx": "react-jsx",
    "strict": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### .env.local (Required variables)
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxx
SUPABASE_SERVICE_ROLE_KEY=xxxx

# Google Cloud
GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json
GOOGLE_CLOUD_PROJECT=xxxx
GOOGLE_CLOUD_REGION=us-central1

# OpenAI
OPENAI_API_KEY=xxxx

# Google AI (Gemini)
GOOGLE_API_KEY=xxxx
```

### google-credentials.json
- Google Cloud service account credentials
- Required for STT, TTS, Vertex AI
- Should not be committed (in .gitignore)

### next.config.ts
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
```

---

## 9. User Flows & Journey Maps

### Complete Meeting Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│ 1. SETUP PHASE                                              │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────┐    ┌──────────────┐    ┌────────────────┐  │
│ │ User Signup │───▶ │ Auth Setup   │───▶ │ Create         │  │
│ └─────────────┘    └──────────────┘    │ Categories &   │  │
│                                         │ Participants   │  │
│                                         └────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. MEETING CREATION                                         │
├─────────────────────────────────────────────────────────────┤
│ ┌────────────────┐    ┌──────────────┐    ┌─────────────┐  │
│ │ Create Meeting │───▶ │ Select Params│───▶ │ Generate    │  │
│ │ (title, date)  │    │ (people, cat)│    │ Share Token │  │
│ └────────────────┘    └──────────────┘    └─────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. LIVE SESSION EXECUTION                                   │
├─────────────────────────────────────────────────────────────┤
│ ┌────────────┐   ┌──────────────┐   ┌─────────────────┐    │
│ │ Start Live │──▶│ Transcription│──▶│ AI Engagement   │    │
│ │ Session    │   │ (in real-time)│   │ (if triggered) │    │
│ └────────────┘   └──────────────┘   └─────────────────┘    │
│                         │                       │            │
│                    [Save transcripts]    [Save AI messages]  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. SESSION CONCLUSION                                       │
├─────────────────────────────────────────────────────────────┤
│ ┌──────────────┐   ┌─────────────────┐   ┌──────────────┐  │
│ │ End Session  │──▶│ Merge Transcr.+ │──▶│ Display      │  │
│ │ Status→ended │   │ Generate Summary│   │ Summary      │  │
│ └──────────────┘   └─────────────────┘   └──────────────┘  │
│                          ↓                                   │
│                   [Save to DB]                              │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. HISTORY & ANALYTICS                                      │
├─────────────────────────────────────────────────────────────┤
│ ┌──────────────┐   ┌──────────────┐   ┌───────────────┐   │
│ │ View Summary │──▶│ View Meetings│──▶│ Summary History│   │
│ │ in UI        │   │ List         │   │ (Past sessions)   │
│ └──────────────┘   └──────────────┘   └───────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Participant Voice Registration

```
User navigates to /participants
        ↓
Click "Record Voice Profile"
        ↓
Grant microphone permission
        ↓
Speak for ~30 seconds
        ↓
Upload to Supabase Storage bucket
        ↓
Create voice_profiles record (status='registered')
        ↓
Later: Speaker identification during transcription
```

---

## 10. Key Implementation Patterns

### Server Actions Pattern
Used for data mutations (CRUD operations):

```typescript
// /src/actions/meetings.ts
"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function createMeeting(formData: FormData) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error("Not authenticated");
  
  // Validate input
  const category_id = formData.get("category_id");
  const title = formData.get("title");
  
  // Database operation (RLS applied automatically)
  const { error, data } = await supabase
    .from("meetings")
    .insert({ category_id, title, ... })
    .select();
  
  if (error) throw new Error(error.message);
  
  // Revalidate cache for /meetings page
  revalidatePath("/meetings");
  
  return { success: true, meeting: data[0] };
}
```

### Custom Hooks for AI Integration

```typescript
// /src/hooks/useGeminiAI.ts
export function useGeminiAI(
  onResponse: (response: AIResponse) => void
) {
  const [isGenerating, setIsGenerating] = useState(false);
  
  const generateResponse = useCallback(
    async (sessionId, triggerType, history) => {
      setIsGenerating(true);
      
      const response = await fetch("/api/gemini/generate", {
        method: "POST",
        body: JSON.stringify({
          sessionId,
          triggerType,
          conversationHistory: history,
        }),
      });
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      
      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        onResponse({ text: fullText, ... });
      }
      
      setIsGenerating(false);
    },
    [onResponse]
  );
  
  return { generateResponse, isGenerating };
}
```

### AI Message Recording Unified Layer

```typescript
// /src/lib/ai/ai-message-recorder.ts

export class AIResponseRecorder {
  private buffer: string = "";
  
  appendChunk(chunk: string) {
    this.buffer += chunk;
  }
  
  async flush(params: SaveAIMessageParams) {
    if (!this.buffer.trim()) return false;
    
    return await fetch(`/api/meetings/${params.meetingId}/ai-messages`, {
      method: "POST",
      body: JSON.stringify({
        sessionId: params.sessionId,
        content: this.buffer,
        source: params.source,
        provider: params.provider,
        mode: params.mode,
      }),
    });
  }
}

// Use in component:
const recorder = new AIResponseRecorder();
// As AI response streams in:
recorder.appendChunk(responseChunk);
// When done:
await recorder.flush({
  meetingId,
  sessionId,
  provider: "gemini_live",
  mode: "assistant",
  source: "response",
});
```

### Summary Service Orchestration

```typescript
// /src/lib/ai/summary-service.ts

export async function generateSummaryForSession(options) {
  // 1. Fetch session
  const { data: session } = await supabase
    .from("meeting_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();
  
  // 2. Fetch transcripts
  const { data: transcripts } = await supabase
    .from("transcripts")
    .select("...")
    .eq("session_id", sessionId)
    .order("created_at");
  
  // 3. Fetch AI messages
  const { data: aiMessages } = await supabase
    .from("ai_messages")
    .select("...")
    .eq("session_id", sessionId)
    .order("created_at");
  
  // 4. Merge conversation logs
  const merged = mergeConversationLogs(
    transcripts,
    aiMessages,
    "human_ai_combined"
  );
  
  // 5. Format for LLM
  const conversationText = formatConversationForSummary(merged);
  
  // 6. Generate summary (with retry)
  let summary = null;
  for (let i = 0; i < 3; i++) {
    try {
      const provider = createSummaryProvider("gemini");
      summary = await provider.generateSummary(
        conversationText,
        meetingTitle
      );
      break;
    } catch (e) {
      if (i === 2) throw e;
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
    }
  }
  
  // 7. Save summary
  const { data: saved } = await supabase
    .from("meeting_summaries")
    .insert({
      session_id: sessionId,
      meeting_id: meetingId,
      summary_text: summary.summaryText,
      key_decisions: summary.keyDecisions,
      action_items: summary.actionItems,
      topics_discussed: summary.topicsDiscussed,
    })
    .select()
    .single();
  
  return { status: "success", summary: saved, ... };
}
```

---

## 11. Development & Deployment Notes

### Local Development Setup

1. **Environment Variables**
   ```bash
   cp .env.example .env.local
   # Edit with actual credentials:
   # - Supabase URL & keys
   # - Google Cloud credentials
   # - OpenAI API key
   # - Gemini API key
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Run Development Server**
   ```bash
   npm run dev  # Runs on port 3500
   ```

4. **Database Setup**
   - Create Supabase project
   - Execute SQL migrations from `/supabase/` folder
   - Ensure RLS policies are enabled

5. **Storage Buckets**
   - Create buckets for voice profiles, transcripts, etc.
   - Configure CORS and public access as needed

### Build & Production

```bash
# Build
npm run build

# Start production server (port 3501)
npm start
```

### Code Quality

```bash
# Lint
npm run lint
```

### Key Dependencies
- **Next.js 16.0.1**: Full-stack framework
- **React 19.2.0**: UI library
- **TypeScript 5**: Type safety
- **Supabase**: Database + Auth
- **Google Cloud APIs**: Speech/Vision/Generative AI
- **OpenAI SDK**: Realtime API
- **Tailwind CSS 4**: Styling

---

## 12. Future Enhancement Opportunities

1. **Enhanced Speaker Identification**: Integrate voice embeddings from voice_profiles
2. **Real-time Translation**: Extend STT/TTS for multilingual meetings
3. **Advanced Analytics**: Meeting sentiment, engagement metrics
4. **CRM Integration**: Sync participants with external CRM systems
5. **Notification System**: Alert participants, reminders for scheduled meetings
6. **Collaborative Features**: Multi-user live session hosting
7. **Mobile App**: React Native version for iOS/Android
8. **Advanced Summaries**: Chart generation, action item tracking
9. **Meeting Templates**: Pre-configured settings for recurring meeting types
10. **Search & Analytics**: Full-text transcript search, meeting analytics

---

## Summary

The **Care Meeting Assistant** is a sophisticated Next.js application that:

✓ Manages care meetings with real-time transcription
✓ Integrates multiple AI providers for intelligent assistance
✓ Stores all conversations and generates summaries automatically
✓ Maintains strict user isolation via PostgreSQL RLS
✓ Provides a clean, modern UI for meeting management
✓ Supports voice profiles for participant identification
✓ Implements proper authentication and authorization
✓ Uses server actions for type-safe mutations
✓ Streams data in real-time for responsive UX

The architecture is modular, scalable, and ready for additional features. All AI, database, and streaming functionality is well-isolated and can be extended independently.

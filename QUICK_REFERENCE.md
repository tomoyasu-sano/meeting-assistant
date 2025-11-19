# Care Meeting Assistant - Quick Reference Guide

## Essential File Locations

### Core Application Files
- **Root Config:** `tsconfig.json`, `next.config.ts`, `package.json`
- **Styling:** `postcss.config.mjs`, tailwind config in `package.json`
- **Environment:** `.env.local` (create from environment variables)

### Database & Auth
- **Supabase Client (Browser):** `/src/lib/supabase/client.ts`
- **Supabase Client (Server):** `/src/lib/supabase/server.ts`
- **Supabase Client (Admin):** `/src/lib/supabase/service.ts`
- **SQL Migrations:** `/supabase/*.sql` (apply in order)

### Authentication Pages
- **Login:** `/src/app/(auth)/login/` → `LoginForm.tsx`
- **Signup:** `/src/app/(auth)/signup/` → `SignupForm.tsx`
- **Reset Password:** `/src/app/(auth)/reset-password/` → `ResetPasswordForm.tsx`
- **Update Password:** `/src/app/(auth)/update-password/` → `UpdatePasswordForm.tsx`

### Protected Pages (Require Login)
- **Dashboard:** `/src/app/(protected)/dashboard/page.tsx`
- **Categories:** `/src/app/(protected)/categories/page.tsx`
- **Participants:** `/src/app/(protected)/participants/page.tsx`
- **Meetings List:** `/src/app/(protected)/meetings/page.tsx`
- **Meeting Details:** `/src/app/(protected)/meetings/[meetingId]/page.tsx`
- **Live Session:** `/src/app/(protected)/meetings/[meetingId]/live/page.tsx`
- **Settings:** `/src/app/(protected)/settings/page.tsx`

### Main Components
- **Live Session UI:** `/src/components/LiveSessionPanel.tsx`
- **Session Header:** `/src/components/LiveSessionHeader.tsx`
- **Summary Display:** `/src/components/SessionSummary.tsx`
- **Voice Recorder:** `/src/components/VoiceRecorder.tsx`
- **Container:** `/src/components/LiveSessionContainer.tsx`

### Server Actions (Mutations)
- **Categories:** `/src/actions/categories.ts` (create, update, delete)
- **Participants:** `/src/actions/participants.ts` (create, update, delete)
- **Meetings:** `/src/actions/meetings.ts` (create, update, delete)

### Custom Hooks
- **Realtime AI:** `/src/hooks/useRealtimeAI.ts` (OpenAI integration)
- **Gemini AI:** `/src/hooks/useGeminiAI.ts`
- **Google AI:** `/src/hooks/useGoogleAI.ts`
- **Google STT:** `/src/hooks/useGoogleSTT.ts`
- **Google TTS:** `/src/hooks/useGoogleTTS.ts`
- **Trigger Engine:** `/src/hooks/useTriggerEngine.ts`

### AI & Summary Services
- **Meeting Prompts:** `/src/lib/ai/meeting-prompt.ts`
- **Function Calls:** `/src/lib/ai/meeting-functions.ts`
- **Message Recorder:** `/src/lib/ai/ai-message-recorder.ts`
- **Summary Service:** `/src/lib/ai/summary-service.ts`
- **Summary Providers:** `/src/lib/ai/summary-providers.ts`

### Utilities
- **Conversation Merger:** `/src/lib/utils/conversation-merger.ts`
- **Cost Tracker:** `/src/lib/cost-tracker.ts`

---

## API Routes Quick Map

### Authentication
```
POST   /api/auth/reset-password       → Initiate password reset
POST   /api/auth/update-password      → Update password
```

### Meetings
```
GET    /api/meetings/[meetingId]      → Get meeting details
PUT    /api/meetings/[meetingId]      → Update meeting
POST   /api/meetings/join             → Join meeting via token
```

### Sessions
```
POST   /api/meetings/[meetingId]/sessions/start      → Start session
GET    /api/meetings/[meetingId]/sessions            → List sessions
GET    /api/meetings/[meetingId]/sessions/active     → Get active session
POST   /api/meetings/[meetingId]/sessions/[id]/pause → Pause session
POST   /api/meetings/[meetingId]/sessions/[id]/resume → Resume session
POST   /api/meetings/[meetingId]/sessions/[id]/end   → End session + generate summary
GET    /api/meetings/[meetingId]/sessions/[id]/transcripts → Get transcripts
```

### Streaming
```
GET    /api/meetings/[meetingId]/stream?sessionId=UUID → SSE transcript stream
```

### AI & Messages
```
POST   /api/meetings/[meetingId]/ai-messages         → Save AI message
GET    /api/meetings/[meetingId]/summary             → Get latest summary
GET    /api/meetings/[meetingId]/summaries/history   → Get all summaries
```

### AI Providers
```
POST   /api/gemini/generate           → Generate response via Gemini
GET    /api/gemini/live-session       → Gemini Live streaming
```

### Speech Services
```
POST   /api/stt/upload                → Upload audio for transcription
GET    /api/stt/stream                → Stream STT results
POST   /api/tts/synthesize            → Text-to-speech synthesis
```

### Other
```
POST   /api/realtime/token            → Get OpenAI Realtime token
GET    /api/tools/mock-search         → Mock search results
GET    /api/tools/mock-past-meeting-summary → Mock past summaries
```

---

## Database Tables (Brief)

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| categories | Organize meetings | id, user_id, title, description, color_code |
| participants | People in meetings | id, user_id, display_name, role, organization |
| meetings | Meeting definitions | id, category_id, title, scheduled_at, status, join_token |
| meeting_participants | Maps participants to meetings | meeting_id, participant_id, is_voice_registered |
| voice_profiles | Voice samples | id, participant_id, feature_blob_path, status |
| meeting_sessions | Session instances | id, meeting_id, started_at, ended_at, status |
| transcripts | Conversation lines | id, session_id, text, start_time, speaker_label |
| ai_messages | AI responses | id, session_id, content, source, provider, mode |
| meeting_summaries | Generated summaries | id, session_id, summary_text, key_decisions, action_items |

---

## Development Commands

```bash
# Start development server (port 3500)
npm run dev

# Build for production
npm run build

# Start production server (port 3501)
npm start

# Lint code
npm run lint
```

---

## Key Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# Google Cloud
GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json
GOOGLE_CLOUD_PROJECT=xxx
GOOGLE_CLOUD_REGION=us-central1

# OpenAI
OPENAI_API_KEY=xxx

# Google AI (Gemini)
GOOGLE_API_KEY=xxx
```

---

## Common Tasks

### Add a New Meeting Endpoint
1. Create file: `/src/app/api/meetings/[meetingId]/[feature]/route.ts`
2. Export `GET`, `POST`, `PUT`, or `DELETE` function
3. Use `getSupabaseServerClient()` for DB access
4. Check authentication: `supabase.auth.getUser()`
5. RLS policies apply automatically

### Add a New Page
1. Create directory: `/src/app/(protected)/[feature]/`
2. Create `page.tsx` file
3. Use server component to fetch data
4. Import reusable components from `/src/components/`

### Save AI Message During Session
```typescript
import { saveAIMessage } from '@/lib/ai/ai-message-recorder';

await saveAIMessage({
  meetingId,
  sessionId,
  provider: 'gemini_live',
  mode: 'assistant',
  source: 'response',
  content: 'AI response text',
});
```

### Generate Summary
```typescript
import { generateSummaryForSession } from '@/lib/ai/summary-service';

const result = await generateSummaryForSession({
  meetingId,
  sessionId,
  provider: 'gemini',
  mode: 'human_ai_combined',
});
```

### Access User Context
```typescript
const supabase = await getSupabaseServerClient();
const { data: { user } } = await supabase.auth.getUser();

if (!user) {
  redirect('/login');
}
```

---

## Debug Tips

### Check Database RLS
- Verify user_id matches auth.uid()
- Use Service Role client to bypass RLS: `getSupabaseServiceClient()`

### Monitor API Requests
- Check browser DevTools Network tab
- Look for 401 (Unauthorized) or 403 (Forbidden) responses
- Server logs in terminal show API route execution

### Test SSE Streaming
```bash
curl -N http://localhost:3500/api/meetings/[id]/stream?sessionId=[sid]
```

### View Session State
- Check `meeting_sessions` table for status: active/paused/ended
- Verify session ID matches in request

---

## File Structure Patterns

### Server Components & Pages
```
/src/app/(protected)/[feature]/
  ├── page.tsx              # Main page (server component)
  └── [id]/
      └── page.tsx          # Detail page
```

### API Routes
```
/src/app/api/[resource]/[id]/[action]/
  └── route.ts              # GET, POST, PUT, DELETE handlers
```

### Components
```
/src/components/
  ├── [FeatureName].tsx     # Main component
  ├── [FeatureName]Header.tsx
  ├── [FeatureName]Content.tsx
  └── ...                   # Sub-components
```

### Hooks
```
/src/hooks/
  └── use[FeatureName].ts   # Custom hook for feature logic
```

### Services & Utilities
```
/src/lib/
  ├── [domain]/
  │   ├── [service].ts      # Core service
  │   └── ...
  ├── supabase/
  │   ├── client.ts
  │   ├── server.ts
  │   └── service.ts
  └── utils/
      └── [helper].ts
```

---

## Testing Database Migrations

1. Create SQL file in `/supabase/`
2. Execute in Supabase SQL Editor
3. Verify tables created: `SELECT * FROM information_schema.tables WHERE table_schema='public';`
4. Verify RLS enabled: `SELECT * FROM pg_tables WHERE tablename='[table]' AND schemaname='public';`
5. Test policies: `SELECT * FROM pg_policies WHERE tablename='[table]';`

---

## Performance Considerations

- **Database:** RLS policies run on every query, keep them simple
- **Streaming:** SSE has per-client overhead, consider limits
- **AI Calls:** Rate limit and implement timeouts
- **Storage:** Supabase buckets have bandwidth limits
- **Authentication:** JWT tokens cached in cookies

---

## Security Checklist

- [ ] Never commit `.env.local` or credential files
- [ ] Use Service Role Key only in server-side code
- [ ] Verify RLS policies block unauthorized access
- [ ] Sanitize user inputs (Supabase handles SQL injection)
- [ ] Validate API request origins for CORS
- [ ] Use HTTPS in production
- [ ] Rotate API keys regularly
- [ ] Monitor AI API costs

---

## Links & Resources

- **Next.js:** https://nextjs.org/docs
- **Supabase:** https://supabase.com/docs
- **React 19:** https://react.dev
- **Tailwind CSS:** https://tailwindcss.com/docs
- **TypeScript:** https://www.typescriptlang.org/docs
- **Google Cloud APIs:** https://cloud.google.com/docs
- **OpenAI:** https://platform.openai.com/docs
- **Google Gemini:** https://ai.google.dev/docs


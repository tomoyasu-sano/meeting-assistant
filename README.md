# Meeting Assistant (Miton Console)

An AI-powered meeting assistant application that provides real-time transcription, intelligent AI suggestions, and automatic summary generation for meetings.

![Next.js](https://img.shields.io/badge/Next.js-16.0-black?logo=next.js)
![React](https://img.shields.io/badge/React-19.2-blue?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38B2AC?logo=tailwind-css)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)

---

## 🎯 Project Overview

Meeting Assistant is a full-stack web application designed to facilitate and enhance meeting experiences through:

- **Real-time Speech-to-Text**: Live transcription with speaker identification
- **AI-Powered Assistance**: Context-aware suggestions using multiple AI providers (Gemini, OpenAI, Google Cloud)
- **Automatic Summarization**: LLM-generated meeting summaries with key decisions and action items
- **Session Management**: Complete meeting lifecycle tracking with pause/resume capabilities
- **Participant Management**: Voice profile registration for speaker recognition

**Status**: MVP (Minimum Viable Product) - Production-ready demo

---

## 🏗️ Technical Architecture

### Tech Stack

#### Frontend
- **Framework**: Next.js 16 (App Router, React Server Components)
- **UI Library**: React 19 with TypeScript 5
- **Styling**: Tailwind CSS 4 with PostCSS
- **State Management**: React Hooks, Context API
- **Internationalization**: next-intl for multi-language support

#### Backend
- **Runtime**: Next.js API Routes & Server Actions
- **Database**: Supabase (PostgreSQL with Row-Level Security)
- **Authentication**: Supabase Auth (JWT-based)
- **Real-time**: Server-Sent Events (SSE) for transcript streaming

#### AI/ML Services
- **Google Cloud Speech-to-Text**: Real-time audio transcription
- **Google Cloud Text-to-Speech**: Voice synthesis
- **Google Gemini AI**: Live conversational AI (Gemini 1.5, Gemini Live API)
- **OpenAI**: Realtime API for WebRTC-based interactions
- **Google Vertex AI**: Advanced AI model integration

#### Infrastructure
- **Hosting**: Vercel-ready (Next.js optimized)
- **Storage**: Supabase Storage (voice profiles, transcripts)
- **CDN**: Next.js Image Optimization

---

## 🔑 Key Features

### 1. Meeting Management
- Create and schedule meetings with categories
- Participant assignment and management
- Password-protected shareable meeting links
- Session history tracking

### 2. Live Session Capabilities
- **Start/Pause/Resume/End** session controls
- Real-time transcript display with timestamps
- Speaker identification via voice profiles
- Multi-provider AI integration selector

### 3. AI Integration
- **Gemini Live**: Streaming conversational AI
- **Google AI Assessment**: Analytical insights
- **OpenAI Realtime**: Low-latency voice interactions
- Smart trigger engine for context-aware AI responses

### 4. Automatic Summary Generation
- LLM-powered meeting summaries
- Key decisions extraction
- Action items identification
- Topics discussed analysis
- Historical summary access

### 5. Security & Privacy
- **Row-Level Security (RLS)**: Complete user data isolation
- **JWT Authentication**: Secure session management
- **Service Role Access Control**: Admin operations segregation
- **Environment-based secrets**: No credentials in codebase

---

## 📂 Project Structure

```
care-meeting-assistant/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── (auth)/              # Public authentication pages
│   │   ├── (protected)/         # Protected application pages
│   │   └── api/                 # API routes (28+ endpoints)
│   ├── actions/                 # Server Actions (CRUD operations)
│   ├── components/              # Reusable React components
│   ├── hooks/                   # Custom hooks (AI, STT, TTS)
│   ├── contexts/                # React Context providers
│   └── lib/                     # Utilities & services
│       ├── supabase/            # Database clients (browser, server, service)
│       ├── ai/                  # AI integration services
│       └── google-ai/           # Google Cloud configurations
├── supabase/                    # Database migrations & setup
├── .env.example                 # Environment variables template
└── package.json
```

**Key Metrics:**
- 89 TypeScript/TSX source files
- 9 database tables with RLS policies
- 28 API route endpoints
- 12+ core React components
- 6 custom integration hooks

---

## 🗄️ Database Schema

**9 Core Tables:**

| Table | Purpose |
|-------|---------|
| `categories` | Meeting categorization |
| `participants` | User/participant profiles |
| `meetings` | Meeting definitions |
| `meeting_sessions` | Session lifecycle tracking |
| `meeting_participants` | Participant-meeting relationships |
| `voice_profiles` | Voice samples for speaker ID |
| `transcripts` | Timestamped conversation logs |
| `ai_messages` | AI responses during sessions |
| `meeting_summaries` | Auto-generated summaries |

**Security**: All tables implement PostgreSQL Row-Level Security (RLS) for complete user isolation.

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account (free tier available)
- Google Cloud account (for Speech/AI APIs)
- OpenAI API key (optional, for Realtime API)
- Google AI (Gemini) API key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/meeting-assistant.git
   cd meeting-assistant
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` with your credentials:
   - Supabase URL and keys
   - Google Cloud project settings
   - AI provider API keys

   See `.env.example` for detailed instructions.

4. **Set up Google Cloud credentials**
   - Download service account JSON from Google Cloud Console
   - Save as `google-credentials.json` in project root
   - Ensure file is listed in `.gitignore`

5. **Set up Supabase database**
   - Create a new Supabase project
   - Run SQL migrations from `/supabase/*.sql` files in order:
     ```sql
     -- Execute in Supabase SQL Editor:
     create_tables_final.sql
     stage4_meetings.sql
     stage5_voice_profiles.sql
     stage6_transcripts.sql
     stage8_meeting_sessions.sql
     ```
   - Enable Row-Level Security on all tables

6. **Configure Supabase Storage**
   - Create storage buckets for voice profiles
   - Follow instructions in `/supabase/STORAGE_SETUP.md`

7. **Run development server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3500](http://localhost:3500)

### Production Build

```bash
npm run build
npm start  # Runs on port 3501
```

---

## 🔐 Environment Variables

Required environment variables (see `.env.example` for full details):

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Google Cloud
GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json
GOOGLE_CLOUD_PROJECT=
GOOGLE_CLOUD_REGION=us-central1

# AI Providers
OPENAI_API_KEY=
GOOGLE_API_KEY=
```

**Important**: Never commit `.env.local` or `google-credentials.json` to version control.

---

## 🛠️ Development Highlights

### Architecture Patterns
- **Server Components & Server Actions**: Leveraging Next.js 16's server-first architecture
- **Streaming Responses**: SSE for real-time transcript delivery
- **AI Provider Abstraction**: Unified interface for multiple AI services
- **Type Safety**: Full TypeScript coverage with strict mode

### Code Quality
- ESLint configuration for code consistency
- Modular component architecture
- Custom hooks for business logic separation
- Server-client boundary optimization

### Performance
- React Server Components for reduced client bundle
- Streaming for progressive rendering
- Optimistic UI updates
- Efficient database queries with RLS

---

## 📸 Screenshots

*(Add screenshots here if available)*

---

## 🧪 Testing

Currently in MVP stage. Future plans include:
- Unit tests with Jest
- Integration tests with React Testing Library
- E2E tests with Playwright
- API endpoint testing

---

## 🚢 Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel dashboard
3. Configure environment variables
4. Deploy

**Note**: Ensure all API keys and credentials are set in Vercel environment variables.

### Other Platforms

Compatible with any Node.js hosting platform that supports Next.js 16:
- Railway
- Render
- AWS Amplify
- Google Cloud Run

---

## 📝 API Documentation

**28+ API Endpoints organized by category:**

- **Authentication**: Login, signup, password reset
- **Meetings**: CRUD operations, joining
- **Sessions**: Start, pause, resume, end lifecycle
- **Streaming**: Real-time transcript delivery (SSE)
- **AI Messages**: Saving AI responses
- **Summaries**: Generation and retrieval
- **AI Providers**: Gemini, Google AI, OpenAI integration
- **Speech**: STT upload, TTS synthesis
- **Tools**: Mock data endpoints for testing

See `/ARCHITECTURE_GUIDE.md` for detailed API documentation.

---

## 🎓 Learning Outcomes & Technical Achievements

This project demonstrates proficiency in:

✅ **Modern Full-Stack Development**
- Next.js 16 App Router with Server Components
- TypeScript for type-safe development
- React 19 with advanced hooks

✅ **AI/ML Integration**
- Multiple AI provider orchestration
- Real-time speech processing
- Natural language understanding and generation

✅ **Database Design & Security**
- PostgreSQL with complex relationships
- Row-Level Security implementation
- Efficient query optimization

✅ **Real-time Features**
- Server-Sent Events (SSE)
- WebSocket integration (Gemini Live)
- WebRTC (OpenAI Realtime)

✅ **Authentication & Authorization**
- JWT-based authentication
- Role-based access control
- Transitive RLS policies

✅ **Cloud Services Integration**
- Google Cloud Platform (Speech, TTS, Vertex AI)
- Supabase (Database, Auth, Storage)
- OpenAI API integration

✅ **Production-Ready Practices**
- Environment-based configuration
- Security best practices
- Scalable architecture
- Error handling and logging

---

## 🗺️ Roadmap

Future enhancements planned:
- [ ] Enhanced speaker identification with voice embeddings
- [ ] Real-time translation for multilingual meetings
- [ ] Advanced analytics dashboard
- [ ] Mobile app (React Native)
- [ ] Meeting templates
- [ ] Full-text search across transcripts
- [ ] Calendar integration (Google Calendar, Outlook)
- [ ] Notification system

---

## 📄 License

This project is currently closed-source and not licensed for public use.

For commercial licensing inquiries, please contact the author.

---

## 👤 Author

**Tomoyasu Sano**
- Email: anytimes.sano@gmail.com
- GitHub: [@tomoyasu](https://github.com/tomoyasu) *(update with your actual GitHub username)*

---

## 🙏 Acknowledgments

Built with modern technologies:
- [Next.js](https://nextjs.org/)
- [React](https://react.dev/)
- [Supabase](https://supabase.com/)
- [Google Cloud](https://cloud.google.com/)
- [OpenAI](https://openai.com/)
- [Tailwind CSS](https://tailwindcss.com/)

---

**Note**: This is an MVP version. New user registration is currently disabled to manage AI service costs. The application is intended for demonstration and portfolio purposes.

# ===========================
# Stage 1: Dependencies
# ===========================
FROM node:20-alpine AS deps

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --only=production

# ===========================
# Stage 2: Builder
# ===========================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build Next.js application
# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

# Set dummy environment variables for build time
# These will be overridden by Cloud Run environment variables at runtime
ENV OPENAI_API_KEY="dummy-key-for-build"
ENV GOOGLE_API_KEY="dummy-key-for-build"
ENV NEXT_PUBLIC_SUPABASE_URL="https://dummy.supabase.co"
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY="dummy-key-for-build"
ENV SUPABASE_SERVICE_ROLE_KEY="dummy-key-for-build"
ENV GOOGLE_CLOUD_PROJECT="meeting-supporter"
ENV GOOGLE_CLOUD_REGION="us-central1"

RUN npm run build

# ===========================
# Stage 3: Runner
# ===========================
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy necessary configuration files
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/package.json ./

# Change ownership to nextjs user
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port (Cloud Run uses PORT environment variable)
EXPOSE 8080

# Set PORT environment variable for Cloud Run
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

# Start the application
CMD ["node", "server.js"]

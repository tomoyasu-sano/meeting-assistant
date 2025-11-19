#!/bin/bash

# ===========================
# Cloud Run Deployment Script
# ===========================

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Meeting Assistant - Cloud Run Deploy${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Configuration
PROJECT_ID="meeting-supporter"
REGION="asia-northeast1"  # Tokyo region
SERVICE_NAME="meeting-assistant"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI is not installed${NC}"
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    exit 1
fi

# Set project
echo -e "${GREEN}Setting GCP project to ${PROJECT_ID}...${NC}"
gcloud config set project ${PROJECT_ID}

# Enable required APIs
echo -e "${GREEN}Enabling required Google Cloud APIs...${NC}"
gcloud services enable \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    containerregistry.googleapis.com \
    --project=${PROJECT_ID}

# Build and push Docker image using Cloud Build
echo -e "${GREEN}Building Docker image with Cloud Build...${NC}"
gcloud builds submit --tag ${IMAGE_NAME} --project=${PROJECT_ID}

# Deploy to Cloud Run
echo -e "${GREEN}Deploying to Cloud Run...${NC}"
gcloud run deploy ${SERVICE_NAME} \
    --image ${IMAGE_NAME} \
    --platform managed \
    --region ${REGION} \
    --allow-unauthenticated \
    --memory 2Gi \
    --cpu 2 \
    --timeout 300 \
    --max-instances 10 \
    --min-instances 0 \
    --port 8080 \
    --project=${PROJECT_ID}

# Get service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
    --platform managed \
    --region ${REGION} \
    --format 'value(status.url)' \
    --project=${PROJECT_ID})

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✓ Deployment successful!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Service URL: ${GREEN}${SERVICE_URL}${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Set environment variables using Cloud Run console or gcloud"
echo "2. Test the deployed application"
echo "3. Update README.md with deployment URL"
echo ""

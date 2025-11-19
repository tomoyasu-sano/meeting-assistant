#!/bin/bash

# ===========================
# Set Environment Variables for Cloud Run
# ===========================

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Set Cloud Run Environment Variables${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Configuration
PROJECT_ID="meeting-supporter"
REGION="asia-northeast1"
SERVICE_NAME="meeting-assistant"

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo -e "${YELLOW}Warning: .env.local not found${NC}"
    echo "Please create .env.local with your environment variables"
    exit 1
fi

# Read .env.local and extract variables
echo -e "${GREEN}Reading environment variables from .env.local...${NC}"

# Parse .env.local (skip comments and empty lines)
ENV_VARS=""
while IFS='=' read -r key value; do
    # Skip comments and empty lines
    if [[ $key =~ ^#.*$ ]] || [[ -z $key ]]; then
        continue
    fi

    # Remove quotes from value
    value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")

    # Add to ENV_VARS
    if [ -n "$ENV_VARS" ]; then
        ENV_VARS="${ENV_VARS},${key}=${value}"
    else
        ENV_VARS="${key}=${value}"
    fi
done < .env.local

# Set environment variables in Cloud Run
echo -e "${GREEN}Setting environment variables in Cloud Run...${NC}"
gcloud run services update ${SERVICE_NAME} \
    --region ${REGION} \
    --update-env-vars "${ENV_VARS}" \
    --project=${PROJECT_ID}

echo ""
echo -e "${GREEN}✓ Environment variables updated successfully${NC}"
echo ""
echo -e "${YELLOW}Note: For sensitive data like API keys, consider using Secret Manager:${NC}"
echo "  gcloud secrets create SECRET_NAME --data-file=/path/to/secret"
echo "  gcloud run services update ${SERVICE_NAME} \\"
echo "    --update-secrets=ENV_VAR_NAME=SECRET_NAME:latest"
echo ""

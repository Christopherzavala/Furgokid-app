#!/bin/bash

# ============================================================================
# Firestore Rules Deployment Script
# ============================================================================
# Deploy Firestore security rules to staging environment
# Usage: ./scripts/deploy-staging-rules.sh

set -e  # Exit on error

echo "🔥 FurgoKid - Firestore Staging Rules Deployment"
echo "================================================"

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Error: Firebase CLI not installed"
    echo "Install: npm install -g firebase-tools"
    exit 1
fi

# Check if firestore.rules exists
if [ ! -f "firestore.rules" ]; then
    echo "❌ Error: firestore.rules file not found"
    exit 1
fi

# Login check
echo ""
echo "Checking Firebase authentication..."
if ! firebase projects:list &> /dev/null; then
    echo "❌ Not logged in to Firebase"
    echo "Run: firebase login"
    exit 1
fi

# List available projects
echo ""
echo "Available Firebase projects:"
firebase projects:list

# Deploy to staging
echo ""
echo "📤 Deploying Firestore rules to STAGING..."
echo "Project: furgokid-staging"
echo ""

read -p "Continue with deployment? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled"
    exit 1
fi

# Deploy rules only (not indexes)
firebase deploy --only firestore:rules --project furgokid-staging

echo ""
echo "✅ Firestore rules deployed to staging successfully!"
echo ""
echo "Verify deployment:"
echo "https://console.firebase.google.com/project/furgokid-staging/firestore/rules"

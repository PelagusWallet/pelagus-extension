#!/bin/bash

# Deterministic Build Script for Pelagus Extension
# This script builds the extension in a Docker container and extracts the build artifacts with hash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/deterministic-build-output"
CONTAINER_NAME="pelagus-deterministic-build"

echo "🐳 Building Pelagus Extension deterministically..."
echo "📁 Working directory: $SCRIPT_DIR"
echo "📤 Output directory: $OUTPUT_DIR"
echo ""

# Build the Docker image
echo "🔨 Building Docker image..."
docker build -t "$CONTAINER_NAME" "$SCRIPT_DIR"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Run the container and show hash
echo ""
echo "🏃 Running build and generating hash..."
docker run --rm "$CONTAINER_NAME"

# Extract build artifacts
echo ""
echo "📦 Extracting build artifacts..."
docker run --rm -v "$OUTPUT_DIR":/host-output "$CONTAINER_NAME" sh -c "cp -r /output/* /host-output/"

echo ""
echo "✅ Deterministic build completed!"
echo "📁 Build artifacts saved to: $OUTPUT_DIR"
echo "🔍 Build hash: $(cat "$OUTPUT_DIR/build-hash.txt")"
echo ""
echo "To verify reproducibility, run this script on different machines and compare the hash values."
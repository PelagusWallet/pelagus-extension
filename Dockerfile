FROM node:22.5.1-alpine

WORKDIR /pelagus-extension

# Install system dependencies for reproducible builds
RUN apk add --no-cache \
    python3 \
    py3-pip \
    git \
    make \
    bash \
    coreutils \
    && ln -sf python3 /usr/bin/python

# Set environment variables for deterministic builds
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV TZ=UTC
ENV LANG=C.UTF-8

# Copy package files first for better caching
COPY package.json yarn.lock ./
COPY ui/package.json ./ui/
COPY background/package.json ./background/
COPY provider-bridge/package.json ./provider-bridge/
COPY provider-bridge-shared/package.json ./provider-bridge-shared/
COPY window-provider/package.json ./window-provider/

# Install dependencies with exact versions
RUN yarn install --frozen-lockfile --production=false

# Copy source code
COPY . .

# Build the extension
RUN yarn build

# Generate hash of the built extension
RUN find dist -type f -name "*.js" -o -name "*.json" -o -name "*.html" -o -name "*.css" | \
    sort | xargs cat | sha256sum > /pelagus-extension/build-hash.txt

# Output build info
RUN echo "Build completed at: $(date -u)" > /pelagus-extension/build-info.txt && \
    echo "Node version: $(node --version)" >> /pelagus-extension/build-info.txt && \
    echo "Yarn version: $(yarn --version)" >> /pelagus-extension/build-info.txt && \
    echo "Build hash: $(cat /pelagus-extension/build-hash.txt)" >> /pelagus-extension/build-info.txt

# Create output directory and copy build artifacts
RUN mkdir -p /output && \
    cp -r dist /output/ && \
    cp build-hash.txt /output/ && \
    cp build-info.txt /output/

# Set the default command to output the hash
CMD ["sh", "-c", "echo 'Build Hash:' && cat /output/build-hash.txt && echo 'Build Info:' && cat /output/build-info.txt"]

# Backend Dockerfile
FROM node:20-alpine

WORKDIR /usr/src/app

# Copy package files and install dependencies
# For development, install all deps (including nodemon)
COPY package*.json ./
RUN npm ci

# Copy application source
COPY . .

# Expose backend port
EXPOSE 3000

# Default command (can be overridden in docker-compose)
CMD ["node", "src/server.js"]

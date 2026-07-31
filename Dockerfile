#Stage 1: Build React
FROM node:20-alpine AS react-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

#Stage 2: Flask server
FROM python:3.12-slim
WORKDIR /app

# Copy backend code
COPY backend/ ./backend/

# Copy React build from previous stage into Flask's static folder
COPY --from=react-build /app/frontend/build ./frontend/build

# Install Python dependencies
RUN pip install --no-cache-dir -r backend/requirements.txt

# Environment variables (can be overridden at runtime)
ENV FLASK_APP=backend.server.py
ENV FLASK_ENV=production

# Expose the port Flask runs on
EXPOSE 5000

CMD ["python", "backend/server.py"]
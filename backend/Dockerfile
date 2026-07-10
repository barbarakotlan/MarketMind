# Use an official Python runtime as a parent image
FROM python:3.12-slim

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file into the container
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Default port for local container runs; most platforms override this.
ENV PORT=5001

# Expose the port
EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
    CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:' + os.getenv('PORT', '5001') + '/readyz', timeout=2)" || exit 1

# Run the application
# api:app refers to the "api.py" file and the "app" variable inside it
CMD ["sh", "-c", "gunicorn --bind :${PORT:-5001} --workers ${WEB_CONCURRENCY:-2} --threads ${GUNICORN_THREADS:-4} --timeout ${GUNICORN_TIMEOUT:-60} api:app"]

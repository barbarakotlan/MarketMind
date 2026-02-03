# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file into the container
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Install gunicorn for production
RUN pip install gunicorn

# Copy the rest of the application code
COPY . .

# Set environment variables
ENV PORT=5001

# Expose the port
EXPOSE 5001

# Run the application
# api:app refers to the "api.py" file and the "app" variable inside it
CMD ["gunicorn", "--bind", ":5001", "--workers", "1", "--threads", "8", "--timeout", "0", "api:app"]
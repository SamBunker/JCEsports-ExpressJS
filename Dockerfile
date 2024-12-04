# Step 1: Use an official Node.js runtime as a parent image
FROM node:18-slim

# Step 2: Install build dependencies (including gcc, make, python3)
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    python3-dev \
    gcc \
    make \
    && rm -rf /var/lib/apt/lists/*

# Step 3: Set the working directory inside the container
WORKDIR /usr/src/app

# Step 4: Copy package.json and package-lock.json (if present)
COPY package*.json ./

# Step 5: Clear the npm cache
RUN npm cache clean --force

# Step 6: Install application dependencies (this will trigger rebuilding bcrypt)
RUN npm install --legacy-peer-deps

# Step 7: Copy the rest of your application files
COPY . .

# Step 8: Expose the port that the app will run on
EXPOSE 3000

# Step 9: Define the command to run your application
CMD ["node", "app.js"]
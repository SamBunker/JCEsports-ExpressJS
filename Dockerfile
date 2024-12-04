# Step 1: Use an official Node.js runtime as a parent image
FROM node:18-slim

# Step 2: Set the working directory inside the container
WORKDIR /usr/src/app

# Step 3: Copy package.json and package-lock.json (if present)
COPY package*.json ./

# Step 4: Clear the npm cache
RUN npm cache clean --force

# Step 5: Install application dependencies
RUN npm install

# Step 6: Copy the rest of your application files
COPY . .

# Step 7: Expose the port that the app will run on
EXPOSE 3000

# Step 8: Define the command to run your application
CMD ["npm", "start"]

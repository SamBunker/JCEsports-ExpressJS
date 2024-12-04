# Step 1: Use an official Node.js runtime as a parent image
FROM node:18-slim

# Step 2: Set the working directory inside the container
WORKDIR ./

# Step 3: Copy package.json and package-lock.json (if present)
COPY package*.json ./

# Step 4: Install application dependencies
RUN npm install

# Step 5: Copy the rest of your application files
COPY . .

# Step 6: Expose the port that the app will run on
EXPOSE 3000

# Step 7: Define the command to run your application
CMD ["npm", "start"]
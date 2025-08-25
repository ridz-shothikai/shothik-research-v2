# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /usr/src/app
ARG PAT_TOKEN
# Copy package.json and package-lock.json to the working directory
COPY package*.json ./


COPY .npmrc.template .npmrc

RUN sed -i "s|\${PAT_TOKEN}|${PAT_TOKEN}|" .npmrc
RUN echo "@ridz-shothikai:registry=https://npm.pkg.github.com" > .npmrc && \
    echo "//npm.pkg.github.com/:_authToken=${PAT_TOKEN}" >> .npmrc && \
    echo "always-auth=true" >> .npmrc

# Install application dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the TypeScript application
RUN npm run build

# Expose the port the app runs on (assuming 3000, common for Node.js apps)
EXPOSE 3040

# Define the command to run the application
CMD [ "npm", "start" ]

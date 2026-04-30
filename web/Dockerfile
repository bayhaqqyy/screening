FROM node:20-alpine

WORKDIR /app

# We use package.json, and install
COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 5173

# Expose on all interfaces to allow access from outside the container
CMD ["npm", "run", "dev", "--", "--host"]

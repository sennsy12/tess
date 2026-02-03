FROM node:20-alpine

# Install build dependencies for native modules like bcrypt
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./

# Install dependencies and rebuild native modules for Alpine Linux
RUN npm install && npm rebuild bcrypt --build-from-source

COPY . .

EXPOSE 5000

CMD ["npm", "run", "dev"]

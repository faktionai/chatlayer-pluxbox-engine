FROM node:12-alpine AS BUILD

RUN apk add --no-cache make gcc g++ python dnsmasq git

WORKDIR /usr/src/app

# Add package.json and install *before* adding application files
COPY package*.json ./

RUN npm i

# Copy all the content to the working directory
COPY . .

RUN npx tsc --build tsconfig.json

CMD ["node", "dist/index.js"]

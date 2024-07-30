FROM node:20

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY . .

ENTRYPOINT ["node"]
CMD ["index.js"]

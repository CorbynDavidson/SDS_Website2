FROM node:24-bookworm-slim
WORKDIR /app
COPY uk-intake/package.json ./package.json
RUN npm install --omit=dev --ignore-scripts && npm cache clean --force
COPY uk-intake/core.mjs uk-intake/repository.mjs uk-intake/server.mjs uk-intake/forms.json ./
USER node
EXPOSE 8080
CMD ["node", "server.mjs"]

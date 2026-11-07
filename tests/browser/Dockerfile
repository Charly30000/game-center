FROM mcr.microsoft.com/playwright:v1.56.1-noble
WORKDIR /qa
RUN npm install --ignore-scripts --no-audit --no-fund playwright@1.56.1 jsqr@1.4.0
COPY tests/browser/ ./
CMD ["node", "smoke.mjs"]

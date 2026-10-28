# SwissS2S: glibc base because the native `sweph` module ships prebuilt Linux (glibc) binaries.
FROM node:20-bookworm-slim
WORKDIR /app
RUN groupadd -r swiss && useradd -r -g swiss swiss
COPY --chown=swiss:swiss package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY --chown=swiss:swiss server.js ./
COPY --chown=swiss:swiss ephe ./ephe
USER swiss
ENV NODE_ENV=production PORT=5100
EXPOSE 5100
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:5100/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["node", "server.js"]

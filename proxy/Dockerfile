FROM node:22-alpine

WORKDIR /app
COPY server.mjs .

ENV PORT=8081
EXPOSE 8081

USER node

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:8081/health || exit 1

CMD ["node", "server.mjs"]

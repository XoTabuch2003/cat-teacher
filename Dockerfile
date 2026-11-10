FROM node:22-slim
WORKDIR /home/node/app
COPY --chown=node:node server.js package.json ./
COPY --chown=node:node public ./public
RUN mkdir -p /home/node/app/data && chown node:node /home/node/app/data
USER node
ENV PORT=7860
EXPOSE 7860
CMD ["node", "server.js"]

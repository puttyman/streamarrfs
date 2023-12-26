FROM node:21-bookworm as base

RUN apt update
RUN apt install fuse libfuse2 libfuse-dev -y
RUN npm install @nestjs/cli -g
RUN mkdir /server
WORKDIR /server

############# testdeps ##########
FROM base as testdeps
COPY ../server /server/
RUN npm ci
RUN npm run build

############# proddeps ##########
FROM base as proddeps
COPY ../server /server/
RUN npm ci --omit=dev
RUN npm run build


############# test ##########
FROM testdeps as test
CMD ["npm", "run", "test"]


############# prod ##########
FROM base as prod
COPY --from=proddeps /server/dist /server/dist
COPY --from=proddeps /server/node_modules /server/node_modules
COPY --from=proddeps /server/*.json /server/
CMD ["npm", "run", "start:prod"]

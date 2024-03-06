FROM node:16-bullseye AS base
LABEL authors="diligence"

RUN apt-get update &&  \
    apt-get install -y build-essential vim less python pip --no-install-recommends && \
    apt-get clean &&  \
    rm -rf /var/lib/apt/lists/* && \
    npm install -g eth-scribble && \
    pip3 install --no-cache-dir diligence-fuzzing

FROM base AS final

ARG code_folder="./"

COPY $code_folder /code
WORKDIR /code

RUN yarn install && \
    yarn cache clean

RUN chmod +x /code/diligence-fuzzing/docker/entrypoint.sh

CMD ["sh", "/code/diligence-fuzzing/docker/entrypoint.sh"]
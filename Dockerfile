FROM node:24-alpine3.21
WORKDIR /app

RUN apk add --no-cache bash jq

COPY package.json package-lock.json /app
RUN npm i --omit=dev --omit=optional --no-audit

COPY . /app
# The executable bit is not guaranteed by the checkout: this repository sets core.fileMode=false, so a Windows
# checkout commits shell scripts as 644 and the container then fails to exec the entrypoint. Setting it here
# makes the image correct regardless of where it was built.
RUN chmod +x /app/docker-entrypoint.sh
RUN date '+%d %B %Y' > BUILD_DATE
ENTRYPOINT ["/app/docker-entrypoint.sh"]

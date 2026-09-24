FROM alpine:3.22.1 AS certs

ARG IRC_COMMIT=79dc8c69f204e93c6cb151d7f9e2f8a8065855b2

RUN apk add --no-cache ca-certificates curl
RUN mkdir -p /out \
    && curl -fsSL "https://raw.githubusercontent.com/Specia1z/warframe-irc-server/${IRC_COMMIT}/cert/cert.pem" -o /out/cert.pem \
    && curl -fsSL "https://raw.githubusercontent.com/Specia1z/warframe-irc-server/${IRC_COMMIT}/cert/key.pem" -o /out/key.pem \
    && cat /out/cert.pem /out/key.pem > /out/irc.pem

FROM haproxy:3.2.23-alpine

COPY haproxy.cfg /usr/local/etc/haproxy/haproxy.cfg
COPY --from=certs /out/irc.pem /usr/local/etc/haproxy/certs/irc.pem

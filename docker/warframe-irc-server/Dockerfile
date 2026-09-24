FROM alpine:3.22.1 AS build

ARG SOUP_COMMIT=98ebf19c58d73ed205dfdcd64d0a607be48b59d2
ARG IRC_COMMIT=79dc8c69f204e93c6cb151d7f9e2f8a8065855b2

RUN apk add --no-cache ca-certificates clang git php

WORKDIR /src
RUN git clone https://github.com/calamity-inc/Soup.git Soup \
    && git -C Soup checkout "$SOUP_COMMIT"
COPY secure-renegotiation-scsv.patch /tmp/secure-renegotiation-scsv.patch
RUN git -C Soup apply --unidiff-zero /tmp/secure-renegotiation-scsv.patch

WORKDIR /src/Soup
RUN rm soup/AnalogueKeyboard.cpp \
    soup/DigitalKeyboard.cpp \
    soup/MathExpr.cpp \
    soup/Keyboard.cpp \
    soup/Window.cpp \
    soup/hwHid.cpp \
    soup/hwGamepad.cpp \
    soup/kbRgbWooting.cpp \
    soup/lyoDocument.cpp \
    soup/netAdaptor.cpp \
    && php build_lib.php

WORKDIR /src
RUN git clone https://github.com/Specia1z/warframe-irc-server.git warframe-irc-server \
    && git -C warframe-irc-server checkout "$IRC_COMMIT"

WORKDIR /src/warframe-irc-server
RUN clang main.cpp \
    -DDOCKER \
    -L/src/Soup \
    -lsoup \
    -I/src/Soup/soup \
    -std=c++20 \
    -lstdc++ \
    -fno-rtti \
    -O3 \
    -o warframe-irc-server

FROM alpine:3.22.1

RUN apk add --no-cache libstdc++
WORKDIR /app
COPY --from=build /src/warframe-irc-server/warframe-irc-server ./warframe-irc-server
COPY --from=build /src/warframe-irc-server/cert ./cert

ENTRYPOINT ["./warframe-irc-server"]

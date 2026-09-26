# syntax=docker/dockerfile:1

# Build stage: compile a fully static binary so the runtime image can be
# distroless. CGO is off — pebble and its deps build pure-Go.
FROM golang:1.26-alpine AS build
WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" \
    -o /out/explorer ./
# Empty data dir to ship in the runtime image (distroless has no shell to
# mkdir there).
RUN mkdir -p /out/data

# Runtime stage: distroless static. No shell, no package manager, runs
# as nonroot. Pebble data lives on a mounted volume via DB_PATH.
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/explorer /explorer
# /data must exist and be owned by nonroot: a fresh named volume copies
# the image's ownership on first mount. Without this the volume is
# root-owned and pebble fails with "mkdir /data/chess: permission denied".
COPY --from=build --chown=nonroot:nonroot /out/data /data
ENV DB_PATH=/data/chess LISTEN_ADDR=:8080
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/explorer"]

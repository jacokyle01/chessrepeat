# syntax=docker/dockerfile:1

# Build stage: compile a fully static binary so the runtime image can be
# distroless. CGO is off because we don't link any C libs.
FROM golang:1.26-alpine AS build
WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" \
    -o /out/chessrepeat ./cmd/server

# Runtime stage: distroless static. No shell, no package manager, runs
# as nonroot. Smaller attack surface than alpine.
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/chessrepeat /chessrepeat
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/chessrepeat"]

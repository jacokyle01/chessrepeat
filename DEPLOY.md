WIP 

## Architecture

```
                          ┌────────────────────────────────────┐
   user ──► Cloudflare ───► chessrepeat.com  (static SPA)      │
   browser    Pages       └────────────────────────────────────┘
              │
              │ fetch + WS to api.chessrepeat.com
              ▼
                          ┌────────────────────────────────────┐
   internet ─────► 443 ───► caddy   (TLS + reverse proxy)      │
                          │   └─ api.example.com → backend:8080│
                          ├────────────────────────────────────┤
                          │ backend  (Go binary)   │
                          │ postgres (pgdata volume)           │
                          └────────────────────────────────────┘
                            all on a single docker network
```


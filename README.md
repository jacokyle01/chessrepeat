# chessrepeat
A website to train chess openings using spaced repetition.

## Prerequisites

- [Node.js](https://nodejs.org/) (v23+)
- [Go](https://go.dev/) (1.26+)
- [MongoDB](https://www.mongodb.com/) running locally or remotely

## Setup

### Backend

```bash
cd backend
```

Create a `.env` file:

```
MONGO_URI=mongodb://localhost:27017
MONGO_DB=chessrepeat
```

Install dependencies and run:

```bash
go mod download
go run .
```

The server starts at `http://localhost:8080`.

### Frontend

```bash
cd frontend
```

Create a `.env` file:

```
VITE_GOOGLE_CLIENT_ID=<your Google OAuth client ID>
```

Install dependencies and run:

```bash
npm install
npm run dev
```

The dev server starts at `http://localhost:5173`.

## Google OAuth

To enable login, create a Google OAuth 2.0 client ID at [console.cloud.google.com](https://console.cloud.google.com/apis/credentials) and set `VITE_GOOGLE_CLIENT_ID` in `frontend/.env`.

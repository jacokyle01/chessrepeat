# chessrepeat

chessrepeat is a free, open source chess opening training platform.

It features real-time, collaborative opening training, move scheduling with spaced repetition, a playground mode
to train without logging in, and an intuitive, functional interface to edit your repertoire and surface 
training progress.

chessrepeat is built with a React + Typescript frontend and Go backend. It makes use of websockets
for real-time, collaborative training and Postgresql for the database. The frontend is served via Cloudflare 
and the backend runs in a Docker container in a OVHcloud VPS served on Nginx. Authentication is handled with
Google Oauth. The frontend leverages chessground for the UI and chessops for chess logic.





![chessrepeat — training a repertoire](docs/images/hero.png)
<!-- placeholder: full-app screenshot showing the board mid-drill with the move tree on the side -->

> The little **(?)** links jump to a longer explanation of that feature further down.

---

## ✨ Features

| | Feature | |
|---|---|---|
| 🌳 | **Build repertoires** — organize openings into chapters, each a branching tree of moves and variations. | [(?)](#-repertoires--chapters) |
| 🧠 | **Spaced-repetition training** — every move you should know becomes a flashcard, scheduled with the FSRS algorithm. | [(?)](#-spaced-repetition) |
| 👥 | **Real-time collaboration** — share a repertoire with `edit` or `train` access; changes sync live over WebSockets. | [(?)](#-collaboration) |
| 📥 | **PGN import / export** — bring lines in from any PGN, or export an *annotated* PGN that round-trips your training data. | [(?)](#-import--export) |
| 🛝 | **Playground mode** — try everything with zero signup; chapters persist locally in your browser. | [(?)](#-playground-mode) |
| 📊 | **Progress insights** — see what's due, forecast upcoming reviews, and visualize memory strength. | [(?)](#-insights) |

---

## Your repertoire

As a user, you can build your repertoire on chessrepeat, which is comprised
of many chapters. All you need to start training is a PGN, or game file, which
you can import and train as either White or Black.

Note that by default you'll be limited to a move limit per-chapter and a chapter
limit per-repertoire. This helps 

---

## 🧠 Spaced Repetition

chessrepeat's scheduling algorithm is a type of spaced repetition algorithm, which 
will schedule moves in increasingly longer review patterns as you get them right. 
Read more about spaced repetition [here](link)

The particular algorithm being used is FSRS, which you can read more about [here](link)


---

## 👥 Collaboration

Invite other users to a repertoire with one of two permission levels:

- *`edit`* — full read/write on chapters, moves, and comments.
- *`train`* — read-only on the repertoire, but can train moves

Invited users can join your repertoire and collaborate with you in real-time — 
you'll see their edits (new moves, comments, deletions) pop up instantly. 


---

## 📥 Import & Export

Import and export to PGNs as well as JSON files. Users can export their repertoire
as a JSON file and re-import it into chessrepeat to keep their training progress.


## 🛝 Playground Mode

If you use chessrepeat without signing in, your moves will be saved locally and
never touch the remote server. Note that without ever backing up your local copy
(by exporting it to a .json file), you run the risk of losing your progress should
you ever clear your browser storage.
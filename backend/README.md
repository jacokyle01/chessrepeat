### run
set DBUSER and DBPASS in .env

```
DBUSER=putuserhere
DBPASS=putpasshere
```

create chessrepeat database and grant created user access

run `source backend/data-access/create-tables.sql` in mysql server

start server

```
./build.sh && ./chessrepeat
```

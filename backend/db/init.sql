create extension if not exists pgcrypto;

create table users (
  id uuid primary key default gen_random_uuid(),
  google_sub text unique not null,
  email text,
  name text,
  picture text,
  created_at timestamptz not null default now()
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index sessions_user on sessions(user_id);
create index sessions_expires on sessions(expires_at);

create table chapters (
  id uuid primary key, -- client-provided chapter.id
  user_id uuid not null references users(id) on delete cascade,

  name text not null,
  train_as text not null,
  last_due_count int not null default 0,
  enabled_count int not null default 0,
  largest_move_id int not null default 0, 

  bucket_entries int[] not null default '{}'::int[],

  revision bigint not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  unique(user_id, id)
);


/*
TODO:
should we still normalize chapter (yes?)
moves id is a number (need to implement this, also chapter will be authority for assigning id)

thus, key will be moves id + chapter id 
also, don't need a lot of these fields 




*/
create table moves (
  chapter_id uuid not null references chapters(id) on delete cascade,

  id  text   not null,   -- string id (client stable key)
  idx bigint not null,   -- numeric id (fast ops / parentId)

  parent_idx bigint null,
  ord int not null default 0,

  fen text not null,
  ply int not null,
  san text not null,
  comment text not null default '',

  disabled boolean not null default false,
  seen boolean not null default false,
  train_group int not null default 0,
  due_at bigint not null default 0,

  primary key (chapter_id, idx),
  unique (chapter_id, id),
  constraint moves_parent_fk
    foreign key (chapter_id, parent_idx)
    references moves (chapter_id, idx)
    on delete cascade
);


create index moves_chapter_parent on moves(chapter_id, parent_id, ord);

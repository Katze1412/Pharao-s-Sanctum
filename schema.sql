-- ============================================================
-- YGO Kartenarchiv — Supabase Schema
-- Diesen kompletten Inhalt im Supabase SQL-Editor ausführen
-- (Dashboard → SQL Editor → New query → einfügen → Run)
-- ============================================================

create extension if not exists pgcrypto;

-- Tabelle: Karten
create table if not exists cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  set_code text,
  card_number text,
  rarity text,
  condition text,
  quantity integer default 1,
  value numeric,
  archetype text,
  box text,
  is_lent boolean default false,
  lent_to text,
  lent_since date,
  sale_status text default 'frei',
  sale_price numeric,
  created_at timestamptz default now()
);

-- Tabelle: Lagerorte
create table if not exists locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

-- Tabelle: Einstellungen (1 Zeile pro Nutzer)
create table if not exists settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  lent_warning_days integer default 30
);

-- Row-Level-Security aktivieren — jeder sieht/bearbeitet nur seine eigenen Daten
alter table cards enable row level security;
alter table locations enable row level security;
alter table settings enable row level security;

create policy "cards_select_own" on cards for select using (auth.uid() = user_id);
create policy "cards_insert_own" on cards for insert with check (auth.uid() = user_id);
create policy "cards_update_own" on cards for update using (auth.uid() = user_id);
create policy "cards_delete_own" on cards for delete using (auth.uid() = user_id);

create policy "locations_select_own" on locations for select using (auth.uid() = user_id);
create policy "locations_insert_own" on locations for insert with check (auth.uid() = user_id);
create policy "locations_delete_own" on locations for delete using (auth.uid() = user_id);

create policy "settings_select_own" on settings for select using (auth.uid() = user_id);
create policy "settings_upsert_own" on settings for insert with check (auth.uid() = user_id);
create policy "settings_update_own" on settings for update using (auth.uid() = user_id);

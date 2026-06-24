-- Kalibra Phase 0 schema: markets, predictions, resolutions.
-- Probabilities and Brier scores are stored in basis points (0..10000) to mirror
-- the on-chain representation exactly and avoid float drift between layers.

create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- markets: a football market Kalibra is tracking (from Polymarket / fixtures).
-- ---------------------------------------------------------------------------
create table if not exists public.markets (
    id              uuid primary key default gen_random_uuid(),
    market_id       text not null unique,          -- on-chain bytes32 hex (0x...)
    source          text not null default 'polymarket',
    source_ref      text,                          -- venue's native id / slug
    event_slug      text,
    home            text not null,
    away            text not null,
    league          text,
    kickoff         timestamptz,
    prob_market_bps integer check (prob_market_bps between 0 and 10000),
    created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- predictions: one model forecast per market + its commit-reveal lifecycle.
-- ---------------------------------------------------------------------------
create table if not exists public.predictions (
    id               uuid primary key default gen_random_uuid(),
    market_id        text not null references public.markets (market_id) on delete cascade,
    prob_bps         integer not null check (prob_bps between 0 and 10000),
    prob_market_bps  integer not null check (prob_market_bps between 0 and 10000),
    edge_bps         integer not null,             -- prob_bps - prob_market_bps (signed)
    model_version    text not null,
    salt             text not null,                -- 0x-prefixed bytes32, kept secret until reveal
    prediction_hash  text not null,                -- keccak256(abi.encode(prob_bps, salt))
    status           text not null default 'pending'
                       check (status in ('pending', 'committed', 'revealed', 'skipped')),
    commit_tx        text,
    committed_at     timestamptz,
    created_at       timestamptz not null default now(),
    unique (market_id)
);

create index if not exists predictions_status_idx on public.predictions (status);

-- ---------------------------------------------------------------------------
-- resolutions: realized outcome + Brier score after a match settles.
-- ---------------------------------------------------------------------------
create table if not exists public.resolutions (
    id           uuid primary key default gen_random_uuid(),
    market_id    text not null references public.markets (market_id) on delete cascade,
    outcome      boolean not null,                 -- true = home win
    brier_bps    integer not null check (brier_bps between 0 and 10000),
    record_tx    text,
    resolved_at  timestamptz not null default now(),
    unique (market_id)
);

-- ---------------------------------------------------------------------------
-- market_overview: dashboard-friendly join of market + prediction + resolution.
-- ---------------------------------------------------------------------------
create or replace view public.market_overview as
select
    m.market_id,
    m.home,
    m.away,
    m.league,
    m.kickoff,
    m.prob_market_bps,
    p.prob_bps        as prob_model_bps,
    p.edge_bps,
    p.status          as commit_status,
    p.commit_tx,
    p.committed_at,
    p.model_version,
    r.outcome,
    r.brier_bps,
    r.resolved_at
from public.markets m
left join public.predictions p on p.market_id = m.market_id
left join public.resolutions r on r.market_id = m.market_id;

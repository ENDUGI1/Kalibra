-- Security model: forecasts are public, but the secret `salt` must not be.
-- Public (anon) access is restricted to the salt-free `market_overview` view;
-- direct table reads and all writes require the service-role key.

alter table public.markets enable row level security;
alter table public.predictions enable row level security;
alter table public.resolutions enable row level security;

-- No anon policies on the base tables → direct anon reads/writes are denied
-- (the predictions table holds `salt`). The security-definer view bypasses RLS
-- using its owner's privileges, so anon only needs SELECT on the view.
revoke select on public.markets from anon, authenticated;
revoke select on public.predictions from anon, authenticated;
revoke select on public.resolutions from anon, authenticated;

grant select on public.market_overview to anon, authenticated;

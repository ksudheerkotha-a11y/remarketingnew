create table if not exists events (
  id             bigint generated always as identity primary key,
  visitor_id     text        not null,
  session_id     text,
  site_id        text,
  source         text        default 'organic',
  event          text        not null,
  url            text,
  path           text,
  referrer       text,
  title          text,
  props          jsonb       default '{}',
  ip             text,
  user_agent     text,
  occurred_at    timestamptz default now()
);

create index if not exists events_visitor_idx  on events (visitor_id);
create index if not exists events_event_idx    on events (event);
create index if not exists events_site_idx     on events (site_id);
create index if not exists events_source_idx   on events (source);
create index if not exists events_occurred_idx on events (occurred_at desc);

alter table events enable row level security;

-- Checkout abandoners (last 7 days)
-- SELECT visitor_id FROM events WHERE event = 'checkout_started'
-- AND visitor_id NOT IN (SELECT visitor_id FROM events WHERE event = 'purchase')
-- AND occurred_at > now() - interval '7 days';

-- Cart abandoners (last 14 days)
-- SELECT visitor_id FROM events WHERE event = 'add_to_cart'
-- AND visitor_id NOT IN (SELECT visitor_id FROM events WHERE event = 'checkout_started')
-- AND occurred_at > now() - interval '14 days';

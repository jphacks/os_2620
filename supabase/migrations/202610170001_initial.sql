create extension if not exists pgcrypto;
create type public.inventory_unit as enum ('g','kg','ml','L','個','本','袋','枚','パック');
create type public.storage_location as enum ('fridge','freezer','pantry','other');
create type public.movement_type as enum ('purchase','consume','adjust','restore','discard');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_budget numeric(12,2) check (daily_budget >= 0), weekly_budget numeric(12,2) check (weekly_budget >= 0), monthly_budget numeric(12,2) check (monthly_budget >= 0),
  fridge_capacity_l numeric(8,2) check (fridge_capacity_l > 0), freezer_capacity_l numeric(8,2) check (freezer_capacity_l > 0),
  shopping_frequency text, cooking_frequency text, max_cooking_minutes integer check (max_cooking_minutes > 0), servings integer not null default 1 check (servings between 1 and 30),
  taste_preferences text[] not null default '{}', disliked_ingredients text[] not null default '{}', allergies text[] not null default '{}', nutrition_goals text[] not null default '{}',
  shopping_priority text, notifications_enabled boolean not null default true, expiry_alert_days integer not null default 3 check (expiry_alert_days between 0 and 30), updated_at timestamptz not null default now()
);
create table public.ingredients (
  id uuid primary key default gen_random_uuid(), canonical_name text not null, category text not null, aliases text[] not null default '{}', is_seasoning boolean not null default false, created_at timestamptz not null default now(), unique(canonical_name)
);
create table public.receipts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  content_hash text not null, store_name text, purchased_at date, total_amount numeric(12,2) check(total_amount >= 0), status text not null default 'pending' check(status in ('pending','confirmed','rejected')),
  amount_mismatch boolean not null default false, created_at timestamptz not null default now(), unique(user_id, content_hash)
);
create table public.receipt_items (
  id uuid primary key default gen_random_uuid(), receipt_id uuid not null references public.receipts(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade,
  ingredient_id uuid references public.ingredients(id), raw_name text not null, normalized_name text not null, quantity numeric(12,3) not null check(quantity > 0), unit public.inventory_unit not null,
  price numeric(12,2) check(price >= 0), category text not null, confidence numeric(4,3) check(confidence between 0 and 1), confirmed boolean not null default false
);
create table public.inventory_lots (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, ingredient_id uuid not null references public.ingredients(id), receipt_item_id uuid references public.receipt_items(id),
  quantity numeric(12,3) not null check(quantity >= 0), initial_quantity numeric(12,3) not null check(initial_quantity > 0), unit public.inventory_unit not null,
  purchased_at date not null default current_date, expires_at date, expiry_type text not null default 'unset' check(expiry_type in ('best_before','use_by','unset')),
  storage public.storage_location not null, purchase_price numeric(12,2) check(purchase_price >= 0), opened boolean not null default false, notes text check(char_length(notes) <= 1000),
  depleted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.recipes (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade, name text not null, description text, instructions jsonb not null default '[]', cook_minutes integer not null check(cook_minutes > 0), servings integer not null check(servings > 0),
  source text not null default 'user' check(source in ('internal','user','gemini')), favorite boolean not null default false, taste_tags text[] not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(), recipe_id uuid not null references public.recipes(id) on delete cascade, ingredient_id uuid not null references public.ingredients(id), quantity numeric(12,3) not null check(quantity > 0), unit public.inventory_unit not null, optional boolean not null default false, substitute_notes text
);
create table public.cooking_history (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, recipe_id uuid references public.recipes(id) on delete set null,
  idempotency_key text not null, planned_servings integer not null check(planned_servings > 0), cooked_at timestamptz not null default now(), undone_at timestamptz, unique(user_id,idempotency_key)
);
create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, lot_id uuid not null references public.inventory_lots(id), cooking_history_id uuid references public.cooking_history(id),
  type public.movement_type not null, quantity numeric(12,3) not null check(quantity > 0), unit public.inventory_unit not null, occurred_at timestamptz not null default now(), notes text
);
create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, name text not null default '買い物リスト', active boolean not null default true, created_at timestamptz not null default now()
);
create table public.shopping_list_items (
  id uuid primary key default gen_random_uuid(), shopping_list_id uuid not null references public.shopping_lists(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade,
  ingredient_id uuid references public.ingredients(id), name text not null, required_quantity numeric(12,3) check(required_quantity > 0), unit public.inventory_unit, source_recipe_id uuid references public.recipes(id), purchased boolean not null default false, stocked_receipt_item_id uuid references public.receipt_items(id), created_at timestamptz not null default now()
);
create table public.food_waste_events (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, lot_id uuid references public.inventory_lots(id) on delete set null,
  quantity numeric(12,3) not null check(quantity > 0), unit public.inventory_unit not null, reason text, estimated_cost numeric(12,2) check(estimated_cost >= 0), recorded_at timestamptz not null default now()
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, kind text not null, title text not null, body text not null, read_at timestamptz, created_at timestamptz not null default now()
);

create index inventory_lots_user_expiry on public.inventory_lots(user_id, expires_at) where quantity > 0;
create index inventory_lots_user_ingredient on public.inventory_lots(user_id, ingredient_id);
create index movements_user_time on public.inventory_movements(user_id, occurred_at desc);
create index receipts_user_purchase on public.receipts(user_id, purchased_at desc);
create index recipes_user_updated on public.recipes(user_id, updated_at desc);
create index shopping_items_user_open on public.shopping_list_items(user_id, purchased) where purchased = false;

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.receipts enable row level security;
alter table public.receipt_items enable row level security;
alter table public.inventory_lots enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.cooking_history enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.shopping_list_items enable row level security;
alter table public.food_waste_events enable row level security;
alter table public.notifications enable row level security;
alter table public.ingredients enable row level security;

create policy "profiles own" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "preferences own" on public.user_preferences for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "receipts own" on public.receipts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "receipt_items own" on public.receipt_items for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "lots own" on public.inventory_lots for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "movements own" on public.inventory_movements for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "recipes visible" on public.recipes for select using (user_id = auth.uid() or user_id is null);
create policy "recipes own write" on public.recipes for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "recipe ingredients visible" on public.recipe_ingredients for select using (exists(select 1 from public.recipes r where r.id=recipe_id and (r.user_id=auth.uid() or r.user_id is null)));
create policy "history own" on public.cooking_history for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "shopping lists own" on public.shopping_lists for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "shopping items own" on public.shopping_list_items for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "waste own" on public.food_waste_events for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications own" on public.notifications for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ingredients readable" on public.ingredients for select to authenticated using (true);

create or replace function public.consume_inventory(p_recipe_id uuid, p_idempotency_key text, p_servings integer, p_usage jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_history uuid; v_item jsonb; v_lot public.inventory_lots%rowtype; v_qty numeric;
begin
  if p_servings <= 0 then raise exception 'invalid servings'; end if;
  select id into v_history from public.cooking_history where user_id=auth.uid() and idempotency_key=p_idempotency_key;
  if v_history is not null then return v_history; end if;
  insert into public.cooking_history(user_id,recipe_id,idempotency_key,planned_servings) values(auth.uid(),p_recipe_id,p_idempotency_key,p_servings) returning id into v_history;
  for v_item in select * from jsonb_array_elements(p_usage) loop
    v_qty := (v_item->>'quantity')::numeric;
    select * into v_lot from public.inventory_lots where id=(v_item->>'lot_id')::uuid and user_id=auth.uid() for update;
    if not found or v_qty <= 0 or v_lot.quantity < v_qty then raise exception 'insufficient inventory'; end if;
    update public.inventory_lots set quantity=quantity-v_qty, depleted_at=case when quantity-v_qty=0 then now() else null end, updated_at=now() where id=v_lot.id;
    insert into public.inventory_movements(user_id,lot_id,cooking_history_id,type,quantity,unit) values(auth.uid(),v_lot.id,v_history,'consume',v_qty,v_lot.unit);
  end loop;
  return v_history;
end $$;

create or replace function public.undo_cooking(p_history_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare v_move public.inventory_movements%rowtype;
begin
  if not exists(select 1 from public.cooking_history where id=p_history_id and user_id=auth.uid() and undone_at is null for update) then raise exception 'not found or already undone'; end if;
  for v_move in select * from public.inventory_movements where cooking_history_id=p_history_id and user_id=auth.uid() and type='consume' for update loop
    update public.inventory_lots set quantity=quantity+v_move.quantity,depleted_at=null,updated_at=now() where id=v_move.lot_id and user_id=auth.uid();
    insert into public.inventory_movements(user_id,lot_id,cooking_history_id,type,quantity,unit,notes) values(auth.uid(),v_move.lot_id,p_history_id,'restore',v_move.quantity,v_move.unit,'cooking undo');
  end loop;
  update public.cooking_history set undone_at=now() where id=p_history_id;
end $$;

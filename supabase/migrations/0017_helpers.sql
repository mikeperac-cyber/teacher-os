-- Small helpers used by server actions.

-- Increment a material's use_count safely.
create or replace function public.increment_material_use(p_material_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.materials m where m.id = p_material_id and private.is_workspace_staff(m.workspace_id)) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  update public.materials set use_count = use_count + 1, updated_at = now() where id = p_material_id;
end;
$$;

grant execute on function public.increment_material_use(uuid) to authenticated;

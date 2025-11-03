-- Compat layer: add columns expected by API controllers to public.pre_cadastros
-- Keeps existing richer model intact; adds alias columns used by current routes

alter table if exists public.pre_cadastros
  add column if not exists empreendimento text,
  add column if not exists renda_mensal numeric(15,2),
  add column if not exists renda_familiar numeric(15,2),
  add column if not exists prestacao_valor numeric(15,2),
  add column if not exists avaliacao_valor numeric(15,2),
  add column if not exists aprovado_valor numeric(15,2),
  add column if not exists subsidio_valor numeric(15,2),
  add column if not exists fgts_valor numeric(15,2),
  add column if not exists vencimento_aprovacao date;

-- Optional: simple fill defaults from richer columns when possible
do $blk$
begin
  -- Only best-effort updates; ignore errors if columns absent
  begin update public.pre_cadastros set avaliacao_valor = valor_avaliacao where avaliacao_valor is null; exception when undefined_column then null; end;
  begin update public.pre_cadastros set aprovado_valor = valor_aprovado where aprovado_valor is null; exception when undefined_column then null; end;
  begin update public.pre_cadastros set subsidio_valor = valor_subsidio where subsidio_valor is null; exception when undefined_column then null; end;
  begin update public.pre_cadastros set fgts_valor = valor_fgts where fgts_valor is null; exception when undefined_column then null; end;
  begin update public.pre_cadastros set prestacao_valor = valor_prestacao where prestacao_valor is null; exception when undefined_column then null; end;
  begin update public.pre_cadastros set vencimento_aprovacao = data_vencimento_aprovacao where vencimento_aprovacao is null; exception when undefined_column then null; end;
  begin update public.pre_cadastros set renda_mensal = renda_mensal_bruta where renda_mensal is null; exception when undefined_column then null; end;
  begin update public.pre_cadastros set renda_familiar = renda_familiar_bruta where renda_familiar is null; exception when undefined_column then null; end;
end
$blk$ language plpgsql;


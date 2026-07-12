-- AUDITVIEW · CORREÇÃO: grupo Financeiras (cole TUDO e clique RUN)
-- "Juros e Encargos" (juro + encarg) e "Tarifas Bancárias" (plural) estavam
-- caindo em Pessoal/Admin e Departamentais. Financeiras passa a ser avaliado
-- primeiro, com regex que casa o plural. Determinístico e transparente.

create or replace function app.classify_category(p_name text) returns text
language sql immutable as $$
  select case
    when p_name is null then 'Departamentais'
    when lower(p_name) ~ '(juro|tarifas? banc|iof|multa|desconto conced|encargos financ|emprest|financiamento)' then 'Financeiras'
    when lower(p_name) ~ '(sal[aá]rio|ordenado|inss|fgts|f[eé]rias|13|d[eé]cimo|pr[oó]-?labore|encarg|indeniza|aviso pr[eé]vio|hora extra|benef[ií]cio|vale|plano de sa[uú]de|rescis)' then 'Pessoal/Admin'
    else 'Departamentais'
  end
$$;

-- Allow users to delete their final category. Preserve all other validation.
do $$
declare definition text;
begin
  definition := pg_get_functiondef('peakh_private.valid_state(jsonb)'::regprocedure);
  if position('jsonb_array_length(s->''activities'') not between 1 and 100' in definition) > 0 then
    execute replace(definition, 'jsonb_array_length(s->''activities'') not between 1 and 100', 'jsonb_array_length(s->''activities'') not between 0 and 100');
  elsif position('jsonb_array_length(s->''activities'') not between 0 and 100' in definition) = 0 then
    raise exception 'Unexpected valid_state definition; migration not applied';
  end if;
end $$;

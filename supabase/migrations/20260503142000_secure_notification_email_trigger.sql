create or replace function public.send_notification_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  supabase_url text;
  anon_key text;
  webhook_secret text;
  payload jsonb;
begin
  select decrypted_secret into supabase_url
  from vault.decrypted_secrets
  where name = 'SUPABASE_URL'
  limit 1;

  select decrypted_secret into anon_key
  from vault.decrypted_secrets
  where name = 'SUPABASE_ANON_KEY'
  limit 1;

  select decrypted_secret into webhook_secret
  from vault.decrypted_secrets
  where name = 'NOTIFICATION_WEBHOOK_SECRET'
  limit 1;

  if supabase_url is null or anon_key is null or webhook_secret is null then
    raise warning 'Missing SUPABASE_URL, SUPABASE_ANON_KEY, or NOTIFICATION_WEBHOOK_SECRET secret for send_notification_email trigger';
    return new;
  end if;

  payload := jsonb_build_object('record', row_to_json(new));

  begin
    perform net.http_post(
      url := supabase_url || '/functions/v1/send-notification-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key,
        'x-internal-webhook-secret', webhook_secret
      ),
      body := payload
    );
  exception when others then
    raise warning 'Failed to send notification email: %', sqlerrm;
  end;

  return new;
end;
$function$;

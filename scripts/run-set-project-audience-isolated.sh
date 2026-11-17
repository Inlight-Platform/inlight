#!/usr/bin/env bash
# Inspection only. Do not add setup or test execution until startup inventory
# has been independently reviewed. This leaves the container in place.
set -euo pipefail

image='sha256:3866d94d8426927e8db3f1c5d790752292bfbe27b5f1f46e199ae1b7d3c1710b'
name="inlight-audience-inspect-$(date -u +%Y%m%d%H%M%S)-$$"
actual_image=$(docker image inspect --format '{{.Id}}' "$image")
[[ "$actual_image" == "$image" ]] || { echo 'Image identity mismatch' >&2; exit 1; }
if docker container inspect "$name" >/dev/null 2>&1; then
  echo 'Container name collision; nothing reused' >&2; exit 1
fi
id=$(docker create --pull never --name "$name" --user postgres --env POSTGRES_HOST_AUTH_METHOD=trust --network none --cap-drop ALL --security-opt no-new-privileges "$image")
printf 'Created container: %s\nName: %s\nImage: %s\n' "$id" "$name" "$image"
check_isolation() {
  local expected_state=$1
  docker inspect "$id" | python3 -c '
import json, sys

expected_id, expected_image, expected_state = sys.argv[1:]
try:
    items = json.load(sys.stdin)
    if not isinstance(items, list) or len(items) != 1:
        raise ValueError("expected one container")
    obj = items[0]
    host = obj["HostConfig"]
    state = obj["State"]
    config = obj["Config"]
    if (obj["Id"] != expected_id or obj["Image"] != expected_image
            or state["Status"] != expected_state
            or host["NetworkMode"] != "none" or host["Privileged"] is not False):
        raise ValueError("identity, state or isolation mismatch")
    if host["CapAdd"] not in (None, []):
        raise ValueError("added capabilities")
    if host["CapDrop"] != ["ALL"]:
        raise ValueError("capability drop is not exactly ALL")
    if obj["Mounts"] not in (None, []):
        raise ValueError("mounts present")
    if host["PortBindings"] not in (None, {}):
        raise ValueError("port bindings present")
    if config["User"] != "postgres":
        raise ValueError("container user mismatch")
    environment = config["Env"]
    if not isinstance(environment, list):
        raise ValueError("invalid initialization environment")
    variables = {}
    for entry in environment:
        if not isinstance(entry, str) or "=" not in entry:
            raise ValueError("invalid initialization environment")
        key, value = entry.split("=", 1)
        if not key or key in variables:
            raise ValueError("invalid or duplicate initialization variable")
        variables[key] = value
    if (variables.get("POSTGRES_HOST_AUTH_METHOD") != "trust"
            or "POSTGRES_PASSWORD" in variables
            or "POSTGRES_PASSWORD_FILE" in variables):
        raise ValueError("initialization authentication configuration mismatch")
    options = host["SecurityOpt"]
    if (not isinstance(options, list) or not options
            or not all(isinstance(option, str) and option in
                       ("no-new-privileges", "no-new-privileges:true") for option in options)):
        raise ValueError("security options missing or unrecognized")
except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
    print("Container inspection failed closed: " + str(exc), file=sys.stderr)
    sys.exit(1)
print("Container identity, state and isolation verified: " + expected_id + " " + expected_state)
' "$id" "$image" "$expected_state"
}
check_isolation created
printf 'Initialization is configured to use trust only inside this disposable isolated container; runtime authentication and startup are not established by this setting.\n'
docker start "$id" >/dev/null
check_isolation running
ready=false
for ((attempt=0; attempt<60; attempt++)); do
  if docker exec "$id" pg_isready -q -h /var/run/postgresql -U postgres -d postgres; then ready=true; break; fi
  sleep 1
done
[[ "$ready" == true ]] || { echo 'Database did not become ready; container retained' >&2; exit 1; }
check_isolation running
printf '\nStartup inventory (read-only):\n'
docker exec -i "$id" psql -X -w -U postgres -h /var/run/postgresql -d postgres -v ON_ERROR_STOP=1 <<'SQL'
BEGIN READ ONLY;
SELECT current_database(), current_user, session_user, pg_catalog.version() AS server_version;
SELECT extname, extversion, extnamespace::regnamespace AS schema FROM pg_catalog.pg_extension ORDER BY extname;
SELECT e.evtname, e.evtevent, e.evtenabled, e.evttags, p.oid::regprocedure AS function,
       pg_catalog.pg_get_userbyid(p.proowner) AS owner, pg_catalog.md5(pg_catalog.pg_get_functiondef(p.oid)) AS definition_md5
FROM pg_catalog.pg_event_trigger e JOIN pg_catalog.pg_proc p ON p.oid=e.evtfoid ORDER BY e.evtname;
SELECT n.nspname AS schema, c.relname AS relation, t.tgname, t.tgenabled,
       t.tgisinternal, t.tgtype, t.tgnargs, p.oid::regprocedure AS function,
       pg_catalog.pg_get_userbyid(p.proowner) AS owner,
       pg_catalog.md5(pg_catalog.pg_get_triggerdef(t.oid, true)) AS definition_md5
FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid
ORDER BY n.nspname,c.relname,t.tgname;
ROLLBACK;
SQL
printf '\nInspection complete. No setup or tests were run. Container remains running: %s\n' "$id"

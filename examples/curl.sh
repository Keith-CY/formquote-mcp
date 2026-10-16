#!/bin/sh
# Talk to the Formquote MCP server with plain HTTP (JSON-RPC over Streamable HTTP).
# No key, no session: every request stands alone.
set -eu
URL=${URL:-https://formquote-mcp.chen-yu-d1.workers.dev/mcp}
call() {
  curl -s "$URL" \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json, text/event-stream' \
    -H 'MCP-Protocol-Version: 2025-06-18' \
    -d "$1"
  echo
}

# The tools and their input schemas
call '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'

# Email verification for 25,000 addresses, counting 5,000 Reoon credits already held
call '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"compare_email_verification_prices","arguments":{"emails":25000,"existing_credits":{"reoon":5000}}}}'

# Sound effect packs for interface sounds, two seats, commercial work
call '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"compare_sound_effects_licenses","arguments":{"intent":"ui","seats":2}}}'

# A web font for one site with 50,000 pageviews a month, for two years
call '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"compare_font_licenses","arguments":{"license_use":"web","monthly_pageviews":50000,"term_years":2,"medium":"website"}}}'

# Everything Formquote lists, with checked dates
call '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"list_formquote_catalog","arguments":{"lang":"en"}}}'

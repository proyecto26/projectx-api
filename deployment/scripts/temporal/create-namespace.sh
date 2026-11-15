#!/bin/sh
# Creates the Temporal namespace the api uses and registers its custom search attributes.
#
# Environment:
#   TEMPORAL_ADDRESS              host:port of the Temporal frontend (default temporal:7233)
#   TEMPORAL_NAMESPACE            namespace to create (default "default")
#   TEMPORAL_NAMESPACE_RETENTION  workflow history retention for a new namespace (default 72h)
#   TEMPORAL_SEARCH_ATTRIBUTES    extra search attributes, "Name:Type,Name:Type"
#                                 (types: Keyword, Text, Int, Double, Bool, Datetime, KeywordList)
#
# The Email search attribute (Keyword) is always registered: the login workflow is started with it.
# Anything that already exists counts as success; any other error exits non-zero so that
# `docker compose` does not start the api against a half-provisioned server.
set -eu

TEMPORAL_ADDRESS=${TEMPORAL_ADDRESS:-temporal:7233}
NAMESPACE=${TEMPORAL_NAMESPACE:-default}
RETENTION=${TEMPORAL_NAMESPACE_RETENTION:-72h}
SEARCH_ATTRIBUTES="Email:Keyword${TEMPORAL_SEARCH_ATTRIBUTES:+,$TEMPORAL_SEARCH_ATTRIBUTES}"
MAX_ATTEMPTS=${TEMPORAL_SETUP_MAX_ATTEMPTS:-60}
RETRY_DELAY=${TEMPORAL_SETUP_RETRY_DELAY:-5}

export TEMPORAL_ADDRESS

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

echo "Waiting for Temporal at $TEMPORAL_ADDRESS to be healthy..."
attempt=0
until temporal operator cluster health >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  [ "$attempt" -ge "$MAX_ATTEMPTS" ] && fail "Temporal did not become healthy after $MAX_ATTEMPTS attempts"
  echo "Temporal not ready yet (attempt $attempt/$MAX_ATTEMPTS)"
  sleep "$RETRY_DELAY"
done
echo "Temporal is healthy"

# Namespace
if output=$(temporal operator namespace describe --namespace "$NAMESPACE" 2>&1); then
  echo "Namespace '$NAMESPACE' already exists"
else
  case "$output" in
    *[Nn]ot\ found* | *NotFound*) ;;
    *) fail "could not describe namespace '$NAMESPACE': $output" ;;
  esac
  echo "Creating namespace '$NAMESPACE' (retention $RETENTION)..."
  if output=$(temporal operator namespace create --namespace "$NAMESPACE" --retention "$RETENTION" 2>&1); then
    echo "Namespace '$NAMESPACE' created"
  else
    case "$output" in
      *[Aa]lready\ exists* | *AlreadyExists*) echo "Namespace '$NAMESPACE' already exists" ;;
      *) fail "could not create namespace '$NAMESPACE': $output" ;;
    esac
  fi
fi

# Search attributes. A namespace that was just created can take a few seconds to reach
# every frontend cache, so "namespace not found" is retried; everything else is final.
create_search_attribute() {
  name=$1
  type=$2
  attempt=0
  while :; do
    if output=$(temporal operator search-attribute create --namespace "$NAMESPACE" --name "$name" --type "$type" 2>&1); then
      echo "Search attribute $name ($type) registered"
      return 0
    fi
    case "$output" in
      *[Dd]ifferent\ type*)
        fail "search attribute $name is already registered with another type, wanted $type: $output"
        ;;
      *[Aa]lready\ exists* | *AlreadyExists*)
        echo "Search attribute $name already exists"
        return 0
        ;;
      *[Nn]amespace*[Nn]ot\ found* | *NamespaceNotFound*)
        attempt=$((attempt + 1))
        [ "$attempt" -ge "$MAX_ATTEMPTS" ] && fail "namespace '$NAMESPACE' still not found while registering $name: $output"
        echo "Namespace '$NAMESPACE' not visible yet, retrying $name (attempt $attempt/$MAX_ATTEMPTS)"
        sleep "$RETRY_DELAY"
        ;;
      *) fail "could not register search attribute $name ($type): $output" ;;
    esac
  done
}

old_ifs=$IFS
IFS=','
set -f
# shellcheck disable=SC2086 # split on commas on purpose
set -- $SEARCH_ATTRIBUTES
set +f
IFS=$old_ifs

for entry in "$@"; do
  # Trim surrounding whitespace
  entry=$(echo "$entry" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  [ -z "$entry" ] && continue
  name=${entry%%:*}
  type=${entry#*:}
  if [ -z "$name" ] || [ "$name" = "$entry" ] || [ -z "$type" ]; then
    fail "invalid entry '$entry' in TEMPORAL_SEARCH_ATTRIBUTES, expected Name:Type"
  fi
  create_search_attribute "$name" "$type"
done

echo "Temporal namespace '$NAMESPACE' is ready"

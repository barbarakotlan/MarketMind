from __future__ import annotations

import argparse
import os
import sys
from datetime import date, datetime, timezone

from api_public import build_api_key_hash, generate_marketmind_developer_api_key
from user_state_store import (
    create_public_api_client,
    create_public_api_key,
    ensure_database_ready,
    get_public_api_client,
    get_public_api_key,
    list_public_api_clients,
    list_public_api_daily_usage,
    list_public_api_keys,
    session_scope,
    set_public_api_key_status,
)


def _database_url() -> str:
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise SystemExit("DATABASE_URL is required.")
    return database_url


def _pepper() -> str:
    pepper = os.getenv("PUBLIC_API_KEY_HASH_PEPPER", "").strip()
    if not pepper:
        raise SystemExit("PUBLIC_API_KEY_HASH_PEPPER is required for key issuance and rotation.")
    return pepper


def _parse_datetime(value: str | None):
    if not value:
        return None
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _print_client(client) -> None:
    print(f"client_id={client.id} name={client.name} status={client.status} email={client.contact_email or '-'} created_at={client.created_at.isoformat()}")


def _print_key(key) -> None:
    print(
        "key_id={id} client_id={client_id} prefix={prefix} status={status} label={label} expires_at={expires_at} last_used_at={last_used_at}".format(
            id=key.id,
            client_id=key.client_id,
            prefix=key.key_prefix,
            status=key.status,
            label=key.label or "-",
            expires_at=key.expires_at.isoformat() if key.expires_at else "-",
            last_used_at=key.last_used_at.isoformat() if key.last_used_at else "-",
        )
    )


def command_create_client(args) -> int:
    database_url = _database_url()
    ensure_database_ready(database_url)
    with session_scope(database_url) as session:
        client = create_public_api_client(
            session,
            name=args.name,
            contact_email=args.contact_email,
            notes=args.notes,
            status=args.status,
        )
        session.flush()
        _print_client(client)
    return 0


def command_list_clients(_args) -> int:
    database_url = _database_url()
    ensure_database_ready(database_url)
    with session_scope(database_url) as session:
        for client in list_public_api_clients(session):
            _print_client(client)
    return 0


def command_issue_key(args) -> int:
    database_url = _database_url()
    pepper = _pepper()
    ensure_database_ready(database_url)
    with session_scope(database_url) as session:
        client = get_public_api_client(session, args.client_id)
        if client is None:
            raise SystemExit(f"Unknown client_id: {args.client_id}")

        for _ in range(8):
            key_prefix, plaintext_key = generate_marketmind_developer_api_key()
            if not any(existing.key_prefix == key_prefix for existing in list_public_api_keys(session)):
                break
        else:
            raise SystemExit("Failed to generate a unique key prefix.")

        api_key = create_public_api_key(
            session,
            client_id=client.id,
            key_prefix=key_prefix,
            key_hash=build_api_key_hash(plaintext_key, pepper),
            label=args.label,
            status="active",
            expires_at=_parse_datetime(args.expires_at),
        )
        session.flush()
        print(f"client_id={client.id}")
        print(f"key_id={api_key.id}")
        print(f"key_prefix={api_key.key_prefix}")
        print(f"api_key={plaintext_key}")
    return 0


def command_list_keys(args) -> int:
    database_url = _database_url()
    ensure_database_ready(database_url)
    with session_scope(database_url) as session:
        for key in list_public_api_keys(session, client_id=args.client_id):
            _print_key(key)
    return 0


def command_revoke_key(args) -> int:
    database_url = _database_url()
    ensure_database_ready(database_url)
    with session_scope(database_url) as session:
        key = get_public_api_key(session, args.key_id)
        if key is None:
            raise SystemExit(f"Unknown key_id: {args.key_id}")
        set_public_api_key_status(session, key.id, args.status)
        session.flush()
        _print_key(key)
    return 0


def command_rotate_key(args) -> int:
    database_url = _database_url()
    pepper = _pepper()
    ensure_database_ready(database_url)
    with session_scope(database_url) as session:
        old_key = get_public_api_key(session, args.key_id)
        if old_key is None:
            raise SystemExit(f"Unknown key_id: {args.key_id}")
        set_public_api_key_status(session, old_key.id, "revoked")

        for _ in range(8):
            key_prefix, plaintext_key = generate_marketmind_developer_api_key()
            if not any(existing.key_prefix == key_prefix for existing in list_public_api_keys(session)):
                break
        else:
            raise SystemExit("Failed to generate a unique key prefix.")

        new_key = create_public_api_key(
            session,
            client_id=old_key.client_id,
            key_prefix=key_prefix,
            key_hash=build_api_key_hash(plaintext_key, pepper),
            label=args.label or old_key.label,
            status="active",
            expires_at=_parse_datetime(args.expires_at) or old_key.expires_at,
        )
        session.flush()
        print(f"revoked_key_id={old_key.id}")
        print(f"new_key_id={new_key.id}")
        print(f"new_key_prefix={new_key.key_prefix}")
        print(f"api_key={plaintext_key}")
    return 0


def command_usage(args) -> int:
    database_url = _database_url()
    ensure_database_ready(database_url)
    day_value = date.fromisoformat(args.day) if args.day else None
    with session_scope(database_url) as session:
        rows = list_public_api_daily_usage(session, client_id=args.client_id, day_value=day_value)
        for row in rows:
            print(
                "day={day} client_id={client_id} key_id={key_id} route_group={route_group} requests={request_count} cached={cached_request_count}".format(
                    day=row.day.isoformat(),
                    client_id=row.client_id,
                    key_id=row.api_key_id,
                    route_group=row.route_group,
                    request_count=row.request_count,
                    cached_request_count=row.cached_request_count,
                )
            )
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="MarketMind Public API admin CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    create_client = subparsers.add_parser("create-client", help="Create a public API client")
    create_client.add_argument("name")
    create_client.add_argument("--contact-email")
    create_client.add_argument("--notes")
    create_client.add_argument("--status", default="active")
    create_client.set_defaults(func=command_create_client)

    list_clients = subparsers.add_parser("list-clients", help="List public API clients")
    list_clients.set_defaults(func=command_list_clients)

    issue_key = subparsers.add_parser("issue-key", help="Issue a new API key")
    issue_key.add_argument("client_id")
    issue_key.add_argument("--label")
    issue_key.add_argument("--expires-at", help="ISO 8601 timestamp")
    issue_key.set_defaults(func=command_issue_key)

    list_keys = subparsers.add_parser("list-keys", help="List API keys")
    list_keys.add_argument("--client-id")
    list_keys.set_defaults(func=command_list_keys)

    revoke_key = subparsers.add_parser("revoke-key", help="Revoke or disable an API key")
    revoke_key.add_argument("key_id")
    revoke_key.add_argument("--status", choices=["revoked", "disabled"], default="revoked")
    revoke_key.set_defaults(func=command_revoke_key)

    rotate_key = subparsers.add_parser("rotate-key", help="Rotate an API key")
    rotate_key.add_argument("key_id")
    rotate_key.add_argument("--label")
    rotate_key.add_argument("--expires-at", help="ISO 8601 timestamp")
    rotate_key.set_defaults(func=command_rotate_key)

    usage = subparsers.add_parser("usage", help="Inspect daily usage")
    usage.add_argument("--client-id")
    usage.add_argument("--day", help="YYYY-MM-DD")
    usage.set_defaults(func=command_usage)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

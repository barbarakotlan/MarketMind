from __future__ import annotations

import difflib
import importlib
import os
import re
import time
from threading import RLock
from typing import Any, Dict, List, Optional


LIST_CACHE_TTL_SECONDS = 15 * 60
DETAIL_CACHE_TTL_SECONDS = 60 * 60
INSIDER_CACHE_TTL_SECONDS = 15 * 60
OWNERSHIP_CACHE_TTL_SECONDS = 15 * 60
CHANGE_CACHE_TTL_SECONDS = 15 * 60

RELEVANT_FORMS = {
    "10-K",
    "10-K/A",
    "10-Q",
    "10-Q/A",
    "8-K",
    "DEF 14A",
    "S-1",
    "20-F",
    "6-K",
}

ANNUAL_OR_QUARTERLY_FORMS = {
    "10-K",
    "10-K/A",
    "10-Q",
    "10-Q/A",
    "20-F",
}

INSIDER_FORMS = {
    "4",
    "4/A",
    "5",
    "5/A",
}

BENEFICIAL_OWNERSHIP_FORMS = {
    "SC 13D",
    "SC 13D/A",
    "SC 13G",
    "SC 13G/A",
    "SCHEDULE 13D",
    "SCHEDULE 13D/A",
    "SCHEDULE 13G",
    "SCHEDULE 13G/A",
}

SECTION_FORM_SPECS = {
    "10-K": [
        ("business", "Business", ("business",)),
        ("riskFactors", "Risk Factors", ("risk_factors",)),
        ("managementDiscussion", "Management's Discussion", ("management_discussion",)),
    ],
    "10-K/A": [
        ("business", "Business", ("business",)),
        ("riskFactors", "Risk Factors", ("risk_factors",)),
        ("managementDiscussion", "Management's Discussion", ("management_discussion",)),
    ],
    "20-F": [
        ("business", "Business", ("business",)),
        ("riskFactors", "Risk Factors", ("risk_factors",)),
        ("managementDiscussion", "Management's Discussion", ("management_discussion",)),
    ],
    "10-Q": [
        ("managementDiscussion", "Management's Discussion", ("management_discussion",)),
        ("riskFactors", "Risk Factors", ("risk_factors",)),
    ],
    "10-Q/A": [
        ("managementDiscussion", "Management's Discussion", ("management_discussion",)),
        ("riskFactors", "Risk Factors", ("risk_factors",)),
    ],
}

FORM_DESCRIPTION_FALLBACKS = {
    "4": "Insider transaction report",
    "4/A": "Amended insider transaction report",
    "5": "Annual insider transaction report",
    "5/A": "Amended annual insider transaction report",
    "10-K": "Annual report",
    "10-K/A": "Amended annual report",
    "10-Q": "Quarterly report",
    "10-Q/A": "Amended quarterly report",
    "8-K": "Current report",
    "DEF 14A": "Proxy statement",
    "S-1": "Registration statement",
    "20-F": "Foreign annual report",
    "6-K": "Foreign current report",
    "SC 13D": "Active beneficial ownership report",
    "SC 13D/A": "Amended active beneficial ownership report",
    "SC 13G": "Passive beneficial ownership report",
    "SC 13G/A": "Amended passive beneficial ownership report",
    "SCHEDULE 13D": "Active beneficial ownership report",
    "SCHEDULE 13D/A": "Amended active beneficial ownership report",
    "SCHEDULE 13G": "Passive beneficial ownership report",
    "SCHEDULE 13G/A": "Amended passive beneficial ownership report",
}

_CACHE_LOCK = RLock()
_LIST_CACHE: Dict[tuple[str, int], tuple[float, List[Dict[str, Any]]]] = {}
_DETAIL_CACHE: Dict[tuple[str, str, int], tuple[float, Dict[str, Any]]] = {}
_INSIDER_CACHE: Dict[tuple[str, int], tuple[float, List[Dict[str, Any]]]] = {}
_OWNERSHIP_CACHE: Dict[tuple[str, int], tuple[float, List[Dict[str, Any]]]] = {}
_CHANGE_CACHE: Dict[tuple[str, int], tuple[float, Optional[Dict[str, Any]]]] = {}
_EDGAR_RUNTIME_LOCK = RLock()
_EDGAR_RUNTIME_MODULE = None
_EDGAR_RUNTIME_IDENTITY = None


class SecFilingsError(Exception):
    status_code = 500


class SecFilingsUnavailableError(SecFilingsError):
    status_code = 503


class SecFilingNotFoundError(SecFilingsError):
    status_code = 404


def reset_sec_filings_runtime_state() -> None:
    global _EDGAR_RUNTIME_MODULE, _EDGAR_RUNTIME_IDENTITY
    with _CACHE_LOCK:
        _LIST_CACHE.clear()
        _DETAIL_CACHE.clear()
        _INSIDER_CACHE.clear()
        _OWNERSHIP_CACHE.clear()
        _CHANGE_CACHE.clear()
    with _EDGAR_RUNTIME_LOCK:
        _EDGAR_RUNTIME_MODULE = None
        _EDGAR_RUNTIME_IDENTITY = None


def _cache_get(cache: Dict[Any, tuple[float, Any]], key: Any) -> Any | None:
    now = time.time()
    with _CACHE_LOCK:
        cached = cache.get(key)
        if not cached:
            return None
        expires_at, value = cached
        if expires_at <= now:
            cache.pop(key, None)
            return None
        return value


def _cache_set(cache: Dict[Any, tuple[float, Any]], key: Any, value: Any, ttl_seconds: int) -> Any:
    with _CACHE_LOCK:
        cache[key] = (time.time() + max(int(ttl_seconds), 1), value)
    return value


def _normalized_ticker(ticker: str) -> str:
    return str(ticker or "").strip().upper().split(":")[0]


def _normalized_accession(accession_number: str) -> str:
    return str(accession_number or "").strip()


def _accession_lookup_key(accession_number: str) -> str:
    return re.sub(r"[^0-9A-Za-z]", "", _normalized_accession(accession_number)).upper()


def _coerce_text(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, str):
        text = value.strip()
        return text or None

    for attr_name in ("text", "content", "markdown", "html"):
        nested = getattr(value, attr_name, None)
        if isinstance(nested, str) and nested.strip():
            return nested.strip()

    text = str(value).strip()
    if not text or text.startswith("<") and text.endswith(">"):
        return None
    return text


def _truncate_text(text: str, limit: int) -> tuple[str, bool]:
    normalized_limit = max(int(limit), 1)
    if len(text) <= normalized_limit:
        return text, False
    return text[: normalized_limit - 1].rstrip() + "…", True


def _normalize_form(value: Any) -> str:
    return str(value or "").strip().upper()


def _base_form(form_type: str) -> str:
    normalized = _normalize_form(form_type)
    if normalized == "10-K/A":
        return "10-K"
    if normalized == "10-Q/A":
        return "10-Q"
    if normalized == "20-F/A":
        return "20-F"
    return normalized


def _normalize_date(value: Any) -> Optional[str]:
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        try:
            return str(value.isoformat())[:10]
        except Exception:
            pass
    raw_value = str(value).strip()
    if not raw_value:
        return None
    return raw_value[:10]


def _normalize_bool(value: Any) -> Optional[bool]:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "yes", "1", "y"}:
            return True
        if normalized in {"false", "no", "0", "n"}:
            return False
    return bool(value)


def _safe_int(value: Any) -> Optional[int]:
    if value in (None, "", "nan"):
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _safe_float(value: Any) -> Optional[float]:
    if value in (None, "", "nan"):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _maybe_call(value: Any) -> Any:
    if callable(value):
        try:
            return value()
        except TypeError:
            return value
    return value


def _first_present_attr(obj: Any, *attr_names: str) -> Any:
    for attr_name in attr_names:
        if not hasattr(obj, attr_name):
            continue
        value = _maybe_call(getattr(obj, attr_name))
        if value not in (None, ""):
            return value
    return None


def _load_edgar_module():
    global _EDGAR_RUNTIME_MODULE, _EDGAR_RUNTIME_IDENTITY
    identity = str(os.getenv("EDGAR_IDENTITY", "")).strip()
    if not identity:
        raise SecFilingsUnavailableError(
            "SEC filings detail is unavailable because EDGAR_IDENTITY is not configured."
        )

    with _EDGAR_RUNTIME_LOCK:
        if _EDGAR_RUNTIME_MODULE is not None and _EDGAR_RUNTIME_IDENTITY == identity:
            return _EDGAR_RUNTIME_MODULE

        try:
            module = importlib.import_module("edgar")
        except ImportError as exc:
            raise SecFilingsUnavailableError(
                "SEC filings detail is unavailable because EdgarTools is not installed."
            ) from exc

        set_identity = getattr(module, "set_identity", None)
        if callable(set_identity):
            set_identity(identity)

        _EDGAR_RUNTIME_MODULE = module
        _EDGAR_RUNTIME_IDENTITY = identity
        return module


def _resolve_company(module: Any, ticker: str):
    company_cls = getattr(module, "Company", None)
    if company_cls is None:
        raise SecFilingsUnavailableError("EdgarTools Company API is unavailable.")
    try:
        return company_cls(ticker)
    except Exception as exc:
        raise SecFilingNotFoundError(f"No SEC company data found for {ticker}.") from exc


def _limit_filings_collection(collection: Any, limit: int) -> Any:
    for method_name in ("latest", "head"):
        method = getattr(collection, method_name, None)
        if not callable(method):
            continue
        try:
            limited = method(limit)
        except TypeError:
            try:
                limited = method(n=limit)
            except TypeError:
                continue
        if limited is not None:
            return limited
    return collection


def _iter_filings(collection: Any) -> List[Any]:
    if collection is None:
        return []
    if isinstance(collection, list):
        return collection
    if isinstance(collection, tuple):
        return list(collection)
    try:
        return list(collection)
    except TypeError:
        return [collection]


def _company_filings(ticker: str, *, limit: int, forms: Optional[List[str]] = None) -> List[Any]:
    module = _load_edgar_module()
    company = _resolve_company(module, ticker)
    requested_forms = sorted(set(forms or RELEVANT_FORMS))
    filings_collection = company.get_filings(form=requested_forms)
    limited_collection = _limit_filings_collection(filings_collection, max(int(limit), 1))
    return _iter_filings(limited_collection)


def _normalize_list_row(filing: Any) -> Dict[str, Any]:
    form_type = _normalize_form(
        _first_present_attr(filing, "form", "report_type", "type", "filing_type")
    )
    description = _coerce_text(
        _first_present_attr(filing, "description", "filing_title", "display_name", "title")
    ) or FORM_DESCRIPTION_FALLBACKS.get(form_type) or form_type
    accession_number = _coerce_text(
        _first_present_attr(filing, "accession_number", "accessionNo", "accessionNumber")
    )
    url = _coerce_text(
        _first_present_attr(filing, "url", "filing_url", "homepage_url", "index_url", "link")
    )

    return {
        "date": _normalize_date(_first_present_attr(filing, "filing_date", "date", "filed")),
        "type": form_type,
        "description": description[:200],
        "url": url,
        "accessionNumber": accession_number,
        "hasKeySections": form_type in SECTION_FORM_SPECS,
        "isAnnualOrQuarterly": form_type in ANNUAL_OR_QUARTERLY_FORMS,
    }


def _find_matching_filings(
    filings: List[Dict[str, Any]],
    *,
    preferred_bases: tuple[str, ...] = ("10-K", "20-F", "10-Q"),
) -> Optional[tuple[Dict[str, Any], Dict[str, Any], str]]:
    for preferred in preferred_bases:
        matching = [filing for filing in filings if _base_form(filing.get("type", "")) == preferred and filing.get("accessionNumber")]
        if len(matching) >= 2:
            return matching[0], matching[1], preferred
    return None


def _select_owner_names(reporting_persons: Any, *, limit: int = 3) -> List[str]:
    people = reporting_persons if isinstance(reporting_persons, list) else list(reporting_persons or [])
    names: List[str] = []
    for person in people:
        name = _coerce_text(getattr(person, "name", None))
        if not name:
            continue
        names.append(name)
        if len(names) >= limit:
            break
    return names


def _resolve_schedule13_purpose(schedule_obj: Any, *, limit: int = 320) -> Optional[str]:
    purpose = _coerce_text(getattr(schedule_obj, "purpose_of_transaction", None))
    if not purpose:
        items = getattr(schedule_obj, "items", None)
        purpose = _coerce_text(getattr(items, "item4_purpose_of_transaction", None))
    if not purpose:
        return None
    return _truncate_text(purpose, limit)[0]


def _resolve_change_status(current_text: Optional[str], previous_text: Optional[str]) -> tuple[str, Optional[float]]:
    if current_text and not previous_text:
        return "new", None
    if previous_text and not current_text:
        return "removed", None
    if not current_text and not previous_text:
        return "unchanged", 1.0

    ratio = difflib.SequenceMatcher(None, current_text or "", previous_text or "").ratio()
    if ratio >= 0.985:
        return "unchanged", ratio
    if ratio >= 0.9:
        return "updated", ratio
    return "material", ratio


def _resolve_section_text(filing_obj: Any, attr_names: tuple[str, ...]) -> Optional[str]:
    for attr_name in attr_names:
        if not hasattr(filing_obj, attr_name):
            continue
        candidate = _coerce_text(_maybe_call(getattr(filing_obj, attr_name)))
        if candidate:
            return candidate
    return None


def _extract_sections(form_type: str, filing_obj: Any, *, char_limit: int) -> List[Dict[str, Any]]:
    sections: List[Dict[str, Any]] = []
    if filing_obj is None:
        return sections

    for key, title, attr_names in SECTION_FORM_SPECS.get(form_type, []):
        text = _resolve_section_text(filing_obj, attr_names)
        if not text:
            continue
        truncated_text, truncated = _truncate_text(text, char_limit)
        sections.append(
            {
                "key": key,
                "title": title,
                "text": truncated_text,
                "truncated": truncated,
            }
        )
    return sections


def _find_filing_by_accession(ticker: str, accession_number: str) -> Any:
    target_key = _accession_lookup_key(accession_number)
    for filing in _company_filings(ticker, limit=120):
        filing_accession = _coerce_text(
            _first_present_attr(filing, "accession_number", "accessionNo", "accessionNumber")
        )
        if not filing_accession:
            continue
        if _accession_lookup_key(filing_accession) == target_key:
            return filing
    raise SecFilingNotFoundError(f"No SEC filing found for {ticker} and accession {accession_number}.")


def list_company_filings(ticker: str, *, limit: int = 30) -> List[Dict[str, Any]]:
    normalized_ticker = _normalized_ticker(ticker)
    normalized_limit = max(int(limit), 1)
    cache_key = (normalized_ticker, normalized_limit)
    cached = _cache_get(_LIST_CACHE, cache_key)
    if cached is not None:
        return cached

    rows: List[Dict[str, Any]] = []
    for filing in _company_filings(normalized_ticker, limit=normalized_limit):
        row = _normalize_list_row(filing)
        if row["type"] not in RELEVANT_FORMS:
            continue
        rows.append(row)
        if len(rows) >= normalized_limit:
            break

    return _cache_set(_LIST_CACHE, cache_key, rows, LIST_CACHE_TTL_SECONDS)


def get_filing_detail(
    ticker: str,
    accession_number: str,
    *,
    section_char_limit: int = 8000,
) -> Dict[str, Any]:
    normalized_ticker = _normalized_ticker(ticker)
    normalized_accession = _normalized_accession(accession_number)
    normalized_limit = max(int(section_char_limit), 1)
    cache_key = (normalized_ticker, normalized_accession, normalized_limit)
    cached = _cache_get(_DETAIL_CACHE, cache_key)
    if cached is not None:
        return cached

    filing = _find_filing_by_accession(normalized_ticker, normalized_accession)
    row = _normalize_list_row(filing)
    filing_obj = None
    obj_method = getattr(filing, "obj", None)
    if callable(obj_method):
        try:
            filing_obj = obj_method()
        except Exception:
            filing_obj = None

    sections = _extract_sections(row["type"], filing_obj, char_limit=normalized_limit)
    payload = {
        "ticker": normalized_ticker,
        "accessionNumber": row["accessionNumber"] or normalized_accession,
        "date": row["date"],
        "type": row["type"],
        "description": row["description"],
        "url": row["url"],
        "hasKeySections": bool(sections),
        "sections": sections,
    }
    return _cache_set(_DETAIL_CACHE, cache_key, payload, DETAIL_CACHE_TTL_SECONDS)


def get_latest_sec_context(
    ticker: str,
    *,
    excerpt_char_limit: int = 1200,
) -> Optional[Dict[str, Any]]:
    try:
        filings = list_company_filings(ticker, limit=10)
    except SecFilingsUnavailableError:
        return None
    except SecFilingNotFoundError:
        return None

    for filing in filings:
        if not filing.get("hasKeySections") or not filing.get("accessionNumber"):
            continue
        try:
            detail = get_filing_detail(
                ticker,
                filing["accessionNumber"],
                section_char_limit=excerpt_char_limit,
            )
        except SecFilingsError:
            continue
        if detail.get("sections"):
            return {
                "accessionNumber": detail.get("accessionNumber"),
                "type": detail.get("type"),
                "date": detail.get("date"),
                "url": detail.get("url"),
                "sections": detail.get("sections"),
            }
    return None


def list_insider_activity(
    ticker: str,
    *,
    limit: int = 8,
) -> List[Dict[str, Any]]:
    normalized_ticker = _normalized_ticker(ticker)
    normalized_limit = max(int(limit), 1)
    cache_key = (normalized_ticker, normalized_limit)
    cached = _cache_get(_INSIDER_CACHE, cache_key)
    if cached is not None:
        return cached

    rows: List[Dict[str, Any]] = []
    insider_filings = _company_filings(
        normalized_ticker,
        limit=max(normalized_limit * 3, normalized_limit),
        forms=sorted(INSIDER_FORMS),
    )

    for filing in insider_filings:
        filing_row = _normalize_list_row(filing)
        filing_obj = None
        obj_method = getattr(filing, "obj", None)
        if callable(obj_method):
            try:
                filing_obj = obj_method()
            except Exception:
                filing_obj = None

        summary = None
        if filing_obj is not None:
            summary_method = getattr(filing_obj, "get_ownership_summary", None)
            if callable(summary_method):
                try:
                    summary = summary_method()
                except Exception:
                    summary = None

        transactions = []
        transaction_items = getattr(summary, "transactions", None) or getattr(filing_obj, "transactions", None) or []
        for transaction in list(transaction_items)[:3]:
            shares = _safe_int(_first_present_attr(transaction, "shares", "amount"))
            price = _safe_float(_first_present_attr(transaction, "price_per_share", "price"))
            action = _coerce_text(_first_present_attr(transaction, "acquired_disposed", "action"))
            transaction_type = _coerce_text(_first_present_attr(transaction, "transaction_type", "type", "code"))
            if not any(value is not None for value in (shares, price, action, transaction_type)):
                continue
            transactions.append(
                {
                    "transactionType": transaction_type,
                    "action": action,
                    "shares": shares,
                    "pricePerShare": price,
                }
            )

        activity = _coerce_text(_first_present_attr(summary, "primary_activity"))
        if not activity and transactions:
            first_action = transactions[0].get("action")
            activity = "Purchase" if first_action == "A" else "Sale" if first_action == "D" else None

        rows.append(
            {
                "date": filing_row.get("date"),
                "type": filing_row.get("type"),
                "description": filing_row.get("description"),
                "url": filing_row.get("url"),
                "accessionNumber": filing_row.get("accessionNumber"),
                "insiderName": _coerce_text(_first_present_attr(filing_obj, "insider_name")),
                "position": _coerce_text(_first_present_attr(filing_obj, "position", "officer_title")),
                "isOfficer": _normalize_bool(_first_present_attr(filing_obj, "is_officer")),
                "isDirector": _normalize_bool(_first_present_attr(filing_obj, "is_director")),
                "isTenPercentOwner": _normalize_bool(
                    _first_present_attr(filing_obj, "is_ten_percent_owner", "is_ten_pct_owner")
                ),
                "activity": activity,
                "netShares": _safe_int(_first_present_attr(summary, "net_change")),
                "netValue": _safe_float(_first_present_attr(summary, "net_value")),
                "remainingShares": _safe_int(_first_present_attr(summary, "remaining_shares")),
                "transactions": transactions,
            }
        )
        if len(rows) >= normalized_limit:
            break

    return _cache_set(_INSIDER_CACHE, cache_key, rows, INSIDER_CACHE_TTL_SECONDS)


def list_beneficial_ownership(
    ticker: str,
    *,
    limit: int = 8,
) -> List[Dict[str, Any]]:
    normalized_ticker = _normalized_ticker(ticker)
    normalized_limit = max(int(limit), 1)
    cache_key = (normalized_ticker, normalized_limit)
    cached = _cache_get(_OWNERSHIP_CACHE, cache_key)
    if cached is not None:
        return cached

    rows: List[Dict[str, Any]] = []
    ownership_filings = _company_filings(
        normalized_ticker,
        limit=max(normalized_limit * 3, normalized_limit),
        forms=sorted(BENEFICIAL_OWNERSHIP_FORMS),
    )

    for filing in ownership_filings:
        filing_row = _normalize_list_row(filing)
        filing_obj = None
        obj_method = getattr(filing, "obj", None)
        if callable(obj_method):
            try:
                filing_obj = obj_method()
            except Exception:
                filing_obj = None

        reporting_persons = getattr(filing_obj, "reporting_persons", []) if filing_obj is not None else []
        owner_names = _select_owner_names(reporting_persons)
        ownership_percent = _safe_float(_first_present_attr(filing_obj, "total_percent"))
        ownership_shares = _safe_int(_first_present_attr(filing_obj, "total_shares"))
        has_meaningful_holding = (
            (ownership_percent is not None and ownership_percent > 0)
            or (ownership_shares is not None and ownership_shares > 0)
        )
        if not owner_names or not has_meaningful_holding:
            continue

        rows.append(
            {
                "date": filing_row.get("date"),
                "type": filing_row.get("type"),
                "description": filing_row.get("description"),
                "url": filing_row.get("url"),
                "accessionNumber": filing_row.get("accessionNumber"),
                "owners": owner_names,
                "ownerCount": len(list(reporting_persons or [])),
                "ownershipPercent": ownership_percent,
                "ownershipShares": ownership_shares,
                "isPassive": _normalize_bool(_first_present_attr(filing_obj, "is_passive_investor")),
                "purpose": _resolve_schedule13_purpose(filing_obj),
                "issuerName": _coerce_text(getattr(getattr(filing_obj, "issuer_info", None), "name", None)),
            }
        )
        if len(rows) >= normalized_limit:
            break

    return _cache_set(_OWNERSHIP_CACHE, cache_key, rows, OWNERSHIP_CACHE_TTL_SECONDS)


def get_filing_change_summary(
    ticker: str,
    *,
    excerpt_char_limit: int = 320,
) -> Optional[Dict[str, Any]]:
    normalized_ticker = _normalized_ticker(ticker)
    normalized_limit = max(int(excerpt_char_limit), 80)
    cache_key = (normalized_ticker, normalized_limit)
    cached = _cache_get(_CHANGE_CACHE, cache_key)
    if cached is not None:
        return cached

    filings = list_company_filings(normalized_ticker, limit=20)
    matching_pair = _find_matching_filings(filings)
    if not matching_pair:
        return _cache_set(_CHANGE_CACHE, cache_key, None, CHANGE_CACHE_TTL_SECONDS)

    current_filing, previous_filing, comparison_form = matching_pair
    current_detail = get_filing_detail(
        normalized_ticker,
        current_filing["accessionNumber"],
        section_char_limit=max(normalized_limit * 4, 1200),
    )
    previous_detail = get_filing_detail(
        normalized_ticker,
        previous_filing["accessionNumber"],
        section_char_limit=max(normalized_limit * 4, 1200),
    )

    current_sections = {section["key"]: section for section in current_detail.get("sections", [])}
    previous_sections = {section["key"]: section for section in previous_detail.get("sections", [])}

    section_changes: List[Dict[str, Any]] = []
    for section_key in current_sections.keys() | previous_sections.keys():
        current_section = current_sections.get(section_key)
        previous_section = previous_sections.get(section_key)
        current_text = current_section.get("text") if current_section else None
        previous_text = previous_section.get("text") if previous_section else None
        change_status, similarity = _resolve_change_status(current_text, previous_text)
        if change_status == "unchanged":
            continue
        current_excerpt = _truncate_text(current_text, normalized_limit)[0] if current_text else None
        previous_excerpt = _truncate_text(previous_text, normalized_limit)[0] if previous_text else None
        title = (
            (current_section or previous_section or {}).get("title")
            or section_key
        )
        section_changes.append(
            {
                "key": section_key,
                "title": title,
                "status": change_status,
                "similarity": round(similarity, 3) if similarity is not None else None,
                "currentExcerpt": current_excerpt,
                "previousExcerpt": previous_excerpt,
            }
        )

    payload = {
        "comparisonForm": comparison_form,
        "currentFiling": {
            "accessionNumber": current_detail.get("accessionNumber"),
            "date": current_detail.get("date"),
            "type": current_detail.get("type"),
            "url": current_detail.get("url"),
        },
        "previousFiling": {
            "accessionNumber": previous_detail.get("accessionNumber"),
            "date": previous_detail.get("date"),
            "type": previous_detail.get("type"),
            "url": previous_detail.get("url"),
        },
        "sectionChanges": section_changes,
    }
    return _cache_set(_CHANGE_CACHE, cache_key, payload, CHANGE_CACHE_TTL_SECONDS)


def get_company_sec_intelligence(
    ticker: str,
    *,
    insight_limit: int = 6,
) -> Dict[str, Any]:
    normalized_ticker = _normalized_ticker(ticker)
    try:
        latest_filing = get_latest_sec_context(normalized_ticker)
    except SecFilingsError:
        latest_filing = None

    try:
        filing_change_summary = get_filing_change_summary(normalized_ticker)
    except SecFilingsError:
        filing_change_summary = None

    try:
        insider_activity = list_insider_activity(normalized_ticker, limit=insight_limit)
    except SecFilingsError:
        insider_activity = []

    try:
        beneficial_ownership = list_beneficial_ownership(normalized_ticker, limit=insight_limit)
    except SecFilingsError:
        beneficial_ownership = []

    return {
        "ticker": normalized_ticker,
        "latestAnnualOrQuarterly": latest_filing,
        "filingChangeSummary": filing_change_summary,
        "insiderActivity": insider_activity,
        "beneficialOwnership": beneficial_ownership,
    }

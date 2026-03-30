from __future__ import annotations


def list_deliverables_handler(
    *,
    deliverables_ready_fn,
    not_configured_response_fn,
    ensure_storage_ready_fn,
    session_scope,
    database_url,
    list_deliverables_fn,
    get_current_user_id_fn,
    jsonify_fn,
):
    if not deliverables_ready_fn():
        return not_configured_response_fn()

    ensure_storage_ready_fn()
    with session_scope(database_url) as session:
        deliverables = list_deliverables_fn(session, get_current_user_id_fn())
    return jsonify_fn(deliverables)


def create_deliverable_handler(
    *,
    payload,
    deliverables_ready_fn,
    not_configured_response_fn,
    ensure_storage_ready_fn,
    session_scope,
    database_url,
    create_deliverable_fn,
    get_current_user_id_fn,
    deliverable_error_cls,
    jsonify_fn,
):
    if not deliverables_ready_fn():
        return not_configured_response_fn()

    ensure_storage_ready_fn()
    try:
        with session_scope(database_url) as session:
            deliverable = create_deliverable_fn(session, get_current_user_id_fn(), payload)
        return jsonify_fn(deliverable), 201
    except deliverable_error_cls as exc:
        body = {"error": str(exc), **exc.payload}
        return jsonify_fn(body), exc.status_code


def get_deliverable_handler(
    deliverable_id,
    *,
    deliverables_ready_fn,
    not_configured_response_fn,
    ensure_storage_ready_fn,
    session_scope,
    database_url,
    get_deliverable_detail_fn,
    get_current_user_id_fn,
    deliverable_error_cls,
    jsonify_fn,
):
    if not deliverables_ready_fn():
        return not_configured_response_fn()

    ensure_storage_ready_fn()
    try:
        with session_scope(database_url) as session:
            payload = get_deliverable_detail_fn(session, get_current_user_id_fn(), deliverable_id)
        return jsonify_fn(payload)
    except deliverable_error_cls as exc:
        body = {"error": str(exc), **exc.payload}
        return jsonify_fn(body), exc.status_code


def patch_deliverable_handler(
    deliverable_id,
    *,
    payload,
    deliverables_ready_fn,
    not_configured_response_fn,
    ensure_storage_ready_fn,
    session_scope,
    database_url,
    update_deliverable_fn,
    get_current_user_id_fn,
    deliverable_error_cls,
    jsonify_fn,
):
    if not deliverables_ready_fn():
        return not_configured_response_fn()

    ensure_storage_ready_fn()
    try:
        with session_scope(database_url) as session:
            updated = update_deliverable_fn(session, get_current_user_id_fn(), deliverable_id, payload)
        return jsonify_fn(updated)
    except deliverable_error_cls as exc:
        body = {"error": str(exc), **exc.payload}
        return jsonify_fn(body), exc.status_code


def put_deliverable_assumptions_handler(
    deliverable_id,
    *,
    payload,
    deliverables_ready_fn,
    not_configured_response_fn,
    ensure_storage_ready_fn,
    session_scope,
    database_url,
    replace_deliverable_assumptions_fn,
    get_current_user_id_fn,
    deliverable_error_cls,
    jsonify_fn,
):
    if not deliverables_ready_fn():
        return not_configured_response_fn()

    assumptions = payload if isinstance(payload, list) else payload.get("assumptions", [])
    ensure_storage_ready_fn()
    try:
        with session_scope(database_url) as session:
            saved = replace_deliverable_assumptions_fn(
                session,
                get_current_user_id_fn(),
                deliverable_id,
                assumptions,
            )
        return jsonify_fn(saved)
    except deliverable_error_cls as exc:
        body = {"error": str(exc), **exc.payload}
        return jsonify_fn(body), exc.status_code


def post_deliverable_review_handler(
    deliverable_id,
    *,
    payload,
    deliverables_ready_fn,
    not_configured_response_fn,
    ensure_storage_ready_fn,
    session_scope,
    database_url,
    add_deliverable_review_fn,
    get_current_user_id_fn,
    deliverable_error_cls,
    jsonify_fn,
):
    if not deliverables_ready_fn():
        return not_configured_response_fn()

    ensure_storage_ready_fn()
    try:
        with session_scope(database_url) as session:
            review = add_deliverable_review_fn(session, get_current_user_id_fn(), deliverable_id, payload)
        return jsonify_fn(review), 201
    except deliverable_error_cls as exc:
        body = {"error": str(exc), **exc.payload}
        return jsonify_fn(body), exc.status_code


def post_deliverable_preflight_handler(
    deliverable_id,
    *,
    deliverables_ready_fn,
    not_configured_response_fn,
    ensure_storage_ready_fn,
    session_scope,
    database_url,
    create_deliverable_preflight_fn,
    get_current_user_id_fn,
    deliverable_error_cls,
    jsonify_fn,
):
    if not deliverables_ready_fn():
        return not_configured_response_fn()

    ensure_storage_ready_fn()
    try:
        with session_scope(database_url) as session:
            preflight = create_deliverable_preflight_fn(session, get_current_user_id_fn(), deliverable_id)
        return jsonify_fn(preflight)
    except deliverable_error_cls as exc:
        body = {"error": str(exc), **exc.payload}
        return jsonify_fn(body), exc.status_code


def get_deliverable_context_handler(
    deliverable_id,
    *,
    deliverables_ready_fn,
    not_configured_response_fn,
    ensure_storage_ready_fn,
    session_scope,
    database_url,
    build_deliverable_context_fn,
    get_current_user_id_fn,
    deliverable_error_cls,
    jsonify_fn,
):
    if not deliverables_ready_fn():
        return not_configured_response_fn()

    ensure_storage_ready_fn()
    try:
        with session_scope(database_url) as session:
            payload = build_deliverable_context_fn(session, get_current_user_id_fn(), deliverable_id)
        return jsonify_fn(payload)
    except deliverable_error_cls as exc:
        body = {"error": str(exc), **exc.payload}
        return jsonify_fn(body), exc.status_code


def get_deliverable_memos_handler(
    deliverable_id,
    *,
    deliverables_ready_fn,
    not_configured_response_fn,
    ensure_storage_ready_fn,
    session_scope,
    database_url,
    list_deliverable_memos_fn,
    get_current_user_id_fn,
    deliverable_error_cls,
    jsonify_fn,
):
    if not deliverables_ready_fn():
        return not_configured_response_fn()

    ensure_storage_ready_fn()
    try:
        with session_scope(database_url) as session:
            payload = list_deliverable_memos_fn(session, get_current_user_id_fn(), deliverable_id)
        return jsonify_fn(payload)
    except deliverable_error_cls as exc:
        body = {"error": str(exc), **exc.payload}
        return jsonify_fn(body), exc.status_code


def post_deliverable_generate_handler(
    deliverable_id,
    *,
    deliverables_ready_fn,
    not_configured_response_fn,
    ensure_storage_ready_fn,
    session_scope,
    database_url,
    generate_deliverable_memo_fn,
    get_current_user_id_fn,
    deliverable_error_cls,
    jsonify_fn,
):
    if not deliverables_ready_fn():
        return not_configured_response_fn()

    ensure_storage_ready_fn()
    try:
        with session_scope(database_url) as session:
            memo = generate_deliverable_memo_fn(session, get_current_user_id_fn(), deliverable_id)
        status_code = memo.pop("_statusCode", 201)
        if status_code >= 400:
            return jsonify_fn({"error": memo.get("errorMessage") or "Memo generation failed", "memo": memo}), status_code
        return jsonify_fn(memo), status_code
    except deliverable_error_cls as exc:
        body = {"error": str(exc), **exc.payload}
        return jsonify_fn(body), exc.status_code


def download_deliverable_memo_handler(
    deliverable_id,
    memo_id,
    *,
    deliverables_ready_fn,
    not_configured_response_fn,
    ensure_storage_ready_fn,
    session_scope,
    database_url,
    get_deliverable_memo_artifact_fn,
    get_current_user_id_fn,
    deliverable_error_cls,
    jsonify_fn,
    bytes_io_cls,
    send_file_fn,
    docx_mime_type,
):
    if not deliverables_ready_fn():
        return not_configured_response_fn()

    ensure_storage_ready_fn()
    try:
        with session_scope(database_url) as session:
            artifact = get_deliverable_memo_artifact_fn(
                session,
                get_current_user_id_fn(),
                deliverable_id,
                memo_id,
            )
    except deliverable_error_cls as exc:
        body = {"error": str(exc), **exc.payload}
        return jsonify_fn(body), exc.status_code

    return send_file_fn(
        bytes_io_cls(artifact["bytes"]),
        mimetype=artifact.get("mimeType") or docx_mime_type,
        as_attachment=True,
        download_name=artifact["filename"],
    )

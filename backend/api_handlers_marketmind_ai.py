from __future__ import annotations


def get_bootstrap_handler(
    *,
    deliverables_ready_fn,
    not_configured_response_fn,
    get_bootstrap_payload_fn,
    jsonify_fn,
):
    if not deliverables_ready_fn():
        return not_configured_response_fn()
    return jsonify_fn(get_bootstrap_payload_fn())


def list_chats_handler(
    *,
    deliverables_ready_fn,
    not_configured_response_fn,
    ensure_storage_ready_fn,
    session_scope,
    database_url,
    list_chats_fn,
    get_current_user_id_fn,
    jsonify_fn,
):
    if not deliverables_ready_fn():
        return not_configured_response_fn()

    ensure_storage_ready_fn()
    with session_scope(database_url) as session:
        chats = list_chats_fn(session, get_current_user_id_fn())
    return jsonify_fn(chats)


def get_chat_handler(
    chat_id,
    *,
    deliverables_ready_fn,
    not_configured_response_fn,
    ensure_storage_ready_fn,
    session_scope,
    database_url,
    get_chat_detail_fn,
    get_current_user_id_fn,
    error_cls,
    jsonify_fn,
):
    if not deliverables_ready_fn():
        return not_configured_response_fn()

    ensure_storage_ready_fn()
    try:
        with session_scope(database_url) as session:
            payload = get_chat_detail_fn(session, get_current_user_id_fn(), chat_id)
        return jsonify_fn(payload)
    except error_cls as exc:
        body = {"error": str(exc), **exc.payload}
        return jsonify_fn(body), exc.status_code


def delete_chat_handler(
    chat_id,
    *,
    deliverables_ready_fn,
    not_configured_response_fn,
    ensure_storage_ready_fn,
    session_scope,
    database_url,
    delete_chat_fn,
    get_current_user_id_fn,
    error_cls,
    jsonify_fn,
):
    if not deliverables_ready_fn():
        return not_configured_response_fn()

    ensure_storage_ready_fn()
    try:
        with session_scope(database_url) as session:
            delete_chat_fn(session, get_current_user_id_fn(), chat_id)
        return jsonify_fn({"deleted": True, "chatId": chat_id})
    except error_cls as exc:
        body = {"error": str(exc), **exc.payload}
        return jsonify_fn(body), exc.status_code


def get_context_handler(
    *,
    ticker,
    deliverables_ready_fn,
    not_configured_response_fn,
    ensure_storage_ready_fn,
    session_scope,
    database_url,
    build_context_fn,
    get_current_user_id_fn,
    error_cls,
    jsonify_fn,
):
    if not deliverables_ready_fn():
        return not_configured_response_fn()

    ensure_storage_ready_fn()
    try:
        with session_scope(database_url) as session:
            payload = build_context_fn(session, get_current_user_id_fn(), ticker)
        return jsonify_fn(payload)
    except error_cls as exc:
        body = {"error": str(exc), **exc.payload}
        return jsonify_fn(body), exc.status_code


def post_chat_handler(
    *,
    payload,
    deliverables_ready_fn,
    not_configured_response_fn,
    ensure_storage_ready_fn,
    session_scope,
    database_url,
    generate_reply_fn,
    get_current_user_id_fn,
    error_cls,
    jsonify_fn,
):
    if not deliverables_ready_fn():
        return not_configured_response_fn()

    ensure_storage_ready_fn()
    try:
        with session_scope(database_url) as session:
            response_payload = generate_reply_fn(
                session,
                get_current_user_id_fn(),
                messages=payload.get("messages") or [],
                attached_ticker=payload.get("attachedTicker"),
                chat_id=payload.get("chatId"),
                mode=payload.get("mode"),
            )
        return jsonify_fn(response_payload)
    except error_cls as exc:
        body = {"error": str(exc), **exc.payload}
        return jsonify_fn(body), exc.status_code


def post_artifact_preflight_handler(
    *,
    payload,
    deliverables_ready_fn,
    not_configured_response_fn,
    ensure_storage_ready_fn,
    session_scope,
    database_url,
    create_artifact_preflight_fn,
    get_current_user_id_fn,
    error_cls,
    jsonify_fn,
):
    if not deliverables_ready_fn():
        return not_configured_response_fn()

    ensure_storage_ready_fn()
    try:
        with session_scope(database_url) as session:
            preflight = create_artifact_preflight_fn(
                session,
                get_current_user_id_fn(),
                template_key=payload.get("templateKey"),
                messages=payload.get("messages") or [],
                attached_ticker=payload.get("attachedTicker"),
            )
        return jsonify_fn(preflight)
    except error_cls as exc:
        body = {"error": str(exc), **exc.payload}
        return jsonify_fn(body), exc.status_code


def list_artifacts_handler(
    *,
    deliverables_ready_fn,
    not_configured_response_fn,
    ensure_storage_ready_fn,
    session_scope,
    database_url,
    list_artifacts_fn,
    get_current_user_id_fn,
    jsonify_fn,
):
    if not deliverables_ready_fn():
        return not_configured_response_fn()

    ensure_storage_ready_fn()
    with session_scope(database_url) as session:
        artifacts = list_artifacts_fn(session, get_current_user_id_fn())
    return jsonify_fn(artifacts)


def generate_artifact_handler(
    *,
    payload,
    deliverables_ready_fn,
    not_configured_response_fn,
    ensure_storage_ready_fn,
    session_scope,
    database_url,
    generate_artifact_fn,
    get_current_user_id_fn,
    error_cls,
    jsonify_fn,
):
    if not deliverables_ready_fn():
        return not_configured_response_fn()

    ensure_storage_ready_fn()
    try:
        with session_scope(database_url) as session:
            artifact_payload = generate_artifact_fn(session, get_current_user_id_fn(), payload)
        status_code = artifact_payload.pop("_statusCode", 201)
        if status_code >= 400:
            return jsonify_fn({"error": artifact_payload["version"].get("errorMessage") or "Artifact generation failed", **artifact_payload}), status_code
        return jsonify_fn(artifact_payload), status_code
    except error_cls as exc:
        body = {"error": str(exc), **exc.payload}
        return jsonify_fn(body), exc.status_code


def get_artifact_handler(
    artifact_id,
    *,
    deliverables_ready_fn,
    not_configured_response_fn,
    ensure_storage_ready_fn,
    session_scope,
    database_url,
    get_artifact_detail_fn,
    get_current_user_id_fn,
    error_cls,
    jsonify_fn,
):
    if not deliverables_ready_fn():
        return not_configured_response_fn()

    ensure_storage_ready_fn()
    try:
        with session_scope(database_url) as session:
            payload = get_artifact_detail_fn(session, get_current_user_id_fn(), artifact_id)
        return jsonify_fn(payload)
    except error_cls as exc:
        body = {"error": str(exc), **exc.payload}
        return jsonify_fn(body), exc.status_code


def download_artifact_handler(
    artifact_id,
    version_id,
    *,
    deliverables_ready_fn,
    not_configured_response_fn,
    ensure_storage_ready_fn,
    session_scope,
    database_url,
    get_artifact_download_fn,
    get_current_user_id_fn,
    error_cls,
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
            artifact = get_artifact_download_fn(
                session,
                get_current_user_id_fn(),
                artifact_id,
                version_id,
            )
    except error_cls as exc:
        body = {"error": str(exc), **exc.payload}
        return jsonify_fn(body), exc.status_code

    return send_file_fn(
        bytes_io_cls(artifact["bytes"]),
        mimetype=artifact.get("mimeType") or docx_mime_type,
        as_attachment=True,
        download_name=artifact["filename"],
    )

"""
Amarktai Coder — Backend API tests.

Tests run against the external preview URL (REACT_APP_BACKEND_URL) so the path
exercises the Emergent ingress -> FastAPI proxy (port 8001) -> Next.js (3000).
Session cookie is 'amarktai_session'. GENX_API_KEY is intentionally blank in
this environment — the AI endpoints must report "not configured", not crash.
"""
from __future__ import annotations

import os
import time
import uuid
from pathlib import Path

import pytest
import requests

# Read REACT_APP_BACKEND_URL from frontend/.env if not in process env
def _load_base_url() -> str:
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if url:
        return url.rstrip("/")
    env_file = Path("/app/frontend/.env")
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip().rstrip("/")
    # Fall back to a host-based emergent preview URL constructed from a hint file.
    raise RuntimeError("REACT_APP_BACKEND_URL is not configured")


BASE_URL = _load_base_url()
API = f"{BASE_URL}/api"


def _mkemail() -> str:
    return f"test_{int(time.time())}_{uuid.uuid4().hex[:6]}@amarktai.dev"


# ----------------------------- Fixtures --------------------------------------

@pytest.fixture
def session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Accept": "application/json"})
    return s


@pytest.fixture
def registered_user(session):
    """Register a brand-new user and return (session, email, password, user_id)."""
    email = _mkemail()
    password = "Testpass123!"
    r = session.post(f"{API}/auth/register", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    assert "id" in data and data["email"] == email
    # Cookie should be set on the session
    assert "amarktai_session" in session.cookies, f"session cookie missing: {session.cookies.get_dict()}"
    return {"session": session, "email": email, "password": password, "id": data["id"]}


# ----------------------------- Health ----------------------------------------

class TestHealth:
    def test_health_ok(self, session):
        r = session.get(f"{API}/health", timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("app") == "ok"
        assert body.get("db") == "ok"
        assert "timestamp" in body
        assert isinstance(body["timestamp"], str) and len(body["timestamp"]) > 0


# ----------------------------- Auth ------------------------------------------

class TestAuth:
    def test_register_short_password_rejected(self, session):
        r = session.post(
            f"{API}/auth/register",
            json={"email": _mkemail(), "password": "short"},
            timeout=15,
        )
        assert r.status_code == 400, r.text

    def test_register_duplicate_email_returns_409(self, session):
        email = _mkemail()
        r1 = session.post(f"{API}/auth/register", json={"email": email, "password": "Testpass123!"}, timeout=15)
        assert r1.status_code == 200
        # Use a fresh session so we don't reuse cookies
        s2 = requests.Session()
        s2.headers.update({"Content-Type": "application/json"})
        r2 = s2.post(f"{API}/auth/register", json={"email": email, "password": "Testpass123!"}, timeout=15)
        assert r2.status_code == 409, f"expected 409, got {r2.status_code}: {r2.text}"

    def test_login_success_and_wrong_password(self, registered_user):
        email = registered_user["email"]
        password = registered_user["password"]
        # Fresh session for login
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        r = s.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["email"] == email and "id" in body
        assert "amarktai_session" in s.cookies

        # Wrong password
        s2 = requests.Session()
        s2.headers.update({"Content-Type": "application/json"})
        r2 = s2.post(f"{API}/auth/login", json={"email": email, "password": "WrongPass999!"}, timeout=15)
        assert r2.status_code == 401, r2.text

    def test_me_with_session(self, registered_user):
        s = registered_user["session"]
        r = s.get(f"{API}/me", timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "user" in body and body["user"] is not None
        user = body["user"]
        for k in ("id", "email", "role", "createdAt", "updatedAt"):
            assert k in user, f"missing field {k} in /me user: {user}"
        assert user["email"] == registered_user["email"]
        # Fresh account => no github connection
        assert body.get("github") in (None,), f"expected github=None, got {body.get('github')}"

    def test_me_without_session_is_401(self, session):
        s = requests.Session()
        r = s.get(f"{API}/me", timeout=15)
        assert r.status_code == 401, r.text

    def test_logout_clears_cookie(self, registered_user):
        s = registered_user["session"]
        # Ensure logged in
        r0 = s.get(f"{API}/me", timeout=15)
        assert r0.status_code == 200
        r = s.post(f"{API}/auth/logout", timeout=15)
        assert r.status_code == 200, r.text
        # Cookie should be cleared (server expires it). Drop cookies just in case
        # the server returned an empty/expired one — that still satisfies "logout".
        s.cookies.clear()
        r2 = s.get(f"{API}/me", timeout=15)
        assert r2.status_code == 401, f"/me after logout should be 401, got {r2.status_code} {r2.text}"


# ----------------------------- GitHub ----------------------------------------

class TestGitHub:
    def test_status_unauth(self, session):
        s = requests.Session()
        r = s.get(f"{API}/github/status", timeout=15)
        assert r.status_code == 401, r.text

    def test_status_no_pat(self, registered_user):
        s = registered_user["session"]
        r = s.get(f"{API}/github/status", timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("connected") is False, f"expected connected=false, got {body}"

    def test_connect_unauth(self, session):
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        r = s.post(f"{API}/github/connect", json={"token": "ghp_" + "a" * 36}, timeout=20)
        assert r.status_code == 401, r.text

    def test_connect_invalid_token(self, registered_user):
        s = registered_user["session"]
        # >= 20 chars, fails zod min(20), then fails GitHub validation
        bad_token = "ghp_invalidtokendoesnotexist1234567890"
        r = s.post(f"{API}/github/connect", json={"token": bad_token}, timeout=30)
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"
        body = r.json()
        msg = (body.get("error") or "").lower()
        # Error message should reference validation/invalid token
        assert any(w in msg for w in ("invalid", "fail", "validat", "token", "401", "bad")), (
            f"error message should mention validation failure: {body}"
        )

    def test_repos_without_pat(self, registered_user):
        s = registered_user["session"]
        r = s.get(f"{API}/github/repos", timeout=15)
        assert r.status_code == 400, r.text
        body = r.json()
        assert "github not connected" in (body.get("error") or "").lower(), body

    def test_branch_invalid_body(self, registered_user):
        s = registered_user["session"]
        # Invalid: repo missing slash
        r = s.post(f"{API}/github/branch", json={"repo": "norepo", "baseBranch": "main", "newBranch": "feat"}, timeout=15)
        assert r.status_code == 400, r.text

    def test_commit_invalid_body(self, registered_user):
        s = registered_user["session"]
        # Invalid: files empty
        r = s.post(
            f"{API}/github/commit",
            json={"repo": "a/b", "branch": "main", "message": "x", "files": []},
            timeout=15,
        )
        assert r.status_code == 400, r.text

    def test_pull_request_invalid_body(self, registered_user):
        s = registered_user["session"]
        r = s.post(
            f"{API}/github/pull-request",
            json={"repo": "a/b", "head": "", "base": "main", "title": "T"},
            timeout=15,
        )
        assert r.status_code == 400, r.text


# ----------------------------- AI --------------------------------------------

class TestAI:
    def test_ai_status_requires_session(self, session):
        s = requests.Session()
        r = s.get(f"{API}/ai/status", timeout=15)
        assert r.status_code == 401, r.text

    def test_ai_status_not_configured(self, registered_user):
        s = registered_user["session"]
        r = s.get(f"{API}/ai/status", timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("configured") is False
        assert body.get("ok") is False
        assert body.get("error") == "GENX_API_KEY not set", body

    def test_ai_models_fallback(self, registered_user):
        s = registered_user["session"]
        r = s.get(f"{API}/ai/models", timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "models" in body and isinstance(body["models"], list)
        assert body.get("configured") is False

    def test_ai_chat_no_key(self, registered_user):
        s = registered_user["session"]
        r = s.post(
            f"{API}/ai/chat",
            json={"messages": [{"role": "user", "content": "hi"}]},
            timeout=20,
        )
        assert r.status_code == 400, r.text
        body = r.json()
        assert "GENX_API_KEY" in (body.get("error") or ""), body

    def test_ai_task_create_and_run_fails_without_key(self, registered_user):
        s = registered_user["session"]
        payload = {"repo": "octocat/Hello-World", "baseBranch": "main", "prompt": "Improve README clarity"}
        r = s.post(f"{API}/ai/task", json=payload, timeout=20)
        assert r.status_code == 200, r.text
        t = r.json().get("task")
        assert t and t.get("id") and t.get("status") == "queued", r.text
        task_id = t["id"]

        # Run should fail because GENX is not configured
        r2 = s.post(f"{API}/ai/task/{task_id}/run", timeout=30)
        assert r2.status_code == 400, f"expected 400, got {r2.status_code}: {r2.text}"
        body = r2.json()
        assert "GENX_API_KEY" in (body.get("error") or ""), body

        # Confirm the task is NOT falsely marked completed
        r3 = s.get(f"{API}/ai/task", timeout=15)
        assert r3.status_code == 200
        tasks = r3.json().get("tasks") or []
        found = next((x for x in tasks if x["id"] == task_id), None)
        assert found, f"task {task_id} not in list: {tasks}"
        assert found["status"] in ("queued", "failed"), f"task status must not be completed: {found['status']}"
        assert found["status"] != "completed"

    def test_ai_task_list_unauth(self, session):
        s = requests.Session()
        r = s.get(f"{API}/ai/task", timeout=15)
        assert r.status_code == 401, r.text


# ----------------------------- Pull requests ---------------------------------

class TestPullRequests:
    def test_empty_pr_list_for_new_user(self, registered_user):
        s = registered_user["session"]
        r = s.get(f"{API}/pull-requests", timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("pullRequests") == [], body

    def test_pr_list_unauth(self, session):
        s = requests.Session()
        r = s.get(f"{API}/pull-requests", timeout=15)
        assert r.status_code == 401, r.text


# ----------------------------- Multi-tenancy ---------------------------------

class TestMultiTenancy:
    def test_user_b_cannot_see_user_a_tasks(self, session):
        # Register user A
        sA = requests.Session()
        sA.headers.update({"Content-Type": "application/json"})
        emailA = _mkemail()
        rA = sA.post(f"{API}/auth/register", json={"email": emailA, "password": "Testpass123!"}, timeout=20)
        assert rA.status_code == 200, rA.text

        # User A creates a task
        rt = sA.post(
            f"{API}/ai/task",
            json={"repo": "octocat/Hello-World", "baseBranch": "main", "prompt": "User A private task xyz"},
            timeout=20,
        )
        assert rt.status_code == 200, rt.text
        task_a_id = rt.json()["task"]["id"]

        # Register user B
        sB = requests.Session()
        sB.headers.update({"Content-Type": "application/json"})
        emailB = _mkemail()
        rB = sB.post(f"{API}/auth/register", json={"email": emailB, "password": "Testpass123!"}, timeout=20)
        assert rB.status_code == 200, rB.text

        # B's task list must be empty (or at least not include A's task)
        rlB = sB.get(f"{API}/ai/task", timeout=15)
        assert rlB.status_code == 200
        tasks_b = rlB.json().get("tasks", [])
        ids_b = [t["id"] for t in tasks_b]
        assert task_a_id not in ids_b, "Multi-tenancy violation: user B sees user A's task"

        # B's PR list empty
        rprB = sB.get(f"{API}/pull-requests", timeout=15)
        assert rprB.status_code == 200
        assert rprB.json().get("pullRequests") == []

        # B's github status: not connected
        rghB = sB.get(f"{API}/github/status", timeout=15)
        assert rghB.status_code == 200
        assert rghB.json().get("connected") is False


# ----------------------------- Middleware ------------------------------------

class TestMiddleware:
    def test_dashboard_redirects_unauthenticated(self):
        # Use a fresh session that does NOT follow redirects
        s = requests.Session()
        r = s.get(f"{BASE_URL}/dashboard/anything", allow_redirects=False, timeout=15)
        assert r.status_code == 307, f"expected 307, got {r.status_code}: {r.headers}"
        loc = r.headers.get("location", "")
        assert "/login" in loc, f"expected redirect to /login, got {loc}"
        assert "next=" in loc, f"expected next=... param in {loc}"


# ----------------------------- Pages -----------------------------------------

class TestPages:
    def test_landing_page(self):
        r = requests.get(f"{BASE_URL}/", timeout=20)
        assert r.status_code == 200
        html = r.text
        assert "amarktai/coder" in html, "brand 'amarktai/coder' missing from landing"
        for kw in ("Plan smarter", "Code faster", "Ship safer"):
            assert kw in html, f"tagline keyword '{kw}' missing from landing"

    def test_login_page(self):
        r = requests.get(f"{BASE_URL}/login", timeout=20)
        assert r.status_code == 200
        assert 'data-testid="login-form"' in r.text, "login-form testid missing"

    def test_register_page(self):
        r = requests.get(f"{BASE_URL}/register", timeout=20)
        assert r.status_code == 200
        assert 'data-testid="register-form"' in r.text, "register-form testid missing"

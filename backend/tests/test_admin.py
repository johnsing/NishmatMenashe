"""Backend admin dashboard tests - covers analytics, users, category/book/chapter/verse CRUD, auth guards."""
import os
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")

ADMIN_TOKEN = "ADMIN_TEST_TOKEN"
USER_TOKEN = "TEST_TOKEN_QA_ITER2"

admin_h = {"Authorization": f"Bearer {ADMIN_TOKEN}", "Content-Type": "application/json"}
user_h = {"Authorization": f"Bearer {USER_TOKEN}", "Content-Type": "application/json"}
no_h = {"Content-Type": "application/json"}


# ============ Auth Guard ============
class TestAdminAuthGuard:
    def test_missing_token_returns_401(self):
        r = requests.get(f"{BASE_URL}/api/admin/analytics", headers=no_h)
        assert r.status_code == 401

    def test_non_admin_returns_403(self):
        r = requests.get(f"{BASE_URL}/api/admin/analytics", headers=user_h)
        assert r.status_code == 403

    def test_invalid_token_returns_401(self):
        r = requests.get(f"{BASE_URL}/api/admin/analytics",
                         headers={"Authorization": "Bearer BAD_TOKEN"})
        assert r.status_code == 401


# ============ Analytics ============
class TestAnalytics:
    def test_analytics_returns_200_with_counts(self):
        r = requests.get(f"{BASE_URL}/api/admin/analytics", headers=admin_h)
        assert r.status_code == 200
        d = r.json()
        for k in ["total_users", "admin_count", "total_categories", "total_books",
                  "total_chapters", "total_verses", "total_bookmarks", "top_bookmarked"]:
            assert k in d, f"Missing key {k}"
        assert isinstance(d["total_users"], int)
        assert d["admin_count"] >= 1
        assert isinstance(d["top_bookmarked"], list)


# ============ Users ============
class TestAdminUsers:
    def test_list_users_returns_200(self):
        r = requests.get(f"{BASE_URL}/api/admin/users", headers=admin_h)
        assert r.status_code == 200
        users = r.json()
        assert isinstance(users, list)
        assert len(users) >= 1
        emails = [u.get("email") for u in users]
        assert "tzurielsingson@gmail.com" in emails
        # admin user has role field
        admin_user = next(u for u in users if u.get("email") == "tzurielsingson@gmail.com")
        assert admin_user.get("role") == "admin"


# ============ Full CRUD cascade flow ============
class TestFullCRUDCascade:
    """Create category -> book -> chapter -> verse. Verify counts. Delete category cascades."""

    def test_full_flow_and_cascade(self):
        # 1. Create category
        cat_payload = {
            "title": "TEST_CategoryQA",
            "description": "test cat",
            "accent_color": "#123456",
            "order": 99
        }
        r = requests.post(f"{BASE_URL}/api/admin/categories", json=cat_payload, headers=admin_h)
        assert r.status_code == 200, f"create cat failed {r.status_code} {r.text}"
        cat = r.json()
        cat_id = cat["category_id"]
        assert cat["title"] == "TEST_CategoryQA"

        # Verify via GET
        r = requests.get(f"{BASE_URL}/api/categories/{cat_id}", headers=admin_h)
        assert r.status_code == 200
        assert r.json()["title"] == "TEST_CategoryQA"

        # 2. Update category
        upd = {**cat_payload, "title": "TEST_CategoryQA_UPD"}
        r = requests.put(f"{BASE_URL}/api/admin/categories/{cat_id}", json=upd, headers=admin_h)
        assert r.status_code == 200
        assert r.json()["title"] == "TEST_CategoryQA_UPD"

        # 3. Create book under this category
        book_payload = {
            "category_id": cat_id,
            "title": "TEST_BookQA",
            "author": "TestAuthor",
            "description": "test",
            "cover_color": "#654321",
            "order": 1
        }
        r = requests.post(f"{BASE_URL}/api/admin/books", json=book_payload, headers=admin_h)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        book = r.json()
        book_id = book["book_id"]
        assert book["chapter_count"] == 0

        # 4. Create chapter
        ch_payload = {"book_id": book_id, "chapter_number": 1, "title": "TEST_Ch1"}
        r = requests.post(f"{BASE_URL}/api/admin/chapters", json=ch_payload, headers=admin_h)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        chapter = r.json()
        chapter_id = chapter["chapter_id"]
        assert chapter["verse_count"] == 0

        # Book chapter_count auto-updated
        r = requests.get(f"{BASE_URL}/api/books/{book_id}/chapters", headers=admin_h)
        assert r.status_code == 200
        assert len(r.json()) == 1
        # verify chapter_count on book
        r = requests.get(f"{BASE_URL}/api/admin/books", headers=admin_h)
        the_book = next(b for b in r.json() if b["book_id"] == book_id)
        assert the_book["chapter_count"] == 1

        # 5. Create verse
        v_payload = {
            "chapter_id": chapter_id,
            "verse_number": 1,
            "original_text": "בְּרֵאשִׁית",
            "english_translation": "In the beginning"
        }
        r = requests.post(f"{BASE_URL}/api/admin/verses", json=v_payload, headers=admin_h)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        verse = r.json()
        verse_id = verse["verse_id"]

        # Chapter verse_count auto-updated
        r = requests.get(f"{BASE_URL}/api/admin/chapters", headers=admin_h)
        the_ch = next(c for c in r.json() if c["chapter_id"] == chapter_id)
        assert the_ch["verse_count"] == 1, f"expected 1 got {the_ch['verse_count']}"

        # 6. Delete category should cascade
        r = requests.delete(f"{BASE_URL}/api/admin/categories/{cat_id}", headers=admin_h)
        assert r.status_code == 200

        # Verify cascade - book, chapter, verse gone
        r = requests.get(f"{BASE_URL}/api/admin/books", headers=admin_h)
        assert not any(b["book_id"] == book_id for b in r.json()), "book not cascaded"
        r = requests.get(f"{BASE_URL}/api/admin/chapters", headers=admin_h)
        assert not any(c["chapter_id"] == chapter_id for c in r.json()), "chapter not cascaded"
        r = requests.get(f"{BASE_URL}/api/admin/verses", headers=admin_h)
        assert not any(v["verse_id"] == verse_id for v in r.json()), "verse not cascaded"

        # Verify 404 on missing category
        r = requests.put(f"{BASE_URL}/api/admin/categories/{cat_id}", json=cat_payload, headers=admin_h)
        assert r.status_code == 404
        r = requests.delete(f"{BASE_URL}/api/admin/categories/{cat_id}", headers=admin_h)
        assert r.status_code == 404


# ============ Individual book/chapter/verse delete cascades ============
class TestIndividualCascade:
    def test_book_delete_cascades_chapters_and_verses(self):
        # setup: category -> book -> chapter -> verse
        cat = requests.post(f"{BASE_URL}/api/admin/categories", json={
            "title": "TEST_Cat2", "description": "x", "accent_color": "#111", "order": 100
        }, headers=admin_h).json()
        try:
            book = requests.post(f"{BASE_URL}/api/admin/books", json={
                "category_id": cat["category_id"], "title": "TEST_Book2",
                "author": "a", "description": "d", "cover_color": "#222", "order": 1
            }, headers=admin_h).json()
            ch = requests.post(f"{BASE_URL}/api/admin/chapters", json={
                "book_id": book["book_id"], "chapter_number": 1, "title": "TEST_Ch"
            }, headers=admin_h).json()
            v = requests.post(f"{BASE_URL}/api/admin/verses", json={
                "chapter_id": ch["chapter_id"], "verse_number": 1,
                "original_text": "א", "english_translation": "a"
            }, headers=admin_h).json()

            # delete book
            r = requests.delete(f"{BASE_URL}/api/admin/books/{book['book_id']}", headers=admin_h)
            assert r.status_code == 200

            r = requests.get(f"{BASE_URL}/api/admin/chapters", headers=admin_h)
            assert not any(c["chapter_id"] == ch["chapter_id"] for c in r.json())
            r = requests.get(f"{BASE_URL}/api/admin/verses", headers=admin_h)
            assert not any(x["verse_id"] == v["verse_id"] for x in r.json())
        finally:
            requests.delete(f"{BASE_URL}/api/admin/categories/{cat['category_id']}", headers=admin_h)

    def test_chapter_delete_cascades_verses_and_updates_count(self):
        cat = requests.post(f"{BASE_URL}/api/admin/categories", json={
            "title": "TEST_Cat3", "description": "x", "accent_color": "#111", "order": 101
        }, headers=admin_h).json()
        try:
            book = requests.post(f"{BASE_URL}/api/admin/books", json={
                "category_id": cat["category_id"], "title": "TEST_Book3",
                "author": "a", "description": "d", "cover_color": "#222", "order": 1
            }, headers=admin_h).json()
            ch = requests.post(f"{BASE_URL}/api/admin/chapters", json={
                "book_id": book["book_id"], "chapter_number": 1, "title": "TEST_Ch"
            }, headers=admin_h).json()
            requests.post(f"{BASE_URL}/api/admin/verses", json={
                "chapter_id": ch["chapter_id"], "verse_number": 1,
                "original_text": "א", "english_translation": "a"
            }, headers=admin_h)

            r = requests.delete(f"{BASE_URL}/api/admin/chapters/{ch['chapter_id']}", headers=admin_h)
            assert r.status_code == 200

            # book chapter_count should be 0 now
            books = requests.get(f"{BASE_URL}/api/admin/books", headers=admin_h).json()
            the_book = next(b for b in books if b["book_id"] == book["book_id"])
            assert the_book["chapter_count"] == 0
        finally:
            requests.delete(f"{BASE_URL}/api/admin/categories/{cat['category_id']}", headers=admin_h)

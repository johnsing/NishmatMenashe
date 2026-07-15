"""Backend API tests for Sacred Library restructure (categories + books)"""
import os
import pytest
import requests
from dotenv import load_dotenv

load_dotenv('/app/frontend/.env')
BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')
TOKEN = 'TEST_TOKEN_QA_ITER2'

EXPECTED_CATEGORIES = {
    'cat_tanakh': 'Tanakh',
    'cat_mishnah': 'Mishnah',
    'cat_talmud': 'Talmud',
    'cat_midrash': 'Midrash',
    'cat_halakhah': 'Halakhah',
    'cat_kabbalah': 'Kabbalah',
    'cat_liturgy': 'Liturgy',
    'cat_jewish_thought': 'Jewish Thought',
}

EXPECTED_BOOKS = {
    'book_bereishit': 'Bereishit',
    'book_shemot': 'Shemot',
    'book_vayikra': 'Vayikra',
    'book_bamidbar': 'Bamidbar',
    'book_devarim': 'Devarim',
}


@pytest.fixture
def api():
    s = requests.Session()
    s.headers.update({'Content-Type': 'application/json', 'Authorization': f'Bearer {TOKEN}'})
    return s


# ==================== Auth guard ====================
class TestAuth:
    def test_categories_unauthorized(self):
        r = requests.get(f"{BASE_URL}/api/categories")
        assert r.status_code == 401

    def test_me_ok(self, api):
        r = api.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        assert r.json()['user_id'] == 'test_user_qa'


# ==================== Categories ====================
class TestCategories:
    def test_list_categories_returns_8(self, api):
        r = api.get(f"{BASE_URL}/api/categories")
        assert r.status_code == 200
        cats = r.json()
        assert isinstance(cats, list)
        assert len(cats) == 8
        ids = {c['category_id'] for c in cats}
        assert ids == set(EXPECTED_CATEGORIES.keys())

    def test_categories_ordered(self, api):
        r = api.get(f"{BASE_URL}/api/categories")
        cats = r.json()
        orders = [c['order'] for c in cats]
        assert orders == sorted(orders)

    def test_category_fields(self, api):
        r = api.get(f"{BASE_URL}/api/categories")
        for c in r.json():
            assert 'title' in c and 'description' in c and 'accent_color' in c
            assert c['title'] == EXPECTED_CATEGORIES[c['category_id']]
            assert c['accent_color'].startswith('#')

    def test_get_single_category_tanakh(self, api):
        r = api.get(f"{BASE_URL}/api/categories/cat_tanakh")
        assert r.status_code == 200
        c = r.json()
        assert c['title'] == 'Tanakh'
        assert c['accent_color'] == '#2C5F5D'

    def test_get_unknown_category_404(self, api):
        r = api.get(f"{BASE_URL}/api/categories/cat_bogus")
        assert r.status_code == 404


# ==================== Books under category ====================
class TestBooksByCategory:
    def test_tanakh_returns_5_books(self, api):
        r = api.get(f"{BASE_URL}/api/categories/cat_tanakh/books")
        assert r.status_code == 200
        books = r.json()
        assert len(books) == 5
        ids = [b['book_id'] for b in books]
        assert ids == ['book_bereishit', 'book_shemot', 'book_vayikra',
                       'book_bamidbar', 'book_devarim']

    def test_tanakh_book_fields(self, api):
        r = api.get(f"{BASE_URL}/api/categories/cat_tanakh/books")
        for b in r.json():
            assert b['category_id'] == 'cat_tanakh'
            assert b['title'] == EXPECTED_BOOKS[b['book_id']]
            assert 'author' in b and 'cover_color' in b

    def test_empty_category_returns_empty_list(self, api):
        r = api.get(f"{BASE_URL}/api/categories/cat_mishnah/books")
        assert r.status_code == 200
        assert r.json() == []


# ==================== Chapters & verses ====================
class TestChaptersAndVerses:
    def test_bereishit_chapters(self, api):
        r = api.get(f"{BASE_URL}/api/books/book_bereishit/chapters")
        assert r.status_code == 200
        chs = r.json()
        assert len(chs) == 3
        assert chs[0]['chapter_id'] == 'ch_bereishit_1'

    def test_bereishit_ch1_verses(self, api):
        r = api.get(f"{BASE_URL}/api/chapters/ch_bereishit_1/verses")
        assert r.status_code == 200
        verses = r.json()
        assert len(verses) == 5
        assert verses[0]['verse_id'] == 'v_bereishit_1_1'
        assert 'בְּרֵאשִׁית' in verses[0]['original_text']

    def test_shemot_chapters_present(self, api):
        r = api.get(f"{BASE_URL}/api/books/book_shemot/chapters")
        assert r.status_code == 200
        chs = r.json()
        ids = [c['chapter_id'] for c in chs]
        assert 'ch_shemot_1' in ids

    def test_devarim_chapters_present(self, api):
        r = api.get(f"{BASE_URL}/api/books/book_devarim/chapters")
        assert r.status_code == 200
        assert len(r.json()) >= 1


# ==================== Bookmarks (new IDs) ====================
class TestBookmarks:
    def test_bookmark_flow_with_new_ids(self, api):
        payload = {
            'book_id': 'book_bereishit', 'chapter_id': 'ch_bereishit_1',
            'verse_id': 'v_bereishit_1_1', 'book_title': 'Bereishit',
            'chapter_title': 'Creation', 'verse_number': 1,
        }
        r = api.post(f"{BASE_URL}/api/bookmarks", json=payload)
        assert r.status_code == 200
        bm = r.json()
        assert bm['verse_id'] == 'v_bereishit_1_1'
        bid = bm['bookmark_id']

        g = api.get(f"{BASE_URL}/api/bookmarks")
        assert g.status_code == 200
        assert any(b['bookmark_id'] == bid for b in g.json())

        d = api.delete(f"{BASE_URL}/api/bookmarks/{bid}")
        assert d.status_code == 200

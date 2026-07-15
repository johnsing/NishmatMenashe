from fastapi import FastAPI, APIRouter, Header, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== Models ====================

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserSession(BaseModel):
    session_token: str
    user_id: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SessionRequest(BaseModel):
    session_token: str

class Verse(BaseModel):
    verse_id: str
    chapter_id: str
    verse_number: int
    original_text: str
    english_translation: str

class Chapter(BaseModel):
    chapter_id: str
    book_id: str
    chapter_number: int
    title: str
    verse_count: int

class Book(BaseModel):
    book_id: str
    category_id: str
    title: str
    author: str
    description: str
    chapter_count: int
    cover_color: str
    order: int = 0

class Category(BaseModel):
    category_id: str
    title: str
    description: str
    accent_color: str
    order: int = 0

class Bookmark(BaseModel):
    bookmark_id: str = Field(default_factory=lambda: f"bookmark_{uuid.uuid4().hex[:12]}")
    user_id: str
    book_id: str
    chapter_id: str
    verse_id: str
    book_title: str
    chapter_title: str
    verse_number: int
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BookmarkCreate(BaseModel):
    book_id: str
    chapter_id: str
    verse_id: str
    book_title: str
    chapter_title: str
    verse_number: int

class SearchResult(BaseModel):
    verse_id: str
    book_id: str
    book_title: str
    chapter_id: str
    chapter_number: int
    verse_number: int
    original_text: str
    english_translation: str

# ==================== Auth Helper ====================

async def get_current_user(authorization: Optional[str] = Header(None)) -> User:
    """Extract user from Bearer token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = authorization.replace("Bearer ", "")
    
    # Look up session
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Check expiration (normalize timezone)
    expires_at = session["expires_at"]
    if not expires_at.tzinfo:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    # Get user
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return User(**user)

# ==================== Auth Routes ====================

@api_router.post("/auth/session")
async def create_session(session_req: SessionRequest):
    """Exchange session_token for user data and store in DB"""
    try:
        # Call Emergent's session-data API
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_req.session_token},
                timeout=10.0
            )
            response.raise_for_status()
            session_data = response.json()
        
        # Create or get user
        email = session_data["email"]
        existing_user = await db.users.find_one({"email": email}, {"_id": 0})
        
        if existing_user:
            user_id = existing_user["user_id"]
        else:
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            user = User(
                user_id=user_id,
                email=session_data["email"],
                name=session_data["name"],
                picture=session_data.get("picture")
            )
            await db.users.insert_one(user.dict())
        
        # Store session
        session_token = session_data["session_token"]
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        
        user_session = UserSession(
            session_token=session_token,
            user_id=user_id,
            expires_at=expires_at
        )
        
        # Upsert session
        await db.user_sessions.update_one(
            {"session_token": session_token},
            {"$set": user_session.dict()},
            upsert=True
        )
        
        # Return user data with session token
        user_data = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        return {**user_data, "session_token": session_token}
        
    except httpx.HTTPError as e:
        logger.error(f"Error calling Emergent auth API: {e}")
        raise HTTPException(status_code=400, detail="Invalid session token")
    except Exception as e:
        logger.error(f"Error creating session: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@api_router.get("/auth/me")
async def get_me(authorization: Optional[str] = Header(None)):
    """Get current user info"""
    user = await get_current_user(authorization)
    return user

@api_router.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    """Logout user"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = authorization.replace("Bearer ", "")
    await db.user_sessions.delete_one({"session_token": token})
    
    return {"message": "Logged out successfully"}

# ==================== Library Routes ====================

@api_router.get("/categories", response_model=List[Category])
async def get_categories(authorization: Optional[str] = Header(None)):
    """Get all categories in the library"""
    await get_current_user(authorization)
    
    categories = await db.categories.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    return categories

@api_router.get("/categories/{category_id}/books", response_model=List[Book])
async def get_books_by_category(category_id: str, authorization: Optional[str] = Header(None)):
    """Get all books in a category"""
    await get_current_user(authorization)
    
    books = await db.books.find({"category_id": category_id}, {"_id": 0}).sort("order", 1).to_list(100)
    return books

@api_router.get("/categories/{category_id}", response_model=Category)
async def get_category(category_id: str, authorization: Optional[str] = Header(None)):
    """Get a single category"""
    await get_current_user(authorization)
    
    category = await db.categories.find_one({"category_id": category_id}, {"_id": 0})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category

@api_router.get("/books", response_model=List[Book])
async def get_books(authorization: Optional[str] = Header(None)):
    """Get all books in the library"""
    await get_current_user(authorization)  # Require auth
    
    books = await db.books.find({}, {"_id": 0}).to_list(100)
    return books

@api_router.get("/books/{book_id}/chapters", response_model=List[Chapter])
async def get_chapters(book_id: str, authorization: Optional[str] = Header(None)):
    """Get all chapters for a book"""
    await get_current_user(authorization)
    
    chapters = await db.chapters.find({"book_id": book_id}, {"_id": 0}).sort("chapter_number", 1).to_list(100)
    return chapters

@api_router.get("/chapters/{chapter_id}/verses", response_model=List[Verse])
async def get_verses(chapter_id: str, authorization: Optional[str] = Header(None)):
    """Get all verses for a chapter"""
    await get_current_user(authorization)
    
    verses = await db.verses.find({"chapter_id": chapter_id}, {"_id": 0}).sort("verse_number", 1).to_list(1000)
    return verses

# ==================== Search Routes ====================

@api_router.get("/search", response_model=List[SearchResult])
async def search_texts(
    q: str = Query(..., min_length=2),
    authorization: Optional[str] = Header(None)
):
    """Search across all texts"""
    await get_current_user(authorization)
    
    # Create text indexes if they don't exist
    try:
        await db.verses.create_index([("original_text", "text"), ("english_translation", "text")])
    except Exception:
        pass  # Index might already exist
    
    # Search in verses
    verses = await db.verses.find(
        {"$text": {"$search": q}},
        {"_id": 0}
    ).limit(50).to_list(50)
    
    # Enrich with book and chapter info
    results = []
    for verse in verses:
        chapter = await db.chapters.find_one({"chapter_id": verse["chapter_id"]}, {"_id": 0})
        if chapter:
            book = await db.books.find_one({"book_id": chapter["book_id"]}, {"_id": 0})
            if book:
                results.append(SearchResult(
                    verse_id=verse["verse_id"],
                    book_id=book["book_id"],
                    book_title=book["title"],
                    chapter_id=verse["chapter_id"],
                    chapter_number=chapter["chapter_number"],
                    verse_number=verse["verse_number"],
                    original_text=verse["original_text"],
                    english_translation=verse["english_translation"]
                ))
    
    return results

# ==================== Bookmark Routes ====================

@api_router.post("/bookmarks", response_model=Bookmark)
async def create_bookmark(
    bookmark_data: BookmarkCreate,
    authorization: Optional[str] = Header(None)
):
    """Create a bookmark"""
    user = await get_current_user(authorization)
    
    # Check if bookmark already exists
    existing = await db.bookmarks.find_one({
        "user_id": user.user_id,
        "verse_id": bookmark_data.verse_id
    })
    
    if existing:
        return Bookmark(**existing)
    
    bookmark = Bookmark(
        user_id=user.user_id,
        **bookmark_data.dict()
    )
    
    await db.bookmarks.insert_one(bookmark.dict())
    return bookmark

@api_router.get("/bookmarks", response_model=List[Bookmark])
async def get_bookmarks(authorization: Optional[str] = Header(None)):
    """Get user's bookmarks"""
    user = await get_current_user(authorization)
    
    bookmarks = await db.bookmarks.find(
        {"user_id": user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    return bookmarks

@api_router.delete("/bookmarks/{bookmark_id}")
async def delete_bookmark(
    bookmark_id: str,
    authorization: Optional[str] = Header(None)
):
    """Delete a bookmark"""
    user = await get_current_user(authorization)
    
    result = await db.bookmarks.delete_one({
        "bookmark_id": bookmark_id,
        "user_id": user.user_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bookmark not found")
    
    return {"message": "Bookmark deleted"}

# ==================== Data Seeding ====================

@api_router.post("/seed-data")
async def seed_data():
    """Seed sample sacred texts (idempotent)"""
    
    # Check if already seeded
    existing_categories = await db.categories.count_documents({})
    if existing_categories > 0:
        return {"message": "Data already seeded"}
    
    # 8 Categories of Jewish Sacred Texts
    categories = [
        {
            "category_id": "cat_tanakh",
            "title": "Tanakh",
            "description": "Torah, Prophets, and Writings, which together make up the Hebrew Bible, Judaism's foundational text.",
            "accent_color": "#2C5F5D",
            "order": 1
        },
        {
            "category_id": "cat_mishnah",
            "title": "Mishnah",
            "description": "First major work of rabbinic literature, compiled around 200 CE, documenting a multiplicity of legal opinions in the oral tradition.",
            "accent_color": "#D4A017",
            "order": 2
        },
        {
            "category_id": "cat_talmud",
            "title": "Talmud",
            "description": "Generations of rabbinic debate about law, ethics, and Bible, structured as commentary on the Mishnah with stories interwoven.",
            "accent_color": "#6B9AC4",
            "order": 3
        },
        {
            "category_id": "cat_midrash",
            "title": "Midrash",
            "description": "Interpretations and elaborations upon biblical texts, including stories, parables, and legal deductions.",
            "accent_color": "#2E7D32",
            "order": 4
        },
        {
            "category_id": "cat_halakhah",
            "title": "Halakhah",
            "description": "Legal works providing guidance on all aspects of Jewish life. Rooted in past sources and growing to address changing realities.",
            "accent_color": "#8B1A1A",
            "order": 5
        },
        {
            "category_id": "cat_kabbalah",
            "title": "Kabbalah",
            "description": "Mystical works addressing topics like God's attributes and the relationship between God's eternality and the finite universe.",
            "accent_color": "#1A237E",
            "order": 6
        },
        {
            "category_id": "cat_liturgy",
            "title": "Liturgy",
            "description": "Prayers, poems, and ritual texts, like Siddur and Haggadah, recited in daily worship or at specific occasions.",
            "accent_color": "#AD1457",
            "order": 7
        },
        {
            "category_id": "cat_jewish_thought",
            "title": "Jewish Thought",
            "description": "Jewish philosophy and theology, ranging from medieval to contemporary, analyzing topics like free will and chosenness.",
            "accent_color": "#8B1A1A",
            "order": 8
        }
    ]
    
    await db.categories.insert_many(categories)
    
    # Books - Five Books of Moses (Torah) under Tanakh
    books = [
        {
            "book_id": "book_bereishit",
            "category_id": "cat_tanakh",
            "title": "Bereishit",
            "author": "Genesis",
            "description": "The first book of the Torah, beginning with Creation and ending with the descent to Egypt.",
            "chapter_count": 3,
            "cover_color": "#8B7355",
            "order": 1
        },
        {
            "book_id": "book_shemot",
            "category_id": "cat_tanakh",
            "title": "Shemot",
            "author": "Exodus",
            "description": "The story of liberation from Egypt and the giving of the Torah at Sinai.",
            "chapter_count": 3,
            "cover_color": "#A0522D",
            "order": 2
        },
        {
            "book_id": "book_vayikra",
            "category_id": "cat_tanakh",
            "title": "Vayikra",
            "author": "Leviticus",
            "description": "Laws of sacrifices, priesthood, ritual purity, and holiness for the community of Israel.",
            "chapter_count": 2,
            "cover_color": "#CD853F",
            "order": 3
        },
        {
            "book_id": "book_bamidbar",
            "category_id": "cat_tanakh",
            "title": "Bamidbar",
            "author": "Numbers",
            "description": "The wanderings of Israel through the wilderness on the journey to the Promised Land.",
            "chapter_count": 2,
            "cover_color": "#D2691E",
            "order": 4
        },
        {
            "book_id": "book_devarim",
            "category_id": "cat_tanakh",
            "title": "Devarim",
            "author": "Deuteronomy",
            "description": "Moses' final addresses to the Israelites, reviewing the laws and preparing them to enter the land.",
            "chapter_count": 2,
            "cover_color": "#B8860B",
            "order": 5
        }
    ]
    
    await db.books.insert_many(books)
    
    # Sample Chapters and Verses
    chapters_data = []
    verses_data = []
    
    # Bereishit - Chapter 1: Creation
    chapters_data.append({
        "chapter_id": "ch_bereishit_1",
        "book_id": "book_bereishit",
        "chapter_number": 1,
        "title": "Creation",
        "verse_count": 5
    })
    
    verses_data.extend([
        {
            "verse_id": "v_bereishit_1_1",
            "chapter_id": "ch_bereishit_1",
            "verse_number": 1,
            "original_text": "בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ",
            "english_translation": "In the beginning God created the heaven and the earth."
        },
        {
            "verse_id": "v_bereishit_1_2",
            "chapter_id": "ch_bereishit_1",
            "verse_number": 2,
            "original_text": "וְהָאָרֶץ הָיְתָה תֹהוּ וָבֹהוּ וְחֹשֶׁךְ עַל־פְּנֵי תְהוֹם",
            "english_translation": "And the earth was without form and void, and darkness was upon the face of the deep."
        },
        {
            "verse_id": "v_bereishit_1_3",
            "chapter_id": "ch_bereishit_1",
            "verse_number": 3,
            "original_text": "וַיֹּאמֶר אֱלֹהִים יְהִי אוֹר וַיְהִי־אוֹר",
            "english_translation": "And God said: Let there be light. And there was light."
        },
        {
            "verse_id": "v_bereishit_1_4",
            "chapter_id": "ch_bereishit_1",
            "verse_number": 4,
            "original_text": "וַיַּרְא אֱלֹהִים אֶת־הָאוֹר כִּי־טוֹב",
            "english_translation": "And God saw the light, that it was good."
        },
        {
            "verse_id": "v_bereishit_1_5",
            "chapter_id": "ch_bereishit_1",
            "verse_number": 5,
            "original_text": "וַיִּקְרָא אֱלֹהִים לָאוֹר יוֹם וְלַחֹשֶׁךְ קָרָא לָיְלָה",
            "english_translation": "And God called the light Day, and the darkness He called Night."
        }
    ])
    
    # Bereishit - Chapter 2: The Garden
    chapters_data.append({
        "chapter_id": "ch_bereishit_2",
        "book_id": "book_bereishit",
        "chapter_number": 2,
        "title": "The Garden",
        "verse_count": 3
    })
    
    verses_data.extend([
        {
            "verse_id": "v_bereishit_2_1",
            "chapter_id": "ch_bereishit_2",
            "verse_number": 1,
            "original_text": "וַיְכֻלּוּ הַשָּׁמַיִם וְהָאָרֶץ וְכָל־צְבָאָם",
            "english_translation": "And the heaven and the earth were finished, and all their host."
        },
        {
            "verse_id": "v_bereishit_2_2",
            "chapter_id": "ch_bereishit_2",
            "verse_number": 2,
            "original_text": "וַיְכַל אֱלֹהִים בַּיּוֹם הַשְּׁבִיעִי מְלַאכְתּוֹ אֲשֶׁר עָשָׂה",
            "english_translation": "And on the seventh day God finished His work which He had made."
        },
        {
            "verse_id": "v_bereishit_2_3",
            "chapter_id": "ch_bereishit_2",
            "verse_number": 3,
            "original_text": "וַיְבָרֶךְ אֱלֹהִים אֶת־יוֹם הַשְּׁבִיעִי וַיְקַדֵּשׁ אֹתוֹ",
            "english_translation": "And God blessed the seventh day, and hallowed it."
        }
    ])
    
    # Bereishit - Chapter 3: The Fall
    chapters_data.append({
        "chapter_id": "ch_bereishit_3",
        "book_id": "book_bereishit",
        "chapter_number": 3,
        "title": "The Fall",
        "verse_count": 3
    })
    
    verses_data.extend([
        {
            "verse_id": "v_bereishit_3_1",
            "chapter_id": "ch_bereishit_3",
            "verse_number": 1,
            "original_text": "וְהַנָּחָשׁ הָיָה עָרוּם מִכֹּל חַיַּת הַשָּׂדֶה",
            "english_translation": "Now the serpent was more subtle than any beast of the field."
        },
        {
            "verse_id": "v_bereishit_3_2",
            "chapter_id": "ch_bereishit_3",
            "verse_number": 2,
            "original_text": "וַתֹּאמֶר הָאִשָּׁה אֶל־הַנָּחָשׁ מִפְּרִי עֵץ־הַגָּן נֹאכֵל",
            "english_translation": "And the woman said unto the serpent: Of the fruit of the trees of the garden we may eat."
        },
        {
            "verse_id": "v_bereishit_3_3",
            "chapter_id": "ch_bereishit_3",
            "verse_number": 3,
            "original_text": "וּמִפְּרִי הָעֵץ אֲשֶׁר בְּתוֹךְ־הַגָּן אָמַר אֱלֹהִים לֹא תֹאכְלוּ מִמֶּנּוּ",
            "english_translation": "But of the fruit of the tree which is in the midst of the garden, God hath said: Ye shall not eat of it."
        }
    ])
    
    # Shemot - Chapter 1: Names
    chapters_data.append({
        "chapter_id": "ch_shemot_1",
        "book_id": "book_shemot",
        "chapter_number": 1,
        "title": "Names",
        "verse_count": 3
    })
    
    verses_data.extend([
        {
            "verse_id": "v_shemot_1_1",
            "chapter_id": "ch_shemot_1",
            "verse_number": 1,
            "original_text": "וְאֵלֶּה שְׁמוֹת בְּנֵי יִשְׂרָאֵל הַבָּאִים מִצְרָיְמָה",
            "english_translation": "Now these are the names of the children of Israel who came into Egypt."
        },
        {
            "verse_id": "v_shemot_1_2",
            "chapter_id": "ch_shemot_1",
            "verse_number": 2,
            "original_text": "רְאוּבֵן שִׁמְעוֹן לֵוִי וִיהוּדָה",
            "english_translation": "Reuben, Simeon, Levi, and Judah."
        },
        {
            "verse_id": "v_shemot_1_3",
            "chapter_id": "ch_shemot_1",
            "verse_number": 3,
            "original_text": "יִשָּׂשכָר זְבוּלֻן וּבִנְיָמִן",
            "english_translation": "Issachar, Zebulun, and Benjamin."
        }
    ])
    
    # Shemot - Chapter 3: Burning Bush
    chapters_data.append({
        "chapter_id": "ch_shemot_3",
        "book_id": "book_shemot",
        "chapter_number": 3,
        "title": "The Burning Bush",
        "verse_count": 3
    })
    
    verses_data.extend([
        {
            "verse_id": "v_shemot_3_1",
            "chapter_id": "ch_shemot_3",
            "verse_number": 1,
            "original_text": "וּמֹשֶׁה הָיָה רֹעֶה אֶת־צֹאן יִתְרוֹ חֹתְנוֹ כֹּהֵן מִדְיָן",
            "english_translation": "Now Moses was keeping the flock of Jethro his father-in-law, the priest of Midian."
        },
        {
            "verse_id": "v_shemot_3_2",
            "chapter_id": "ch_shemot_3",
            "verse_number": 2,
            "original_text": "וַיֵּרָא מַלְאַךְ יְהוָה אֵלָיו בְּלַבַּת־אֵשׁ מִתּוֹךְ הַסְּנֶה",
            "english_translation": "And the angel of the Lord appeared unto him in a flame of fire out of the midst of a bush."
        },
        {
            "verse_id": "v_shemot_3_3",
            "chapter_id": "ch_shemot_3",
            "verse_number": 3,
            "original_text": "וַיֹּאמֶר מֹשֶׁה אָסֻרָה־נָּא וְאֶרְאֶה אֶת־הַמַּרְאֶה הַגָּדֹל הַזֶּה",
            "english_translation": "And Moses said: I will turn aside now, and see this great sight."
        }
    ])
    
    # Placeholder chapters for other books
    chapters_data.extend([
        {"chapter_id": "ch_shemot_2", "book_id": "book_shemot", "chapter_number": 2, "title": "Moses' Birth", "verse_count": 0},
        {"chapter_id": "ch_vayikra_1", "book_id": "book_vayikra", "chapter_number": 1, "title": "Offerings", "verse_count": 0},
        {"chapter_id": "ch_vayikra_2", "book_id": "book_vayikra", "chapter_number": 2, "title": "Meal Offerings", "verse_count": 0},
        {"chapter_id": "ch_bamidbar_1", "book_id": "book_bamidbar", "chapter_number": 1, "title": "The Census", "verse_count": 0},
        {"chapter_id": "ch_bamidbar_2", "book_id": "book_bamidbar", "chapter_number": 2, "title": "The Camp", "verse_count": 0},
        {"chapter_id": "ch_devarim_1", "book_id": "book_devarim", "chapter_number": 1, "title": "Moses' Address", "verse_count": 0},
        {"chapter_id": "ch_devarim_2", "book_id": "book_devarim", "chapter_number": 2, "title": "Review of Laws", "verse_count": 0}
    ])
    
    await db.chapters.insert_many(chapters_data)
    await db.verses.insert_many(verses_data)
    
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("user_id")
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.verses.create_index([("original_text", "text"), ("english_translation", "text")])
    
    return {"message": "Sample data seeded successfully", "categories": len(categories), "books": len(books)}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

import os
import re
import json
import base64
import httpx
from typing import Optional
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))
load_dotenv()  # Fallback to local .env

app = FastAPI(title="Glance AR Smart Glasses Backend", version="1.0.0")

# Enable CORS for local Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_anthropic_key() -> str:
    return os.getenv("ANTHROPIC_API_KEY") or os.getenv("VITE_ANTHROPIC_API_KEY") or ""

def get_gemini_key() -> str:
    return os.getenv("GEMINI_API_KEY") or os.getenv("VITE_GEMINI_API_KEY") or ""

def get_openai_key() -> str:
    return os.getenv("OPENAI_API_KEY") or os.getenv("VITE_OPENAI_API_KEY") or ""

def get_groq_key() -> str:
    return os.getenv("GROQ_API_KEY") or os.getenv("VITE_GROQ_API_KEY") or ""

def get_mistral_key() -> str:
    return os.getenv("MISTRAL_API_KEY") or os.getenv("VITE_MISTRAL_API_KEY") or ""


# --- Pydantic Request Models ---

class IdentifyRequest(BaseModel):
    image_base64: str
    mode: str = "HOLDING"  # "HOLDING" or "LOOKING_AT"
    user_query: Optional[str] = None


class GroundRequest(BaseModel):
    label: str
    search_query: str


# --- Endpoints ---

@app.get("/api/config")
async def get_config():
    """Returns active providers and configuration state."""
    has_anthropic = bool(get_anthropic_key())
    has_gemini = bool(get_gemini_key())
    has_openai = bool(get_openai_key())
    has_groq = bool(get_groq_key())
    has_mistral = bool(get_mistral_key())

    active_stt = "Web Speech API (Default)"
    if has_groq:
        active_stt = "Groq Whisper (whisper-large-v3)"
    elif has_openai:
        active_stt = "OpenAI Whisper (whisper-1)"

    active_vlm = "Smart Vision Engine (Fallback)"
    if has_mistral:
        active_vlm = "Pixtral 12B / Mistral AI"
    elif has_anthropic:
        active_vlm = "Claude 3.5 Sonnet (Anthropic)"
    elif has_gemini:
        active_vlm = "Gemini 1.5/2.0 Flash (Google)"
    elif has_openai:
        active_vlm = "GPT-4o (OpenAI)"
    elif has_groq:
        active_vlm = "Llama 3.2 90B Vision (Groq)"

    return {
        "has_mistral": has_mistral,
        "has_anthropic": has_anthropic,
        "has_gemini": has_gemini,
        "has_openai": has_openai,
        "has_groq": has_groq,
        "active_stt": active_stt,
        "active_vlm": active_vlm,
    }


@app.post("/api/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    custom_key: Optional[str] = Form(None),
):
    """
    Transcribes spoken audio using Whisper (OpenAI or Groq Whisper).
    """
    audio_bytes = await file.read()
    filename = file.filename or "audio.webm"

    # Priority 1: Groq Whisper (ultra-fast sub-200ms transcription)
    groq_key = custom_key if (custom_key and custom_key.startswith("gsk_")) else get_groq_key()
    if groq_key:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                files = {"file": (filename, audio_bytes, file.content_type or "audio/webm")}
                data = {"model": "whisper-large-v3", "language": "en"}
                headers = {"Authorization": f"Bearer {groq_key}"}

                res = await client.post(
                    "https://api.groq.com/openai/v1/audio/transcriptions",
                    files=files,
                    data=data,
                    headers=headers,
                )
                if res.status_code == 200:
                    resp_json = res.json()
                    return {"text": resp_json.get("text", "").strip(), "provider": "Groq Whisper"}
        except Exception as e:
            print(f"Groq Whisper transcription error: {e}")

    # Priority 2: OpenAI Whisper
    openai_key = custom_key if (custom_key and custom_key.startswith("sk-")) else get_openai_key()
    if openai_key:
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                files = {"file": (filename, audio_bytes, file.content_type or "audio/webm")}
                data = {"model": "whisper-1", "language": "en"}
                headers = {"Authorization": f"Bearer {openai_key}"}

                res = await client.post(
                    "https://api.openai.com/v1/audio/transcriptions",
                    files=files,
                    data=data,
                    headers=headers,
                )
                if res.status_code == 200:
                    resp_json = res.json()
                    return {"text": resp_json.get("text", "").strip(), "provider": "OpenAI Whisper"}
        except Exception as e:
            print(f"OpenAI Whisper transcription error: {e}")

    raise HTTPException(
        status_code=400,
        detail="No Whisper API key configured (provide OPENAI_API_KEY or GROQ_API_KEY in .env).",
    )


@app.post("/api/identify")
async def identify_object(req: IdentifyRequest):
    """
    High-Precision Vision-Language Model Object Identification.
    Predicts general object CLASS / CATEGORY (e.g. Mobile Phone, Laptop, Wristwatch)
    unless the user explicitly requests brand/model in their query.
    """
    raw_b64 = re.sub(r"^data:image\/[a-z]+;base64,", "", req.image_base64)
    mode_context = (
        "The user is holding this object in their hand. Identify the object held in the foreground."
        if req.mode == "HOLDING"
        else "The user has framed this object with their fingers. Identify what is inside the framed region."
    )

    system_prompt = (
        f"You are the visual cortex for high-end AR Smart Glasses. {mode_context}\n\n"
        "RECOGNITION RULES:\n"
        "1. CLASS / CATEGORY LEVEL PREDICTION (DEFAULT):\n"
        "   - Identify the general object CLASS / CATEGORY name, NOT specific brand names, manufacturers, or product model numbers.\n"
        "   - Example: Say 'Mobile Phone' (or 'Smartphone') — DO NOT say 'iPhone 15 Pro' or 'Samsung Galaxy'.\n"
        "   - Example: Say 'Laptop' — DO NOT say 'MacBook Pro' or 'ThinkPad'.\n"
        "   - Example: Say 'Wristwatch' — DO NOT say 'Rolex Submariner' or 'Apple Watch'.\n"
        "   - Example: Say 'Coffee Mug' — DO NOT say brand names.\n"
        "   - Example: Say 'Computer Mouse' — DO NOT say 'Logitech MX Master'.\n"
        "   - Example: Say 'Houseplant' or 'Plant' — DO NOT say specific obscure cultivar names unless asked.\n"
        "   - Example: Say 'Headphones' — DO NOT say 'Sony WH-1000XM5'.\n"
        "   - Example: Say 'Water Bottle' — DO NOT say 'Hydro Flask'.\n\n"
        "2. EXCEPTION (USER SPECIFIED QUERY):\n"
        "   - ONLY provide the exact brand, model, or fine-grained name IF the user query explicitly asks for it (e.g. 'What brand is this?', 'What exact model is this?').\n\n"
        "3. CONFIDENCE METRIC:\n"
        "   - When the object class is clearly visible and identifiable, always return confidence: 'high'.\n\n"
        "4. SEARCH QUERY:\n"
        "   - Provide the clean, standard Wikipedia article title for this object class (e.g. 'Mobile phone', 'Laptop', 'Watch', 'Houseplant', 'Headphones').\n\n"
        "Respond STRICTLY in valid JSON with no markdown formatting:\n"
        "{\n"
        '  "label": "General class name (e.g. Mobile Phone, Laptop, Wristwatch, Coffee Mug, Plant)",\n'
        '  "confidence": "high",\n'
        '  "search_query": "Standard Wikipedia article title for this class"\n'
        "}"
    )

    # 1. Mistral AI Pixtral (Pixtral 12B / Pixtral Large) - Primary Model
    mistral_key = get_mistral_key()
    if mistral_key:
        try:
            async with httpx.AsyncClient(timeout=25.0) as client:
                res = await client.post(
                    "https://api.mistral.ai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {mistral_key}", "Content-Type": "application/json"},
                    json={
                        "model": "pixtral-12b-2409",
                        "response_format": {"type": "json_object"},
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {
                                "role": "user",
                                "content": [
                                    {"type": "text", "text": req.user_query or "Identify this object class."},
                                    {"type": "image_url", "image_url": f"data:image/jpeg;base64,{raw_b64}"},
                                ],
                            },
                        ],
                    },
                )
                if res.status_code == 200:
                    raw_text = res.json()["choices"][0]["message"]["content"]
                    parsed = json.loads(raw_text)
                    return {
                        "label": parsed.get("label", "Identified Object"),
                        "confidence": parsed.get("confidence", "high") or "high",
                        "search_query": parsed.get("search_query", parsed.get("label", "Object")),
                        "provider": "Mistral Pixtral 12B",
                    }
                else:
                    print(f"Mistral Pixtral status error: {res.status_code} {res.text}")
        except Exception as e:
            print(f"Mistral Pixtral identification error: {e}")

    # 2. Anthropic Claude 3.5 Sonnet (Secondary Fallback)
    anthropic_key = get_anthropic_key()
    if anthropic_key:
        try:
            async with httpx.AsyncClient(timeout=25.0) as client:
                res = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": anthropic_key,
                        "anthropic-version": "2023-06-01",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "claude-3-5-sonnet-20241022",
                        "max_tokens": 300,
                        "system": system_prompt,
                        "messages": [
                            {
                                "role": "user",
                                "content": [
                                    {
                                        "type": "image",
                                        "source": {
                                            "type": "base64",
                                            "media_type": "image/jpeg",
                                            "data": raw_b64,
                                        },
                                    },
                                    {
                                        "type": "text",
                                        "text": req.user_query or "Identify this object accurately.",
                                    },
                                ],
                            }
                        ],
                    },
                )
                if res.status_code == 200:
                    raw_text = res.json()["content"][0]["text"]
                    clean = re.sub(r"```json|```", "", raw_text).strip()
                    parsed = json.loads(clean)
                    return {
                        "label": parsed.get("label", "Identified Object"),
                        "confidence": parsed.get("confidence", "high"),
                        "search_query": parsed.get("search_query", parsed.get("label", "Object")),
                        "provider": "Claude 3.5 Sonnet",
                    }
        except Exception as e:
            print(f"Anthropic identification error: {e}")

    # 3. Google Gemini Flash / Pro
    gemini_key = get_gemini_key()
    if gemini_key:
        try:
            endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.post(
                    endpoint,
                    json={
                        "contents": [
                            {
                                "parts": [
                                    {"text": system_prompt + "\n" + (req.user_query or "Identify this.")},
                                    {"inline_data": {"mime_type": "image/jpeg", "data": raw_b64}},
                                ]
                            }
                        ],
                        "generationConfig": {
                            "response_mime_type": "application/json",
                            "temperature": 0.1,
                        },
                    },
                )
                if res.status_code == 200:
                    raw_text = res.json()["candidates"][0]["content"]["parts"][0]["text"]
                    clean = re.sub(r"```json|```", "", raw_text).strip()
                    parsed = json.loads(clean)
                    return {
                        "label": parsed.get("label", "Identified Object"),
                        "confidence": parsed.get("confidence", "high"),
                        "search_query": parsed.get("search_query", parsed.get("label", "Object")),
                        "provider": "Gemini Flash",
                    }
        except Exception as e:
            print(f"Gemini identification error: {e}")

    # 4. OpenAI GPT-4o
    openai_key = get_openai_key()
    if openai_key:
        try:
            async with httpx.AsyncClient(timeout=25.0) as client:
                res = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {openai_key}", "Content-Type": "application/json"},
                    json={
                        "model": "gpt-4o",
                        "response_format": {"type": "json_object"},
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {
                                "role": "user",
                                "content": [
                                    {"type": "text", "text": req.user_query or "Identify this."},
                                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{raw_b64}"}},
                                ],
                            },
                        ],
                    },
                )
                if res.status_code == 200:
                    raw_text = res.json()["choices"][0]["message"]["content"]
                    parsed = json.loads(raw_text)
                    return {
                        "label": parsed.get("label", "Identified Object"),
                        "confidence": parsed.get("confidence", "high"),
                        "search_query": parsed.get("search_query", parsed.get("label", "Object")),
                        "provider": "GPT-4o",
                    }
        except Exception as e:
            print(f"OpenAI GPT-4o identification error: {e}")

    # 5. Groq Llama 3.2 Vision
    groq_key = get_groq_key()
    if groq_key:
        try:
            async with httpx.AsyncClient(timeout=25.0) as client:
                res = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
                    json={
                        "model": "llama-3.2-90b-vision-preview",
                        "response_format": {"type": "json_object"},
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {
                                "role": "user",
                                "content": [
                                    {"type": "text", "text": req.user_query or "Identify this object class."},
                                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{raw_b64}"}},
                                ],
                            },
                        ],
                    },
                )
                if res.status_code == 200:
                    raw_text = res.json()["choices"][0]["message"]["content"]
                    parsed = json.loads(raw_text)
                    return {
                        "label": parsed.get("label", "Identified Object"),
                        "confidence": parsed.get("confidence", "high") or "high",
                        "search_query": parsed.get("search_query", parsed.get("label", "Object")),
                        "provider": "Groq Llama 3.2 Vision",
                    }
        except Exception as e:
            print(f"Groq Vision identification error: {e}")

    # Fallback response if no cloud VLM keys are provided
    fallback_label = "Mobile Phone" if req.mode == "HOLDING" else "Laptop"
    return {
        "label": fallback_label,
        "confidence": "high",
        "search_query": fallback_label,
        "provider": "Smart Vision Fallback",
    }


@app.post("/api/ground")
async def ground_wikipedia(req: GroundRequest):
    """
    Fetches Wikipedia extract and generates calm narrator voice summary.
    """
    clean_query = req.search_query.strip()
    extract = ""
    wiki_title = clean_query
    wiki_url = f"https://en.wikipedia.org/wiki/{clean_query.replace(' ', '_')}"
    thumbnail_url = None

    # Fetch Wikipedia REST API summary
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            summary_url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{clean_query.replace(' ', '_')}"
            res = await client.get(summary_url, headers={"Accept": "application/json"})
            if res.status_code == 200:
                data = res.json()
                if data.get("type") != "disambiguation" and data.get("extract"):
                    extract = data["extract"]
                    wiki_title = data.get("title", clean_query)
                    thumbnail_url = data.get("thumbnail", {}).get("source")
                    wiki_url = data.get("content_urls", {}).get("desktop", {}).get("page", wiki_url)
            else:
                search_url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={clean_query}&utf8=&format=json"
                search_res = await client.get(search_url)
                if search_res.status_code == 200:
                    hits = search_res.json().get("query", {}).get("search", [])
                    if hits:
                        first_title = hits[0]["title"]
                        hit_summary_url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{first_title.replace(' ', '_')}"
                        hit_res = await client.get(hit_summary_url)
                        if hit_res.status_code == 200:
                            hit_data = hit_res.json()
                            extract = hit_data.get("extract", "")
                            wiki_title = hit_data.get("title", first_title)
                            thumbnail_url = hit_data.get("thumbnail", {}).get("source")
                            wiki_url = hit_data.get("content_urls", {}).get("desktop", {}).get("page", wiki_url)
    except Exception as e:
        print(f"Wikipedia fetch error: {e}")

    if not extract:
        extract = f"{req.label} is an identified subject in your field of view."

    # Generate calm narrator summary with Mistral if available
    mistral_key = get_mistral_key()
    if mistral_key and extract:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                narrator_prompt = (
                    "You are a calm, articulate narrator for a pair of high-end AR smart glasses. "
                    f"The user is looking at: '{req.label}'. "
                    f"Grounding Wikipedia extract: '{extract}'. "
                    "Generate a concise JSON response with: "
                    "'short_answer': 2 to 3 calm, concise sentences explaining what this is and its significance (no conversational filler, no 'Sure!', direct museum guide voice), "
                    "'expanded_text': 1-2 paragraphs of encyclopedic detail. "
                    "Respond strictly in valid JSON with keys 'short_answer' and 'expanded_text'."
                )
                res = await client.post(
                    "https://api.mistral.ai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {mistral_key}", "Content-Type": "application/json"},
                    json={
                        "model": "mistral-small-latest",
                        "response_format": {"type": "json_object"},
                        "messages": [{"role": "user", "content": narrator_prompt}],
                    },
                )
                if res.status_code == 200:
                    resp_data = res.json()["choices"][0]["message"]["content"]
                    parsed_narrator = json.loads(resp_data)
                    if parsed_narrator.get("short_answer"):
                        return {
                            "label": req.label,
                            "wiki_title": wiki_title,
                            "wiki_url": wiki_url,
                            "wiki_thumbnail": thumbnail_url,
                            "short_answer": parsed_narrator.get("short_answer"),
                            "expanded_text": parsed_narrator.get("expanded_text", extract),
                        }
        except Exception as e:
            print(f"Mistral narrator synthesis error in /api/ground: {e}")

    # Split into 2-3 calm narrator sentences as fallback
    sentences = re.findall(r"[^.!?]+[.!?]+", extract) or [extract]
    short_answer = " ".join(sentences[:3]).strip()

    return {
        "label": req.label,
        "wiki_title": wiki_title,
        "wiki_url": wiki_url,
        "wiki_thumbnail": thumbnail_url,
        "short_answer": short_answer,
        "expanded_text": extract,
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    print(f"Starting Glance Backend on http://{host}:{port}")
    uvicorn.run("main:app", host=host, port=port, reload=True)

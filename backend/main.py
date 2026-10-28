import json
import os
import re
from datetime import date
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google.genai import Client
from pydantic import BaseModel, Field, field_validator

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
load_dotenv(Path(__file__).resolve().parent / ".env")

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")

app = FastAPI(title="AI Trip Planner API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ItineraryRequest(BaseModel):
    destination: str = Field(min_length=1)
    start_date: date
    end_date: date
    budget: float = Field(gt=0)
    interests: list[str] = Field(default_factory=list)

    @field_validator("destination")
    @classmethod
    def strip_destination(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Destination is required")
        return cleaned

    @field_validator("interests")
    @classmethod
    def clean_interests(cls, value: list[str]) -> list[str]:
        return [item.strip() for item in value if item.strip()]


class Activity(BaseModel):
    time_of_day: str
    name: str
    description: str
    estimated_cost_usd: float = 0


class ItineraryDay(BaseModel):
    day: int
    date: str
    title: str
    activities: list[Activity]


class ItineraryResponse(BaseModel):
    destination: str
    summary: str
    total_estimated_cost_usd: float
    days: list[ItineraryDay]


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/itinerary", response_model=ItineraryResponse)
def generate_itinerary(payload: ItineraryRequest) -> ItineraryResponse:
    if payload.end_date < payload.start_date:
        raise HTTPException(
            status_code=400,
            detail="End date must be on or after the start date.",
        )

    trip_days = (payload.end_date - payload.start_date).days + 1
    if trip_days > 21:
        raise HTTPException(
            status_code=400,
            detail="Please choose a trip of 21 days or fewer so the itinerary stays detailed.",
        )

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Gemini is not configured. Add GEMINI_API_KEY to backend/.env and restart the API.",
        )

    interests = payload.interests or ["a balanced mix of experiences"]
    prompt = f"""
You are an expert travel planner. Create a realistic, specific day-by-day itinerary.

Trip details:
- Destination: {payload.destination}
- Start date: {payload.start_date.isoformat()}
- End date: {payload.end_date.isoformat()}
- Number of days: {trip_days}
- Budget in USD: {payload.budget:.0f}
- Interests: {", ".join(interests)}

Rules:
- Cover every calendar day from start date through end date.
- Use real neighborhoods, sights, food, and transport that fit the destination.
- Keep estimated costs plausible and within the overall budget.
- Include morning, afternoon, and evening activities on most days.
- Do not include placeholder text such as "Gemini is not connected".

Return JSON only, matching this schema:
{{
  "destination": "string",
  "summary": "2-4 sentence overview",
  "total_estimated_cost_usd": number,
  "days": [
    {{
      "day": 1,
      "date": "YYYY-MM-DD",
      "title": "short day title",
      "activities": [
        {{
          "time_of_day": "Morning",
          "name": "activity name",
          "description": "1-2 sentences",
          "estimated_cost_usd": number
        }}
      ]
    }}
  ]
}}
""".strip()

    try:
        client = Client(api_key=api_key)
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config={
                "response_mime_type": "application/json",
            },
        )
        raw_text = (response.text or "").strip()
        data = parse_gemini_json(raw_text)
        return ItineraryResponse.model_validate(data)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Could not generate an itinerary from Gemini: {exc}",
        ) from exc


def parse_gemini_json(raw_text: str) -> dict:
    if not raw_text:
        raise ValueError("Gemini returned an empty response")

    cleaned = raw_text.strip()
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", cleaned)
    if fenced:
        cleaned = fenced.group(1).strip()

    data = json.loads(cleaned)
    if not isinstance(data, dict) or "days" not in data:
        raise ValueError("Gemini response was missing itinerary days")
    return data

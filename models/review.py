from dataclasses import dataclass, field, asdict
from typing import Optional
import json


@dataclass
class Review:
    persona_id: str
    persona_name: str
    appeal_score: int = 0
    first_impression: str = ""
    key_positives: str = ""
    key_concerns: str = ""
    recommendation: str = ""
    review_summary: str = ""
    # Brand Attitude (1-7)
    like_dislike: int = 0
    positive_negative: int = 0
    good_bad: int = 0
    favorable_unfavorable: int = 0
    # Purchase Intention (1-7)
    likelihood_high: int = 0
    probability_consider_high: int = 0
    willingness_high: int = 0
    # Purchase Probability (0-10)
    purchase_probability_juster: int = 0
    raw_response: str = ""
    error: Optional[str] = None

    @classmethod
    def from_llm_response(cls, persona_id: str, persona_name: str, response_text: str) -> "Review":
        try:
            # Try to extract JSON from the response
            text = response_text.strip()
            # Handle markdown code blocks
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].split("```")[0].strip()

            data = json.loads(text)
            positives = data.get("key_positives", [])
            if isinstance(positives, list):
                positives = "; ".join(positives)

            concerns = data.get("key_concerns", [])
            if isinstance(concerns, list):
                concerns = "; ".join(concerns)

            return cls(
                persona_id=persona_id,
                persona_name=persona_name,
                appeal_score=int(data.get("appeal_score", 0)),
                first_impression=str(data.get("first_impression", "")),
                key_positives=str(positives),
                key_concerns=str(concerns),
                recommendation=str(data.get("recommendation", "")),
                review_summary=str(data.get("review_summary", "")),
                # Brand Attitude
                like_dislike=int(data.get("like_dislike", 0)),
                positive_negative=int(data.get("positive_negative", 0)),
                good_bad=int(data.get("good_bad", 0)),
                favorable_unfavorable=int(data.get("favorable_unfavorable", 0)),
                # Purchase Intention
                likelihood_high=int(data.get("likelihood_high", 0)),
                probability_consider_high=int(data.get("probability_consider_high", 0)),
                willingness_high=int(data.get("willingness_high", 0)),
                # Purchase Probability
                purchase_probability_juster=int(data.get("purchase_probability_juster", 0)),
                raw_response=response_text,
            )
        except (json.JSONDecodeError, KeyError, ValueError):
            return cls(
                persona_id=persona_id,
                persona_name=persona_name,
                review_summary=response_text[:500],
                raw_response=response_text,
                error="Failed to parse JSON response",
            )

    def to_dict(self) -> dict:
        return asdict(self)

    def to_sheet_row(self, run_id: str) -> list:
        return [
            run_id,
            self.persona_id,
            self.persona_name,
            self.appeal_score,
            self.first_impression,
            self.key_positives,
            self.key_concerns,
            self.recommendation,
            self.review_summary,
            self.like_dislike,
            self.positive_negative,
            self.good_bad,
            self.favorable_unfavorable,
            self.likelihood_high,
            self.probability_consider_high,
            self.willingness_high,
            self.purchase_probability_juster,
            self.error or "",
        ]

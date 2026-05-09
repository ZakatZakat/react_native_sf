"""Keyword-based classifier. Returns tag IDs with confidence."""

from __future__ import annotations

from dataclasses import dataclass

from app.models import Tag


@dataclass
class TagAssignment:
    tag_id: int
    tag_key: str
    confidence: float  # 0..1


class KeywordClassifier:
    def classify(self, text: str, tags: list[Tag]) -> list[TagAssignment]:
        if not text or not tags:
            return []
        tl = text.lower()
        out: list[TagAssignment] = []
        for tag in tags:
            kws = [kw.lower() for kw in (tag.keywords or [])]
            if not kws:
                continue
            hits = sum(1 for kw in kws if kw in tl)
            if hits == 0:
                continue
            # Confidence: 0.4 floor + (matches / total_keywords) * 0.6, capped at 1.0
            conf = min(1.0, 0.4 + (hits / max(1, len(kws))) * 0.6)
            out.append(TagAssignment(tag_id=tag.id, tag_key=tag.key, confidence=round(conf, 3)))
        return out

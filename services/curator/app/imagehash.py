"""Перцептивный хэш постера (dHash) для дедупа кросс-постов по картинке.

Побайтовый sha256 (`PostRaw.media_hash`) НЕ ловит один и тот же постер,
перепакованный Telegram при перепосте (другой JPEG → другой sha256). dHash
сравнивает соседние пиксели ужатой ч/б-версии → 64-битный отпечаток, устойчивый
к перекодированию и ресайзу: идентичная картинка в разных байтах → расстояние
Хэмминга 0–6 бит; разные постеры → 20+. Порог near-dup ≈ 8/64 (PHASH_MAX_HAMMING).

Pillow импортируется ЛЕНИВО внутри dhash(), чтобы `hamming`/`close` (чистый
Python) работали и там, где Pillow не установлен (импорт модуля не падает).
"""
from __future__ import annotations

_HASH_SIZE = 8  # (9×8) сравнений = 64 бита → 16-символьный hex


def dhash(path: str, hash_size: int = _HASH_SIZE) -> str:
    """dHash файла-постера как hex-строку (64 бита → 16 симв.).

    Бросает исключение на битом/нечитаемом файле — вызывающий ловит и пропускает.
    """
    from PIL import Image  # лениво: нужен только при реальном хэшировании

    img = Image.open(path).convert("L").resize((hash_size + 1, hash_size), Image.LANCZOS)
    px = img.load()
    bits = 0
    for row in range(hash_size):
        for col in range(hash_size):
            bits = (bits << 1) | (1 if px[col, row] > px[col + 1, row] else 0)
    return f"{bits:0{hash_size * hash_size // 4}x}"


def hamming(a: str, b: str) -> int:
    """Расстояние Хэмминга между двумя hex-dHash. 0 = идентичны."""
    return bin(int(a, 16) ^ int(b, 16)).count("1")


def close(a: str | None, b: str | None, max_dist: int) -> bool:
    """True, если оба хэша заданы, одной длины и Hamming ≤ max_dist."""
    return bool(a and b and len(a) == len(b) and hamming(a, b) <= max_dist)

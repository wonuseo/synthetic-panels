import base64
import io
from pathlib import Path
from PIL import Image
from pdf2image import convert_from_bytes


def _image_to_base64(image: Image.Image, fmt: str = "PNG") -> str:
    buffer = io.BytesIO()
    image.save(buffer, format=fmt)
    return base64.standard_b64encode(buffer.getvalue()).decode("utf-8")


def _detect_media_type(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    return {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".pdf": "application/pdf",
    }.get(ext, "application/octet-stream")


def prepare_for_claude(file_bytes: bytes, filename: str) -> list[dict]:
    media_type = _detect_media_type(filename)

    if media_type == "application/pdf":
        b64 = base64.standard_b64encode(file_bytes).decode("utf-8")
        return [
            {
                "type": "document",
                "source": {
                    "type": "base64",
                    "media_type": "application/pdf",
                    "data": b64,
                },
            }
        ]

    # Image file
    b64 = base64.standard_b64encode(file_bytes).decode("utf-8")
    return [
        {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": media_type,
                "data": b64,
            },
        }
    ]


def prepare_for_openai(file_bytes: bytes, filename: str) -> list[dict]:
    media_type = _detect_media_type(filename)

    if media_type == "application/pdf":
        # Convert PDF pages to images for OpenAI
        images = convert_from_bytes(file_bytes, dpi=150)
        parts = []
        for img in images:
            b64 = _image_to_base64(img, "PNG")
            parts.append(
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/png;base64,{b64}",
                    },
                }
            )
        return parts

    # Image file
    b64 = base64.standard_b64encode(file_bytes).decode("utf-8")
    return [
        {
            "type": "image_url",
            "image_url": {
                "url": f"data:{media_type};base64,{b64}",
            },
        }
    ]

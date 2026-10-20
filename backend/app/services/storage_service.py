import os
import base64
import logging
from typing import Optional
from ..config import settings

logger = logging.getLogger("storage_service")

# Initialize Cloudinary if credentials are provided in settings
_cloudinary_configured = False
try:
    if settings.CLOUDINARY_CLOUD_NAME and settings.CLOUDINARY_API_KEY and settings.CLOUDINARY_API_SECRET:
        import cloudinary
        import cloudinary.uploader
        cloudinary.config(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            secure=True
        )
        _cloudinary_configured = True
        logger.info("Cloudinary storage service initialized successfully.")
except Exception as e:
    logger.warning(f"Could not initialize Cloudinary: {e}. Falling back to local storage.")


class StorageService:
    @staticmethod
    def is_cloud_enabled() -> bool:
        return _cloudinary_configured

    @staticmethod
    def _normalize_base64(raw_b64: str) -> str:
        """Ensure base64 data string has proper URI format for Cloudinary."""
        if not raw_b64:
            return ""
        raw = raw_b64.strip()
        if raw.startswith("data:"):
            return raw
        # Default assume JPEG if header missing
        return f"data:image/jpeg;base64,{raw}"

    @classmethod
    def upload_document(
        cls,
        image_data: str,
        passenger_id: int | str,
        doc_type: str = "passport"
    ) -> str:
        """
        Uploads a scanned passport or travel document image to Cloudinary (or local fallback).
        Returns the secure HTTPS cloud URL.
        """
        if not image_data or not image_data.strip():
            return ""

        formatted_b64 = cls._normalize_base64(image_data)

        if _cloudinary_configured:
            try:
                import cloudinary.uploader
                res = cloudinary.uploader.upload(
                    formatted_b64,
                    folder=f"smart_airport/documents",
                    public_id=f"passenger_{passenger_id}_{doc_type}",
                    overwrite=True,
                    resource_type="image"
                )
                cloud_url = res.get("secure_url") or res.get("url")
                logger.info(f"Document uploaded to Cloudinary: {cloud_url}")
                return cloud_url
            except Exception as exc:
                logger.error(f"Cloudinary document upload failed: {exc}. Using fallback.")

        # Local fallback if Cloudinary is not configured yet
        local_dir = os.path.join(os.path.dirname(__file__), "..", "..", "data", "documents")
        os.makedirs(local_dir, exist_ok=True)
        filename = f"p_{passenger_id}_{doc_type}.jpg"
        file_path = os.path.join(local_dir, filename)

        try:
            b64_content = formatted_b64.split(",", 1)[1] if "," in formatted_b64 else formatted_b64
            with open(file_path, "wb") as f:
                f.write(base64.b64decode(b64_content))
            return f"/data/documents/{filename}"
        except Exception:
            return f"/data/documents/{filename}"

    @classmethod
    def upload_face(
        cls,
        image_data: str,
        passenger_id: int | str
    ) -> str:
        """
        Uploads an enrolled cropped face photo to Cloudinary (or local fallback).
        Returns the secure HTTPS cloud URL.
        """
        if not image_data or not image_data.strip():
            return ""

        formatted_b64 = cls._normalize_base64(image_data)

        if _cloudinary_configured:
            try:
                import cloudinary.uploader
                res = cloudinary.uploader.upload(
                    formatted_b64,
                    folder=f"smart_airport/faces",
                    public_id=f"passenger_{passenger_id}_face",
                    overwrite=True,
                    resource_type="image"
                )
                cloud_url = res.get("secure_url") or res.get("url")
                logger.info(f"Face image uploaded to Cloudinary: {cloud_url}")
                return cloud_url
            except Exception as exc:
                logger.error(f"Cloudinary face upload failed: {exc}. Using fallback.")

        # Local fallback
        local_dir = os.path.join(os.path.dirname(__file__), "..", "..", "data", "faces")
        os.makedirs(local_dir, exist_ok=True)
        filename = f"p_{passenger_id}_face.jpg"
        file_path = os.path.join(local_dir, filename)

        try:
            b64_content = formatted_b64.split(",", 1)[1] if "," in formatted_b64 else formatted_b64
            with open(file_path, "wb") as f:
                f.write(base64.b64decode(b64_content))
            return f"/data/faces/{filename}"
        except Exception:
            return f"/data/faces/{filename}"

storage_service = StorageService()

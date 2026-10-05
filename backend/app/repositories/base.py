from sqlalchemy.orm import Session
from typing import TypeVar, Generic, Type, List, Optional
from ..database import Base

ModelType = TypeVar("ModelType", bound=Base)

class BaseRepository(Generic[ModelType]):
    def __init__(self, model: Type[ModelType]):
        self.model = model

    def get_all(self, db: Session, skip: int = 0, limit: int = 100) -> List[ModelType]:
        return db.query(self.model).offset(skip).limit(limit).all()

    def _pk_column(self):
        # Models use <name>_id primary keys (no generic `id` column).
        pk = list(self.model.__table__.primary_key.columns)
        if not pk:
            raise AttributeError(f"{self.model.__name__} has no primary key")
        return pk[0]

    def get_by_id(self, db: Session, id: int) -> Optional[ModelType]:
        pk = self._pk_column()
        return db.query(self.model).filter(pk == id).first()

    def create(self, db: Session, obj_in: dict) -> ModelType:
        obj_data = self.model(**obj_in)
        db.add(obj_data)
        db.commit()
        db.refresh(obj_data)
        return obj_data

    def get_by_pk_name(self, db: Session, pk_name: str, id: int) -> Optional[ModelType]:
        col = getattr(self.model, pk_name)
        return db.query(self.model).filter(col == id).first()

    def delete(self, db: Session, id: int) -> bool:
        obj = self.get_by_id(db, id)
        if obj:
            db.delete(obj)
            db.commit()
            return True
        return False

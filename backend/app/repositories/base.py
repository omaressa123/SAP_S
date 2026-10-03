from sqlalchemy.orm import Session
from typing import TypeVar, Generic, Type, List, Optional
from ..database import Base

ModelType = TypeVar("ModelType", bound=Base)

class BaseRepository(Generic[ModelType]):
    def __init__(self, model: Type[ModelType]):
        self.model = model

    def get_all(self, db: Session, skip: int = 0, limit: int = 100) -> List[ModelType]:
        return db.query(self.model).offset(skip).limit(limit).all()

    def get_by_id(self, db: Session, id: int) -> Optional[ModelType]:
        return db.query(self.model).filter(self.model.id == id).first()

    def create(self, db: Session, obj_in: dict) -> ModelType:
        obj_data = self.model(**obj_in)
        db.add(obj_data)
        db.commit()
        db.refresh(obj_data)
        return obj_data

    def delete(self, db: Session, id: int) -> bool:
        obj = self.get_by_id(db, id)
        if obj:
            db.delete(obj)
            db.commit()
            return True
        return False

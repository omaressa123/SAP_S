from sqlalchemy.orm import Session
import bcrypt
from datetime import datetime
from ..models.identity import Passenger, TravelDocument
from ..models.admin_cameras import UserAccount
from ..utils.errors import AirportException

class AuthService:
    @staticmethod
    def get_password_hash(password: str) -> str:
        # bcrypt requires bytes
        pwd_bytes = password.encode('utf-8')
        salt = bcrypt.gensalt()
        hashed_password = bcrypt.hashpw(pwd_bytes, salt)
        return hashed_password.decode('utf-8')
        
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        password_bytes = plain_password.encode('utf-8')
        hashed_password_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(password_bytes, hashed_password_bytes)

    @staticmethod
    def register_passenger(db: Session, payload):
        # Check if email exists
        if db.query(UserAccount).filter(UserAccount.email == payload.email).first():
            raise AirportException(code="EMAIL_EXISTS", message="Email already registered", status_code=400)
            
        # Check if passport exists
        if db.query(TravelDocument).filter(TravelDocument.document_number == payload.passportNumber).first():
            raise AirportException(code="PASSPORT_EXISTS", message="Passport number already registered", status_code=400)
            
        try:
            # Parse date string
            dob = datetime.strptime(payload.dateOfBirth, "%Y-%m-%d").date()
        except ValueError:
            raise AirportException(code="INVALID_DATE", message="Invalid date format, use YYYY-MM-DD", status_code=400)
            
        # Ensure country exists to prevent Foreign Key Violation
        from ..models.identity import Country
        if not db.query(Country).filter(Country.country_code == payload.nationalityCountryCode).first():
            new_country = Country(country_code=payload.nationalityCountryCode, country_name="Auto-Generated", created_at=datetime.utcnow())
            db.add(new_country)
            db.commit()
            
        # Create Passenger
        new_passenger = Passenger(
            full_name=payload.fullName,
            nationality_country_code=payload.nationalityCountryCode,
            date_of_birth=dob,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(new_passenger)
        db.flush() # flush to get the passenger_id without committing yet

        # Create UserAccount
        new_account = UserAccount(
            username=payload.email,
            email=payload.email,
            password_hash=AuthService.get_password_hash(payload.password),
            linked_person_type="passenger",
            linked_person_id=new_passenger.passenger_id,
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(new_account)
        
        # Create Travel Document
        new_doc = TravelDocument(
            passenger_id=new_passenger.passenger_id,
            document_type="passport",
            document_number=payload.passportNumber,
            issuing_country_code=payload.nationalityCountryCode,
            is_primary=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(new_doc)
        db.commit()
        db.refresh(new_account)
        
        return {
            "userAccountId": new_account.user_account_id,
            "passengerId": new_account.linked_person_id,
            "message": "User registered successfully",
            "createdAt": new_account.created_at.isoformat() + "Z"
        }

    @staticmethod
    def login_passenger(db: Session, email: str, password: str):
        account = db.query(UserAccount).filter(UserAccount.email == email, UserAccount.linked_person_type == "passenger").first()
        if not account:
            raise AirportException(code="INVALID_CREDENTIALS", message="Incorrect email or password", status_code=401)
            
        if not AuthService.verify_password(password, account.password_hash):
            raise AirportException(code="INVALID_CREDENTIALS", message="Incorrect email or password", status_code=401)
            
        account.last_login = datetime.utcnow()
        db.commit()
        return account

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, DECIMAL
from sqlalchemy.orm import relationship
from datetime import datetime
from decimal import Decimal
from ..database import Base


class AgentDefinition(Base):
    __tablename__ = 'agentdefinition'

    agent_id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    capabilities = Column(Text)
    status = Column(String, nullable=False, default='registered')
    health_check_url = Column(String)
    last_heartbeat = Column(DateTime, default=datetime.utcnow)
    config = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tasks = relationship('AgentTask', back_populates='agent', cascade='all, delete-orphan')
    executions = relationship('AgentExecution', back_populates='agent', cascade='all, delete-orphan')


class AgentTask(Base):
    __tablename__ = 'agenttask'

    task_id = Column(String, primary_key=True, index=True)
    agent_id = Column(String, ForeignKey('agentdefinition.agent_id'), index=True, nullable=False)
    event_id = Column(String, ForeignKey('airportevent.event_id'), index=True)
    task_type = Column(String, nullable=False)
    status = Column(String, nullable=False, default='pending')
    input_payload = Column(Text)
    output_payload = Column(Text)
    error_message = Column(Text)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    timeout_seconds = Column(Integer, default=300)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    agent = relationship('AgentDefinition', back_populates='tasks')
    event = relationship('AirportEvent', back_populates='tasks')
    executions = relationship('AgentExecution', back_populates='task', cascade='all, delete-orphan')


class AgentExecution(Base):
    __tablename__ = 'agenteexecution'

    execution_id = Column(String, primary_key=True, index=True)
    task_id = Column(String, ForeignKey('agenttask.task_id'), index=True, nullable=False)
    agent_id = Column(String, ForeignKey('agentdefinition.agent_id'), index=True, nullable=False)
    status = Column(String, nullable=False)
    attempt = Column(Integer, default=1)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)
    result = Column(Text)
    error = Column(Text)
    duration_ms = Column(Integer)

    task = relationship('AgentTask', back_populates='executions')
    agent = relationship('AgentDefinition', back_populates='executions')


class AirportEvent(Base):
    __tablename__ = 'airportevent'

    event_id = Column(String, primary_key=True, index=True)
    event_type = Column(String, nullable=False, index=True)
    source = Column(String, nullable=False)
    source_id = Column(String)
    correlation_id = Column(String, index=True)
    payload = Column(Text)
    status = Column(String, nullable=False, default='received')
    severity = Column(String, default='info')
    zone_id = Column(Integer, ForeignKey('zone.zone_id'), index=True)
    camera_id = Column(Integer, ForeignKey('camera.camera_id'), index=True)
    passenger_id = Column(Integer, ForeignKey('passenger.passenger_id'), index=True)
    bag_id = Column(Integer, ForeignKey('bag.bag_id'), index=True)
    flight_id = Column(Integer, ForeignKey('flight.flight_id'), index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    resolved_at = Column(DateTime)

    tasks = relationship('AgentTask', back_populates='event')


class WorkflowExecution(Base):
    __tablename__ = 'workflowexecution'

    workflow_id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    status = Column(String, nullable=False, default='running')
    correlation_id = Column(String, index=True)
    input_payload = Column(Text)
    output_payload = Column(Text)
    current_step = Column(String)
    steps_completed = Column(Text)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)
    error_message = Column(Text)

    decisions = relationship('DecisionAudit', back_populates='workflow', cascade='all, delete-orphan')


class DecisionAudit(Base):
    __tablename__ = 'decisionaudit'

    audit_id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(String, ForeignKey('workflowexecution.workflow_id'), index=True, nullable=False)
    task_id = Column(String, ForeignKey('agenttask.task_id'), index=True)
    agent_id = Column(String, ForeignKey('agentdefinition.agent_id'), index=True, nullable=False)
    decision = Column(String, nullable=False)
    rationale = Column(Text)
    confidence = Column(DECIMAL(5, 2))
    requires_human_review = Column(Boolean, default=False)
    human_reviewed_by = Column(Integer, ForeignKey('staff.staff_id'), index=True)
    human_reviewed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    workflow = relationship('WorkflowExecution', back_populates='decisions')

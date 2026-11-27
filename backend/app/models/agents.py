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


class AgentDeployment(Base):
    """Persistent deployment of an AI agent instance onto an airport device."""
    __tablename__ = 'agentdeployment'

    deployment_id = Column(String, primary_key=True, index=True)
    agent_name = Column(String, nullable=False)
    agent_type = Column(String, nullable=False, index=True)
    model_id = Column(String, nullable=False, index=True)
    model_name = Column(String, nullable=False)
    device_id = Column(Integer, ForeignKey('equipment.equipment_id'), index=True, nullable=True)
    device_label = Column(String, nullable=True)
    location = Column(String, nullable=True)
    input_source = Column(String, nullable=True)
    output_destination = Column(String, nullable=True)
    status = Column(String, nullable=False, default='running')  # running, idle, stopped, failed, offline
    processing_status = Column(String, nullable=False, default='ready')  # processing, ready, degraded, halted, disconnected
    health_url = Column(String, nullable=True)
    config_json = Column(Text, nullable=True)
    last_error = Column(Text, nullable=True)
    last_heartbeat = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AgentNotification(Base):
    """Operational notifications and alerts for deployed AI agents."""
    __tablename__ = 'agentnotification'

    notification_id = Column(String, primary_key=True, index=True)
    deployment_id = Column(String, ForeignKey('agentdeployment.deployment_id', ondelete='SET NULL'), index=True, nullable=True)
    agent_name = Column(String, nullable=False, index=True)
    model_name = Column(String, nullable=False)
    device_id = Column(Integer, nullable=True)
    device_label = Column(String, nullable=True)
    severity = Column(String, nullable=False, default='info', index=True)  # critical, warning, info
    event_kind = Column(String, nullable=False, default='operational_issue')  # offline, crash, model_init_failed, degraded, stalled, device_disconnected, operational_issue, recovered
    description = Column(Text, nullable=False)
    agent_status = Column(String, nullable=False)
    recommended_action = Column(Text, nullable=True)
    is_read = Column(Boolean, nullable=False, default=False)
    status = Column(String, nullable=False, default='open', index=True)  # open, acknowledged, resolved
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    acknowledged_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)

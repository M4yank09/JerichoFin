"""Basic tests for engine interface contracts."""
from backend.app.engine.allocator import CapitalAllocationEngine
from backend.app.engine.risk import TreasuryRiskEngine


def test_allocation_engine_init():
    """Verify CapitalAllocationEngine instantiates with expected default parameters."""
    engine = CapitalAllocationEngine(risk_free_rate=0.045)
    assert engine.risk_free_rate == 0.045


def test_treasury_risk_engine_init():
    """Verify TreasuryRiskEngine instantiates with expected default parameters."""
    engine = TreasuryRiskEngine(confidence_level=0.99)
    assert engine.confidence_level == 0.99

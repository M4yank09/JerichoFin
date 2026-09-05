"""Unit tests for synthetic deterministic market data generator."""
import pandas as pd
import pytest

from backend.app.engine.synthetic_data import (
    DATA_DISCLAIMER,
    DEFAULT_INSTITUTIONAL_ASSETS,
    generate_deterministic_synthetic_returns,
)


class TestSyntheticDataGenerator:
    """Test suite verifying synthetic data determinism, labeling, and financial properties."""

    def test_synthetic_data_shape_and_columns(self):
        assets = DEFAULT_INSTITUTIONAL_ASSETS
        df = generate_deterministic_synthetic_returns(assets, n_periods=252, seed=42)

        assert df.shape == (252, len(assets))
        assert list(df.columns) == [a.symbol for a in assets]

    def test_synthetic_data_determinism(self):
        # Two executions with the exact same seed MUST produce bitwise identical outputs
        df1 = generate_deterministic_synthetic_returns(n_periods=100, seed=42)
        df2 = generate_deterministic_synthetic_returns(n_periods=100, seed=42)

        pd.testing.assert_frame_equal(df1, df2)

    def test_different_seeds_produce_different_data(self):
        df1 = generate_deterministic_synthetic_returns(n_periods=50, seed=42)
        df2 = generate_deterministic_synthetic_returns(n_periods=50, seed=99)

        assert not df1.equals(df2)

    def test_synthetic_disclaimer_metadata(self):
        df = generate_deterministic_synthetic_returns(n_periods=20, seed=42)
        assert df.attrs.get("is_synthetic") is True
        assert "DEMO / SYNTHETIC DATA" in df.attrs.get("description", "")
        assert DATA_DISCLAIMER in df.attrs.get("description", "")

    def test_asset_volatility_gradation(self):
        """Verify cash and sovereign bonds exhibit lower volatility than corporate and strategic yield."""
        df = generate_deterministic_synthetic_returns(n_periods=252, seed=42)
        vols = df.std()

        # Cash volatility should be lower than T-bill volatility
        assert vols["USD_CASH"] < vols["US_TBILL_3M"]
        # T-Bill volatility should be lower than Corporate Bond volatility
        assert vols["US_TBILL_3M"] < vols["US_CORP_IG"]
        # Corporate Bond volatility should be lower than Strategic Yield volatility
        assert vols["US_CORP_IG"] < vols["STRAT_YIELD_BUF"]

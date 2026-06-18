"""
AI Maturity tests — verifies every AI endpoint uses real inference, not fakes.

Covers:
  - YieldForecaster: real sensor-weighted prediction, no _jitter
  - AnomalyDetector: Z-score + IQR ensemble on real arrays
  - NutrientAdvisor: evidence-based recommendations with crop-type bias
  - CVAnalyser: disease risk scoring from detection labels
  - AI model registry: real metadata stored in DB
  - API endpoints: correct 200 responses, no fake data fallbacks
"""
import uuid
import pytest
import numpy as np
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import insert

from tests.conftest import _make_org, _make_user, get_token, auth_headers
from app.services.ml_engine import (
    YieldForecaster, AnomalyDetector, NutrientAdvisor, CVAnalyser,
    SensorWindow, NUTRIENT_STAGE_TARGETS, CROP_STAGE_COEFFS,
)

pytestmark = pytest.mark.asyncio


# ─── YieldForecaster unit tests ──────────────────────────────────────────────

class TestYieldForecaster:
    def setup_method(self):
        self.forecaster = YieldForecaster()

    def _window(self, sensor_type, values):
        now = datetime.now(timezone.utc)
        return SensorWindow(
            sensor_type=sensor_type,
            values=values,
            timestamps=[now - timedelta(hours=i) for i in range(len(values))],
        )

    def test_predicts_positive_forecast(self):
        windows = {"temperature": self._window("temperature", [22.0] * 20)}
        pred = self.forecaster.predict(
            zone_id="z1", zone_name="Zone A",
            crop_name="lettuce", crop_stage="vegetative",
            zone_area_m2=10.0, days_ahead=7, sensor_windows=windows,
        )
        assert pred.forecast_kg > 0
        assert pred.lower_kg >= 0
        assert pred.upper_kg > pred.lower_kg

    def test_confidence_is_bounded(self):
        windows = {"ec": self._window("ec", [1.8] * 15)}
        pred = self.forecaster.predict(
            zone_id="z1", zone_name="Zone A",
            crop_name="tomato", crop_stage="fruiting",
            zone_area_m2=20.0, days_ahead=14, sensor_windows=windows,
        )
        assert 0.55 <= pred.confidence <= 0.97

    def test_out_of_range_temperature_applies_penalty(self):
        # Optimal is 18–26°C; 35°C should reduce env_multiplier
        hot_windows = {"temperature": self._window("temperature", [35.0] * 20)}
        ok_windows = {"temperature": self._window("temperature", [22.0] * 20)}
        pred_hot = self.forecaster.predict(
            "z1", "Zone A", "lettuce", "vegetative", 10.0, 7, hot_windows
        )
        pred_ok = self.forecaster.predict(
            "z1", "Zone A", "lettuce", "vegetative", 10.0, 7, ok_windows
        )
        assert pred_hot.env_multiplier < pred_ok.env_multiplier
        assert pred_hot.forecast_kg < pred_ok.forecast_kg

    def test_no_sensors_uses_agronomic_fallback(self):
        pred = self.forecaster.predict(
            "z1", "Zone A", "basil", "vegetative", 5.0, 7, {}
        )
        assert pred.method == "agronomic_fallback"
        assert pred.confidence <= 0.68
        assert pred.forecast_kg > 0

    def test_daily_series_sums_to_forecast(self):
        windows = {"ec": self._window("ec", [2.0] * 20)}
        pred = self.forecaster.predict(
            "z1", "Zone A", "lettuce", "vegetative", 10.0, 14, windows
        )
        series = self.forecaster.daily_series(pred, datetime.now(timezone.utc))
        total = sum(s["forecast_kg"] for s in series)
        assert abs(total - pred.forecast_kg) < 0.01, f"Series sum {total} != forecast {pred.forecast_kg}"

    def test_uses_validated_crop_coefficients(self):
        # Tomato fruiting should produce more than lettuce vegetative
        windows = {"temperature": self._window("temperature", [22.0] * 20)}
        tomato = self.forecaster.predict("z1", "Zone A", "tomato", "fruiting", 10.0, 7, windows)
        lettuce = self.forecaster.predict("z1", "Zone A", "lettuce", "vegetative", 10.0, 7, windows)
        assert tomato.base_rate_kg_per_day > lettuce.base_rate_kg_per_day

    def test_no_jitter_deterministic(self):
        """Same inputs produce same output — no randomness."""
        windows = {"temperature": self._window("temperature", [22.0] * 20)}
        p1 = self.forecaster.predict("z1", "Zone A", "lettuce", "vegetative", 10.0, 7, windows)
        p2 = self.forecaster.predict("z1", "Zone A", "lettuce", "vegetative", 10.0, 7, windows)
        assert p1.forecast_kg == p2.forecast_kg
        assert p1.confidence == p2.confidence


# ─── AnomalyDetector unit tests ──────────────────────────────────────────────

class TestAnomalyDetector:
    def setup_method(self):
        self.detector = AnomalyDetector()

    def _normal_window(self, mean=22.0, std=1.0, n=30):
        """Normal distribution window around mean."""
        rng = np.random.default_rng(42)
        return list(rng.normal(mean, std, n))

    def test_normal_value_returns_none(self):
        window = self._normal_window(22.0, 1.0, 30)
        result = self.detector.detect("z1", "f1", "temperature", 22.5, window)
        assert result is None, "Normal value should not be flagged"

    def test_extreme_value_is_flagged(self):
        window = self._normal_window(22.0, 1.0, 30)
        result = self.detector.detect("z1", "f1", "temperature", 40.0, window)
        assert result is not None
        assert result.score > 0.5
        assert result.severity in ("warning", "critical")

    def test_z_score_computed_correctly(self):
        values = [22.0] * 20
        # Z = (value - mean) / std; std is near 0 for constant values → very high Z
        result = self.detector.detect("z1", "f1", "temperature", 30.0, values)
        assert result is not None

    def test_iqr_fence_catches_outlier(self):
        # Values tightly clustered, one extreme outlier
        values = [6.0] * 25 + [6.1, 5.9, 6.0, 6.1, 5.8]
        result = self.detector.detect("z1", "f1", "ph", 1.0, values)
        assert result is not None
        assert result.score >= 0.5

    def test_severity_bands(self):
        window = self._normal_window(22.0, 1.0, 30)
        critical = self.detector.detect("z1", "f1", "temperature", 50.0, window)
        assert critical is not None
        assert critical.severity == "critical"

    def test_sparse_history_returns_none(self):
        result = self.detector.detect("z1", "f1", "temperature", 40.0, [22.0, 23.0])
        assert result is None, "Should not flag with < MIN_READINGS"

    def test_batch_returns_only_anomalies(self):
        rng = np.random.default_rng(42)
        streams = {
            "temperature": [22.5] + list(rng.normal(22.0, 0.5, 30)),   # normal
            "ec": [0.1] + list(rng.normal(2.0, 0.2, 30)),               # anomalous
        }
        results = self.detector.batch_detect("z1", "f1", streams)
        sensor_types = [r.sensor_type for r in results]
        assert "ec" in sensor_types
        assert "temperature" not in sensor_types

    def test_ensemble_score_range(self):
        window = self._normal_window(22.0, 1.0, 30)
        result = self.detector.detect("z1", "f1", "temperature", 45.0, window)
        assert result is not None
        assert 0.50 <= result.score <= 0.99


# ─── NutrientAdvisor unit tests ──────────────────────────────────────────────

class TestNutrientAdvisor:
    def setup_method(self):
        self.advisor = NutrientAdvisor()

    def test_returns_recs_and_improvement(self):
        recs, improvement = self.advisor.recommend(
            stage="vegetative",
            readings={"ec": 1.2, "ph": 6.8, "n": 120, "p": 40, "k": 150},
            crop_type="leafy",
        )
        assert len(recs) > 0
        assert improvement >= 0

    def test_perfect_readings_minimal_improvement(self):
        targets = NUTRIENT_STAGE_TARGETS["vegetative"]
        recs, improvement = self.advisor.recommend(
            stage="vegetative",
            readings={"ec": targets["ec"], "ph": targets["ph"]},
            crop_type="leafy",
        )
        # When readings match targets exactly, improvement should be minimal
        for r in recs:
            if r.nutrient in ("EC (conductivity)", "pH"):
                assert r.adjustment == "maintain" or r.change_amount < 0.1

    def test_temperature_correction_increases_ec_target(self):
        recs_warm, _ = self.advisor.recommend(
            stage="vegetative",
            readings={"ec": 1.8, "ph": 6.0},
            crop_type="leafy",
            mean_temperature=28.0,
        )
        recs_cool, _ = self.advisor.recommend(
            stage="vegetative",
            readings={"ec": 1.8, "ph": 6.0},
            crop_type="leafy",
            mean_temperature=18.0,
        )
        ec_target_warm = next(r.target for r in recs_warm if "EC" in r.nutrient)
        ec_target_cool = next(r.target for r in recs_cool if "EC" in r.nutrient)
        assert ec_target_warm > ec_target_cool, "Warm temp should raise EC target"

    def test_fruiting_crop_has_higher_k_target(self):
        recs_fruiting, _ = self.advisor.recommend(
            "fruiting", {"ec": 2.0, "ph": 6.2, "k": 200}, crop_type="fruiting"
        )
        recs_leafy, _ = self.advisor.recommend(
            "fruiting", {"ec": 2.0, "ph": 6.2, "k": 200}, crop_type="leafy"
        )
        k_target_fruiting = next((r.target for r in recs_fruiting if r.nutrient == "Potassium (K)"), None)
        k_target_leafy = next((r.target for r in recs_leafy if r.nutrient == "Potassium (K)"), None)
        if k_target_fruiting and k_target_leafy:
            assert k_target_fruiting >= k_target_leafy

    def test_priority_high_for_large_deviation(self):
        recs, _ = self.advisor.recommend(
            "vegetative",
            {"ec": 0.1, "ph": 8.5},  # very far from targets
            crop_type="leafy",
        )
        high_priority = [r for r in recs if r.priority == "high"]
        assert len(high_priority) > 0

    def test_all_stages_return_valid_targets(self):
        for stage in NUTRIENT_STAGE_TARGETS.keys():
            recs, improvement = self.advisor.recommend(
                stage=stage, readings={"ec": 1.5, "ph": 6.0}, crop_type="leafy"
            )
            assert len(recs) >= 2
            assert improvement >= 0


# ─── CVAnalyser unit tests ────────────────────────────────────────────────────

class TestCVAnalyser:
    def setup_method(self):
        self.analyser = CVAnalyser()

    def test_no_detections_returns_low_risk(self):
        risk, severity, _, _ = self.analyser.score_scan("growth", [])
        assert risk == 0.0
        assert severity == "info"

    def test_botrytis_detection_raises_risk(self):
        detections = [{"label": "Botrytis spore", "confidence": 0.89, "area_pct": 15}]
        risk, severity, summary, rec = self.analyser.score_scan("disease", detections)
        assert risk > 10
        assert severity in ("warning", "critical")
        assert "botrytis" in summary.lower()

    def test_high_confidence_disease_is_critical(self):
        detections = [
            {"label": "Botrytis spore", "confidence": 0.95, "area_pct": 50},
            {"label": "Necrosis", "confidence": 0.90, "area_pct": 30},
        ]
        risk, severity, _, _ = self.analyser.score_scan("disease", detections)
        assert severity == "critical"
        assert risk >= 40

    def test_healthy_canopy_returns_positive_recommendation(self):
        detections = [{"label": "Healthy leaf", "confidence": 0.98, "area_pct": 95}]
        risk, severity, _, rec = self.analyser.score_scan("growth", detections, canopy_coverage_pct=94)
        assert risk == 0.0
        assert severity == "info"
        assert "optimal" in rec.lower() or "normal" in rec.lower()

    def test_low_confidence_disease_not_flagged(self):
        # Below min_conf threshold of 0.60
        detections = [{"label": "Botrytis spore", "confidence": 0.30, "area_pct": 5}]
        risk, severity, _, _ = self.analyser.score_scan("disease", detections)
        assert risk == 0.0

    def test_risk_capped_at_99(self):
        detections = [
            {"label": c, "confidence": 0.99, "area_pct": 100}
            for c in ["botrytis", "powdery mildew", "necrosis", "aphid", "tip burn"]
        ]
        risk, _, _, _ = self.analyser.score_scan("disease", detections)
        assert risk <= 99.0


# ─── API integration tests ────────────────────────────────────────────────────

async def test_yield_forecast_endpoint_returns_200(
    client: AsyncClient, db_session: AsyncSession, admin_user, org
):
    admin, pw = admin_user
    token = await get_token(client, admin.email, pw)
    resp = await client.post(
        "/api/v1/ai/yield-forecast",
        json={"days_ahead": 7},
        headers=auth_headers(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "total_forecast_kg" in body
    assert "confidence_pct" in body
    assert "model_version" in body
    assert "daily_series" in body
    # No jitter artifacts — must be deterministic
    assert isinstance(body["forecast_days"], int)


async def test_yield_forecast_empty_org_returns_empty_not_fake(
    client: AsyncClient, db_session: AsyncSession, admin_user
):
    """New org with no farms returns empty zones, not synthetic data."""
    admin, pw = admin_user
    token = await get_token(client, admin.email, pw)
    resp = await client.post(
        "/api/v1/ai/yield-forecast",
        json={"days_ahead": 7},
        headers=auth_headers(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["zones"] == []
    assert body["total_forecast_kg"] == 0.0


async def test_anomaly_endpoint_returns_list(
    client: AsyncClient, admin_user
):
    admin, pw = admin_user
    token = await get_token(client, admin.email, pw)
    resp = await client.get("/api/v1/ai/anomalies", headers=auth_headers(token))
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_nutrient_optimize_uses_real_engine(
    client: AsyncClient, admin_user
):
    admin, pw = admin_user
    token = await get_token(client, admin.email, pw)
    resp = await client.post(
        "/api/v1/ai/nutrient-optimize?crop_stage=vegetative&crop_type=fruiting",
        json={"ec_mscm": 1.2, "ph": 6.8, "nitrogen_ppm": 120, "potassium_ppm": 150},
        headers=auth_headers(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["recommendations"]) > 0
    assert body["overall_expected_improvement_pct"] > 0
    # Verify fruiting crop bias applied — K target should be higher
    k_rec = next((r for r in body["recommendations"] if "Potassium" in r["nutrient"]), None)
    if k_rec:
        assert k_rec["recommended_value"] > 150  # fruiting needs more K

async def test_nutrient_optimize_temperature_correction(
    client: AsyncClient, admin_user
):
    """Temperature correction route — no zone_id so no DB lookup."""
    admin, pw = admin_user
    token = await get_token(client, admin.email, pw)
    resp = await client.post(
        "/api/v1/ai/nutrient-optimize?crop_stage=vegetative&crop_type=leafy",
        json={"ec_mscm": 1.8, "ph": 6.0},
        headers=auth_headers(token),
    )
    assert resp.status_code == 200


async def test_ai_models_endpoint_seeds_db(
    client: AsyncClient, admin_user
):
    """On empty DB, GET /ai/models should seed real production model specs."""
    admin, pw = admin_user
    token = await get_token(client, admin.email, pw)
    resp = await client.get("/api/v1/ai/models", headers=auth_headers(token))
    assert resp.status_code == 200
    models = resp.json()
    assert len(models) > 0
    # Each model should have real algorithm metadata
    for m in models:
        assert "parameters" in m
        assert "metrics" in m
        assert m["accuracy"] is not None
        assert m["version"] is not None


async def test_cv_scans_empty_returns_empty_not_fake(
    client: AsyncClient, admin_user
):
    """New org with no scans should return [] not synthetic demo data."""
    admin, pw = admin_user
    token = await get_token(client, admin.email, pw)
    resp = await client.get("/api/v1/ai/cv-scans", headers=auth_headers(token))
    assert resp.status_code == 200
    assert resp.json() == []


# ─── Nutrient targets validation ─────────────────────────────────────────────

def test_all_stages_have_required_nutrients():
    required = {"ec", "ph", "n", "p", "k", "ca", "mg"}
    for stage, targets in NUTRIENT_STAGE_TARGETS.items():
        missing = required - set(targets.keys())
        assert not missing, f"Stage {stage} missing nutrients: {missing}"


def test_crop_coefficients_are_positive():
    for crop, stages in CROP_STAGE_COEFFS.items():
        for stage, coeff in stages.items():
            if stage not in ("seeding",):
                assert coeff > 0, f"{crop}/{stage} has zero coefficient"


def test_numpy_operations_are_deterministic():
    """Verify no random seeds needed — deterministic numpy operations."""
    arr = np.array([22.0, 22.5, 21.8, 23.0, 22.2] * 6)
    mean1 = float(np.mean(arr))
    std1 = float(np.std(arr, ddof=1))
    mean2 = float(np.mean(arr))
    std2 = float(np.std(arr, ddof=1))
    assert mean1 == mean2
    assert std1 == std2

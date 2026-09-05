import urllib.request
import json
import re

def test_ssr_html():
    print("=== Testing SSR HTML on http://localhost:3000 ===")
    req = urllib.request.Request("http://localhost:3000", headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as response:
        html = response.read().decode("utf-8")

    # 1. Verify "API: CONNECTED" is absent
    assert "API: CONNECTED" not in html, "Found 'API: CONNECTED' in HTML!"
    assert "API: " not in html, "Found 'API: ' in HTML!"
    print("[PASS] Header API status text is completely absent.")

    # 2. Verify Header elements
    assert "DEMO / SYNTHETIC DATA • INR" in html, "DEMO indicator missing!"
    assert "Methodology &amp; Disclaimer" in html or "Methodology & Disclaimer" in html, "Methodology button missing!"
    print("[PASS] Header contains branding, DEMO indicator, and Methodology button.")

    # 3. Verify Footer elements
    assert "https://github.com/M4yank09/JerichoFin" in html, "GitHub link missing in footer!"
    assert "made with ♥ by Team Jericho" in html, "Team Jericho attribution missing in footer!"
    assert "Institutional Capital Allocation &amp; Treasury Risk Platform (INR Sovereign &amp; Credit Universe)" not in html, "Old footer boilerplate still present!"
    print("[PASS] Footer contains ONLY GitHub link and Team Jericho attribution.")

    # 4. Verify no raw broken LaTeX
    latex_patterns = [r"\\frac", r"\\sum", r"\\alpha", r"\\begin", r"\\in\b"]
    for pattern in latex_patterns:
        match = re.search(pattern, html)
        assert not match, f"Found raw LaTeX matching {pattern} in HTML: {match.group(0)}"
    print("[PASS] No raw LaTeX strings (\frac, \sum, \alpha, \begin) present in HTML.")

def test_stress_restored():
    print("\n=== Testing Stress Lab Restored State on http://127.0.0.1:8000/api/v1/stress/run ===")
    payload = {
        "capital": 1_000_000_000.0,
        "weights": {
            "INR_CASH": 0.05,
            "IN_TBILL_91D": 0.05,
            "IN_CP_90D": 0.10,
            "IN_CD_3M": 0.10,
            "IN_GSEC_10Y": 0.10,
            "IN_CORP_AAA": 0.30,
            "IN_GOLD": 0.15,
            "IN_EQUITY_LARGE": 0.15,
        },
        "scenario_id": "COMBINED_MACRO_SHOCK",
        "trigger_defensive_on_breach": True,
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request("http://127.0.0.1:8000/api/v1/stress/run", data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as response:
        res = json.loads(response.read().decode("utf-8"))

    stressed_val = res["stressed_portfolio_value"]
    def_resp = res["defensive_response"]
    assert def_resp is not None, "Defensive response not triggered!"
    post_rebal_val = def_resp.get("post_rebalance_capital")

    print(f"Base Portfolio Value:    INR {res['base_portfolio_value']:,.2f}")
    print(f"Stressed Portfolio Value:INR {stressed_val:,.2f} (Policy: {res['policy_status']})")
    print(f"Restored Portfolio Value:INR {post_rebal_val:,.2f} (Policy: {def_resp['post_rebalance_status']})")
    print(f"Turnover:                {def_resp['turnover']:.2%}")
    print(f"Rebalance Friction:      INR {def_resp.get('rebalance_cost', 0):,.2f}")

    assert stressed_val != post_rebal_val, "Stressed value EQUALS Restored value!"
    assert post_rebal_val < stressed_val, "Restored value should account for execution friction!"
    assert def_resp["turnover"] > 0, "Turnover should be positive!"
    assert def_resp["post_rebalance_status"] == "NORMAL", "Defensive response did not restore to NORMAL!"
    print("[PASS] UNDER STRESS value != JERIFIN RESTORED value when rebalance occurs.")
    print("[PASS] Defensive response restores policy state to NORMAL.")

def test_rebalance_endpoint():
    print("\n=== Testing Rebalance Endpoint on http://127.0.0.1:8000/api/v1/risk/rebalance ===")
    payload = {
        "capital": 1_000_000_000.0,
        "current_weights": {
            "INR_CASH": 0.05,
            "IN_TBILL_91D": 0.42, # Breaches 35% cap
            "IN_CP_90D": 0.15,
            "IN_CD_3M": 0.10,
            "IN_GSEC_10Y": 0.15,
            "IN_CORP_AAA": 0.08,
            "IN_GOLD": 0.05,
        },
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request("http://127.0.0.1:8000/api/v1/risk/rebalance", data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as response:
        res = json.loads(response.read().decode("utf-8"))

    print(f"Status: {res['status']}")
    print(f"Initial State: {res['initial_status']} -> Post-Rebalance State: {res['post_rebalance_status']}")
    print(f"Turnover: {res['turnover']:.2%}")
    print(f"Pre-Rebalance IN_TBILL_91D: {res['current_weights']['IN_TBILL_91D']:.2%}")
    print(f"Recommended   IN_TBILL_91D: {res['defensive_weights']['IN_TBILL_91D']:.2%}")

    assert res["status"] == "SUCCESS", "Rebalance status not SUCCESS!"
    assert res["initial_status"] in ("BREACH", "CRITICAL"), "Initial state should be breach!"
    assert res["post_rebalance_status"] == "NORMAL", "Post rebalance state should be NORMAL!"
    assert res["defensive_weights"]["IN_TBILL_91D"] <= 0.35, "IN_TBILL_91D exceeded 35% cap!"
    print("[PASS] Rebalance solver restored compliance from BREACH to NORMAL.")

if __name__ == "__main__":
    test_ssr_html()
    test_stress_restored()
    test_rebalance_endpoint()
    print("\nALL VERIFICATIONS PASSED SUCCESSFULLY!")

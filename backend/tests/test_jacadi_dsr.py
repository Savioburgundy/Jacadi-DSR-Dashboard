"""
Jacadi DSR Dashboard - Backend API Tests
Tests authentication, dashboard endpoints, and data retrieval
"""
import pytest
import requests
import os

# Use the Vite proxy URL for testing (same as frontend)
BASE_URL = "http://localhost:8001"

# Test credentials
TEST_EMAIL = "admin@example.com"
TEST_PASSWORD = "password"


class TestAuthentication:
    """Authentication endpoint tests"""
    
    def test_login_success(self):
        """Test successful login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_EMAIL
        assert data["user"]["role"] == "admin"
        assert isinstance(data["token"], str)
        assert len(data["token"]) > 0
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "wrong@example.com", "password": "wrongpass"}
        )
        assert response.status_code == 401
        data = response.json()
        assert "message" in data
    
    def test_login_missing_fields(self):
        """Test login with missing fields"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL}
        )
        # Should fail without password
        assert response.status_code in [400, 401, 500]


class TestHealthEndpoints:
    """Health check endpoint tests"""
    
    def test_health_endpoint(self):
        """Test health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "timestamp" in data


@pytest.fixture
def auth_token():
    """Get authentication token for protected endpoints"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    if response.status_code == 200:
        return response.json()["token"]
    pytest.skip("Authentication failed - skipping authenticated tests")


class TestDashboardEndpoints:
    """Dashboard data endpoint tests"""
    
    def test_dashboard_summary(self, auth_token):
        """Test dashboard summary endpoint returns KPI data"""
        response = requests.get(
            f"{BASE_URL}/api/dashboards/default/summary",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # Verify KPI fields exist
        assert "total_revenue" in data
        assert "total_transactions" in data
        assert "avg_transaction_value" in data
        assert "total_locations" in data
        # Verify data types
        assert isinstance(data["total_revenue"], (int, float))
        assert isinstance(data["total_transactions"], (int, float))
        assert data["total_locations"] >= 0
    
    def test_retail_performance(self, auth_token):
        """Test retail performance endpoint returns location data"""
        response = requests.get(
            f"{BASE_URL}/api/dashboards/default/retail-performance",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should have at least one location
        if len(data) > 0:
            location = data[0]
            assert "Location" in location
            assert "MTD_RETAIL_SALE" in location
            assert "MTD_WHATSAPP_SALE" in location
    
    def test_retail_efficiency(self, auth_token):
        """Test retail efficiency endpoint returns conversion metrics"""
        response = requests.get(
            f"{BASE_URL}/api/dashboards/default/retail-efficiency",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            location = data[0]
            assert "Location" in location
            assert "MTD_ATV" in location
            assert "MTD_BASKET_SIZE" in location
    
    def test_whatsapp_sales_breakdown(self, auth_token):
        """Test whatsapp sales breakdown endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/dashboards/default/whatsapp-sales-breakdown",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            location = data[0]
            assert "Location" in location
            assert "MTD_RETAIL_SALES" in location
            assert "MTD_WHATSAPP_SALES" in location
    
    def test_omni_channel_tm_lm(self, auth_token):
        """Test omni channel TM vs LM endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/dashboards/default/omni-channel-tm-lm",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            location = data[0]
            assert "Location" in location
            assert "MTD_SALE" in location
            assert "PM_SALE" in location
    
    def test_omni_channel_details(self, auth_token):
        """Test omni channel details endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/dashboards/default/omni-channel-details",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_retail_omni_total(self, auth_token):
        """Test retail + omni total endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/dashboards/default/retail-omni-total",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_latest_date(self, auth_token):
        """Test latest date endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/dashboards/latest-date",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "date" in data
        # Date should be in YYYY-MM-DD format
        assert len(data["date"]) == 10


class TestDashboardFilters:
    """Test dashboard endpoints with filters"""
    
    def test_summary_with_date_range(self, auth_token):
        """Test summary with date range filter"""
        response = requests.get(
            f"{BASE_URL}/api/dashboards/default/summary",
            params={"startDate": "2026-01-01", "endDate": "2026-01-30"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_revenue" in data
    
    def test_retail_performance_with_location_filter(self, auth_token):
        """Test retail performance with location filter"""
        response = requests.get(
            f"{BASE_URL}/api/dashboards/default/retail-performance",
            params={"location": "Jacadi Palladium"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should only return Jacadi Palladium data
        if len(data) > 0:
            assert data[0]["Location"] == "Jacadi Palladium"


class TestFilterEndpoints:
    """Test filter dropdown data endpoints"""
    
    def test_get_locations(self, auth_token):
        """Test locations endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/dashboards/default/locations",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should have at least one location
        assert len(data) >= 1
    
    def test_get_brands(self, auth_token):
        """Test brands endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/dashboards/default/brands",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_categories(self, auth_token):
        """Test categories endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/dashboards/default/categories",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestAuthorizationProtection:
    """Test that endpoints are properly protected"""
    
    def test_dashboard_requires_auth(self):
        """Test dashboard endpoints require authentication"""
        response = requests.get(f"{BASE_URL}/api/dashboards/default/summary")
        # Should return 401 or 403 without token
        assert response.status_code in [401, 403]
    
    def test_invalid_token_rejected(self):
        """Test invalid token is rejected"""
        response = requests.get(
            f"{BASE_URL}/api/dashboards/default/summary",
            headers={"Authorization": "Bearer invalid_token_here"}
        )
        assert response.status_code in [401, 403]


class TestDataIntegrity:
    """Test data integrity and consistency"""
    
    def test_locations_match_across_endpoints(self, auth_token):
        """Verify locations are consistent across endpoints"""
        # Get locations from filter endpoint
        locations_response = requests.get(
            f"{BASE_URL}/api/dashboards/default/locations",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        filter_locations = set(locations_response.json())
        
        # Get locations from retail performance
        perf_response = requests.get(
            f"{BASE_URL}/api/dashboards/default/retail-performance",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        perf_locations = set(row["Location"] for row in perf_response.json())
        
        # Performance locations should be subset of filter locations
        assert perf_locations.issubset(filter_locations) or len(perf_locations) == 0
    
    def test_summary_totals_reasonable(self, auth_token):
        """Verify summary totals are reasonable"""
        response = requests.get(
            f"{BASE_URL}/api/dashboards/default/summary",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        data = response.json()
        
        # Revenue should be positive or zero
        assert data["total_revenue"] >= 0
        # Transactions should be positive or zero
        assert data["total_transactions"] >= 0
        # ATV should be reasonable (if transactions > 0)
        if data["total_transactions"] > 0:
            assert data["avg_transaction_value"] > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

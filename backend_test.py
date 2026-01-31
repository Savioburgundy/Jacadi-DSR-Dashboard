#!/usr/bin/env python3
"""
Jacadi DSR Dashboard Backend API Testing
Tests all authentication, dashboard metrics, and data management endpoints
"""

import requests
import sys
import json
import io
from datetime import datetime, timedelta

class JacadiDSRTester:
    def __init__(self, base_url="https://dsr-dashboard.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_data = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {name}")
        if details:
            print(f"    {details}")
        if success:
            self.tests_passed += 1
        else:
            self.failed_tests.append({"name": name, "details": details})
        print()

    def make_request(self, method, endpoint, data=None, files=None, expected_status=200):
        """Make HTTP request with proper headers"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
        if files:
            # Remove Content-Type for file uploads
            headers.pop('Content-Type', None)

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    response = requests.post(url, headers=headers, files=files, data=data)
                else:
                    response = requests.post(url, headers=headers, json=data)
            elif method == 'PUT':
                response = requests.put(url, headers=headers, json=data)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)
            else:
                return False, {"error": f"Unsupported method: {method}"}

            success = response.status_code == expected_status
            try:
                response_data = response.json()
            except:
                response_data = {"text": response.text, "status_code": response.status_code}

            return success, response_data

        except Exception as e:
            return False, {"error": str(e)}

    def test_health_check(self):
        """Test basic health endpoints"""
        print("🔍 Testing Health Endpoints...")
        
        # Test root endpoint
        success, response = self.make_request('GET', '', expected_status=200)
        self.log_test("Root endpoint (/api/)", success, 
                     f"Response: {response.get('message', 'No message')}" if success else f"Error: {response}")
        
        # Test health endpoint
        success, response = self.make_request('GET', 'health', expected_status=200)
        self.log_test("Health endpoint (/api/health)", success,
                     f"Status: {response.get('status', 'Unknown')}" if success else f"Error: {response}")

    def test_authentication(self):
        """Test user registration and login"""
        print("🔍 Testing Authentication...")
        
        # Test user registration
        test_email = f"test_admin_{datetime.now().strftime('%H%M%S')}@jacadi.com"
        register_data = {
            "email": test_email,
            "password": "TestPass123!",
            "name": "Test Admin User",
            "role": "admin"
        }
        
        success, response = self.make_request('POST', 'auth/register', data=register_data, expected_status=200)
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_data = response['user']
            self.log_test("User Registration", True, f"User ID: {self.user_data['id']}, Role: {self.user_data['role']}")
        else:
            self.log_test("User Registration", False, f"Error: {response}")
            return False

        # Test login with existing admin user
        login_data = {
            "email": "admin@jacadi.com",
            "password": "admin123"
        }
        
        success, response = self.make_request('POST', 'auth/login', data=login_data, expected_status=200)
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_data = response['user']
            self.log_test("Admin Login", True, f"User: {self.user_data['email']}, Role: {self.user_data['role']}")
        else:
            self.log_test("Admin Login", False, f"Error: {response}")
            return False

        # Test /auth/me endpoint
        success, response = self.make_request('GET', 'auth/me', expected_status=200)
        self.log_test("Get Current User (/auth/me)", success,
                     f"User: {response.get('email', 'Unknown')}" if success else f"Error: {response}")

        return True

    def test_dashboard_metrics(self):
        """Test dashboard metrics endpoints"""
        print("🔍 Testing Dashboard Metrics...")
        
        if not self.token:
            self.log_test("Dashboard Metrics", False, "No authentication token available")
            return False

        # Test basic metrics endpoint
        success, response = self.make_request('GET', 'dashboard/metrics', expected_status=200)
        if success:
            metrics = ['net_revenue', 'net_quantity', 'transaction_count', 'atv', 'basket_size', 'multies_percentage', 'conversion_percentage']
            missing_metrics = [m for m in metrics if m not in response]
            if not missing_metrics:
                self.log_test("Dashboard Metrics", True, f"All 7 metrics present: {', '.join(metrics)}")
            else:
                self.log_test("Dashboard Metrics", False, f"Missing metrics: {missing_metrics}")
        else:
            self.log_test("Dashboard Metrics", False, f"Error: {response}")

        # Test metrics with filters
        success, response = self.make_request('GET', 'dashboard/metrics?store_location=Jacadi Palladium&sales_channel=Store', expected_status=200)
        self.log_test("Dashboard Metrics with Filters", success,
                     f"Filtered metrics retrieved" if success else f"Error: {response}")

        # Test comparison endpoint
        success, response = self.make_request('GET', 'dashboard/comparison', expected_status=200)
        if success:
            required_keys = ['mtd', 'last_month', 'mtd_change', 'ytd', 'last_year', 'ytd_change']
            missing_keys = [k for k in required_keys if k not in response]
            if not missing_keys:
                self.log_test("Dashboard Comparison", True, f"All comparison data present")
            else:
                self.log_test("Dashboard Comparison", False, f"Missing keys: {missing_keys}")
        else:
            self.log_test("Dashboard Comparison", False, f"Error: {response}")

        # Test chart data endpoint
        success, response = self.make_request('GET', 'dashboard/chart-data', expected_status=200)
        self.log_test("Dashboard Chart Data", success,
                     f"Chart data retrieved (length: {len(response) if isinstance(response, list) else 'N/A'})" if success else f"Error: {response}")

        # Test by-store endpoint
        success, response = self.make_request('GET', 'dashboard/by-store', expected_status=200)
        self.log_test("Dashboard By Store", success,
                     f"Store data retrieved" if success else f"Error: {response}")

        # Test by-channel endpoint
        success, response = self.make_request('GET', 'dashboard/by-channel', expected_status=200)
        self.log_test("Dashboard By Channel", success,
                     f"Channel data retrieved" if success else f"Error: {response}")

    def test_data_management(self):
        """Test data management endpoints"""
        print("🔍 Testing Data Management...")
        
        if not self.token:
            self.log_test("Data Management", False, "No authentication token available")
            return False

        # Test sync logs endpoint
        success, response = self.make_request('GET', 'data/sync-logs', expected_status=200)
        self.log_test("Sync Logs", success,
                     f"Sync logs retrieved (count: {len(response) if isinstance(response, list) else 'N/A'})" if success else f"Error: {response}")

        # Test transactions endpoint
        success, response = self.make_request('GET', 'data/transactions', expected_status=200)
        if success and isinstance(response, dict):
            self.log_test("Transactions List", True, f"Total transactions: {response.get('total', 0)}")
        else:
            self.log_test("Transactions List", False, f"Error: {response}")

        # Test CSV upload endpoints (create sample CSV data)
        sales_csv_content = """Invoice Number,Transaction Type,Transaction Date,Store,Channel,Gross Quantity,Net Quantity,Nett Invoice Value
TEST001,IV,2024-01-15,Jacadi Palladium,Store,2,2,10000
TEST002,IV,2024-01-15,Jacadi MOA,E-com,1,1,5000"""

        # Test sales CSV upload
        files = {'file': ('test_sales.csv', io.StringIO(sales_csv_content), 'text/csv')}
        success, response = self.make_request('POST', 'data/upload-sales', files=files, expected_status=200)
        if success:
            self.log_test("Sales CSV Upload", True, f"Records processed: {response.get('records_processed', 0)}")
        else:
            self.log_test("Sales CSV Upload", False, f"Error: {response}")

        # Test footfall CSV upload
        footfall_csv_content = """Date,Store,Footfall
2024-01-15,Jacadi Palladium,450
2024-01-15,Jacadi MOA,380"""

        files = {'file': ('test_footfall.csv', io.StringIO(footfall_csv_content), 'text/csv')}
        success, response = self.make_request('POST', 'data/upload-footfall', files=files, expected_status=200)
        if success:
            self.log_test("Footfall CSV Upload", True, f"Records processed: {response.get('records_processed', 0)}")
        else:
            self.log_test("Footfall CSV Upload", False, f"Error: {response}")

    def test_config_endpoints(self):
        """Test configuration endpoints"""
        print("🔍 Testing Configuration Endpoints...")
        
        # Test stores endpoint
        success, response = self.make_request('GET', 'config/stores', expected_status=200)
        if success and isinstance(response, list):
            expected_stores = ["Jacadi Palladium", "Jacadi MOA", "Shopify Webstore"]
            self.log_test("Config Stores", True, f"Stores: {response}")
        else:
            self.log_test("Config Stores", False, f"Error: {response}")

        # Test channels endpoint
        success, response = self.make_request('GET', 'config/channels', expected_status=200)
        if success and isinstance(response, list):
            expected_channels = ["Store", "E-com", "WhatsApp"]
            self.log_test("Config Channels", True, f"Channels: {response}")
        else:
            self.log_test("Config Channels", False, f"Error: {response}")

    def test_authorization(self):
        """Test authorization requirements"""
        print("🔍 Testing Authorization...")
        
        # Test protected endpoint without token
        old_token = self.token
        self.token = None
        
        success, response = self.make_request('GET', 'dashboard/metrics', expected_status=401)
        self.log_test("Protected Endpoint Without Token", success,
                     "Correctly rejected unauthorized request" if success else f"Unexpected response: {response}")
        
        # Test admin-only endpoint with invalid token
        self.token = "invalid_token"
        success, response = self.make_request('POST', 'data/upload-sales', expected_status=401)
        self.log_test("Admin Endpoint With Invalid Token", success,
                     "Correctly rejected invalid token" if success else f"Unexpected response: {response}")
        
        # Restore token
        self.token = old_token

    def run_all_tests(self):
        """Run all test suites"""
        print("🚀 Starting Jacadi DSR Dashboard Backend Tests")
        print("=" * 60)
        
        # Run test suites
        self.test_health_check()
        
        if self.test_authentication():
            self.test_dashboard_metrics()
            self.test_data_management()
            self.test_config_endpoints()
            self.test_authorization()
        else:
            print("❌ Authentication failed - skipping protected endpoint tests")
        
        # Print summary
        print("=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.failed_tests:
            print("\n❌ Failed Tests:")
            for test in self.failed_tests:
                print(f"  - {test['name']}: {test['details']}")
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        return self.tests_passed == self.tests_run

def main():
    """Main test execution"""
    tester = JacadiDSRTester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
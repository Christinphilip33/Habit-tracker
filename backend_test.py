#!/usr/bin/env python3
"""
HabitFlow Backend API Testing Suite
Tests all API endpoints for the HabitFlow habit tracking application.
"""

import requests
import sys
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

class HabitFlowAPITester:
    def __init__(self, base_url: str = "https://***REMOVED***"):
        self.base_url = base_url
        self.session = requests.Session()
        self.tests_run = 0
        self.tests_passed = 0
        self.user_data = {}
        self.habit_ids = []
        self.task_ids = []
        
    def log(self, message: str, level: str = "INFO"):
        """Log test messages with timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def run_test(self, name: str, method: str, endpoint: str, expected_status: int, 
                 data: Optional[Dict] = None, headers: Optional[Dict] = None) -> tuple[bool, Dict]:
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        test_headers = {'Content-Type': 'application/json'}
        if headers:
            test_headers.update(headers)
            
        self.tests_run += 1
        self.log(f"Testing {name}...")
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=test_headers)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = self.session.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=test_headers)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                self.log(f"✅ {name} - Status: {response.status_code}", "PASS")
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                self.log(f"❌ {name} - Expected {expected_status}, got {response.status_code}", "FAIL")
                try:
                    error_data = response.json()
                    self.log(f"   Error: {error_data}", "ERROR")
                except:
                    self.log(f"   Response: {response.text[:200]}", "ERROR")
                return False, {}
                
        except Exception as e:
            self.log(f"❌ {name} - Exception: {str(e)}", "FAIL")
            return False, {}
    
    def test_health_check(self) -> bool:
        """Test health endpoint"""
        success, data = self.run_test("Health Check", "GET", "/api/health", 200)
        if success and data.get("status") == "ok":
            self.log("✅ Health check passed - API is running")
            return True
        return False
    
    def test_auth_flow(self) -> bool:
        """Test complete authentication flow"""
        self.log("=== Testing Authentication Flow ===")
        
        # Test admin login
        admin_data = {"email": "admin@habitflow.com", "password": "***REMOVED***"}
        success, user_data = self.run_test("Admin Login", "POST", "/api/auth/login", 200, admin_data)
        
        if not success:
            self.log("❌ Admin login failed - cannot continue with authenticated tests", "CRITICAL")
            return False
            
        self.user_data = user_data
        self.log(f"✅ Logged in as: {user_data.get('name', 'Unknown')} ({user_data.get('email', 'Unknown')})")
        
        # Test /api/auth/me
        success, me_data = self.run_test("Get Current User", "GET", "/api/auth/me", 200)
        if success and me_data.get('email') == admin_data['email']:
            self.log("✅ /api/auth/me working correctly")
        else:
            self.log("❌ /api/auth/me failed or returned wrong data", "FAIL")
            
        # Test user registration (create test user)
        test_user_email = f"test_{datetime.now().strftime('%H%M%S')}@habitflow.com"
        register_data = {
            "email": test_user_email,
            "password": "testpass123",
            "name": "Test User"
        }
        success, reg_data = self.run_test("User Registration", "POST", "/api/auth/register", 200, register_data)
        
        if success:
            self.log(f"✅ User registration successful: {reg_data.get('email')}")
            
            # Test logout
            success, _ = self.run_test("Logout", "POST", "/api/auth/logout", 200)
            
            # Login back as admin for remaining tests
            success, _ = self.run_test("Admin Re-login", "POST", "/api/auth/login", 200, admin_data)
            
        return True
    
    def test_habits_crud(self) -> bool:
        """Test habits CRUD operations"""
        self.log("=== Testing Habits CRUD ===")
        
        # Get initial habits
        success, habits = self.run_test("Get Habits", "GET", "/api/habits", 200)
        if not success:
            return False
            
        initial_count = len(habits)
        self.log(f"Initial habits count: {initial_count}")
        
        # Create toggle habit
        toggle_habit = {
            "name": "Test Toggle Habit",
            "identity": "I am someone who tests habits",
            "category": "cat_health",
            "type": "toggle",
            "targetValue": 1,
            "frequency": {"type": "daily", "days": [], "interval": 2, "perMonth": 5}
        }
        success, habit_data = self.run_test("Create Toggle Habit", "POST", "/api/habits", 200, toggle_habit)
        if success and habit_data.get('id'):
            toggle_habit_id = habit_data['id']
            self.habit_ids.append(toggle_habit_id)
            self.log(f"✅ Created toggle habit with ID: {toggle_habit_id}")
        else:
            return False
            
        # Create numeric habit
        numeric_habit = {
            "name": "Test Numeric Habit",
            "identity": "I am someone who counts things",
            "category": "cat_fitness",
            "type": "numeric",
            "targetValue": 5,
            "unit": "reps",
            "frequency": {"type": "daily", "days": [], "interval": 2, "perMonth": 5}
        }
        success, habit_data = self.run_test("Create Numeric Habit", "POST", "/api/habits", 200, numeric_habit)
        if success and habit_data.get('id'):
            numeric_habit_id = habit_data['id']
            self.habit_ids.append(numeric_habit_id)
            self.log(f"✅ Created numeric habit with ID: {numeric_habit_id}")
        else:
            return False
            
        # Create timer habit
        timer_habit = {
            "name": "Test Timer Habit",
            "identity": "I am someone who times activities",
            "category": "cat_mind",
            "type": "timer",
            "duration": 15,
            "frequency": {"type": "daily", "days": [], "interval": 2, "perMonth": 5}
        }
        success, habit_data = self.run_test("Create Timer Habit", "POST", "/api/habits", 200, timer_habit)
        if success and habit_data.get('id'):
            timer_habit_id = habit_data['id']
            self.habit_ids.append(timer_habit_id)
            self.log(f"✅ Created timer habit with ID: {timer_habit_id}")
        else:
            return False
            
        # Test habit completion - toggle
        today_key = datetime.now().strftime("%Y-%m-%d")
        success, toggle_result = self.run_test(
            "Toggle Habit Complete", "POST", 
            f"/api/habits/{toggle_habit_id}/toggle", 
            200, {"dateKey": today_key}
        )
        if success and toggle_result.get('xpDelta') == 100:
            self.log("✅ Toggle habit completion gave +100 XP")
        else:
            self.log("❌ Toggle habit completion didn't give expected XP", "FAIL")
            
        # Test numeric habit increment
        success, numeric_result = self.run_test(
            "Increment Numeric Habit", "POST",
            f"/api/habits/{numeric_habit_id}/numeric",
            200, {"dateKey": today_key, "delta": 2}
        )
        if success:
            self.log(f"✅ Numeric habit incremented: {numeric_result}")
            
        # Test timer habit completion
        success, timer_result = self.run_test(
            "Complete Timer Habit", "POST",
            f"/api/habits/{timer_habit_id}/timer",
            200, {"dateKey": today_key, "action": "complete"}
        )
        if success:
            self.log("✅ Timer habit completed successfully")
            
        # Update habit
        update_data = {"name": "Updated Toggle Habit"}
        success, updated_habit = self.run_test(
            "Update Habit", "PUT", 
            f"/api/habits/{toggle_habit_id}", 
            200, update_data
        )
        if success and updated_habit.get('name') == "Updated Toggle Habit":
            self.log("✅ Habit update successful")
            
        return True
    
    def test_tasks_crud(self) -> bool:
        """Test tasks CRUD operations"""
        self.log("=== Testing Tasks CRUD ===")
        
        # Get initial tasks
        success, tasks = self.run_test("Get Tasks", "GET", "/api/tasks", 200)
        if not success:
            return False
            
        # Create task
        task_data = {
            "title": "Test Task",
            "dueDate": datetime.now().strftime("%Y-%m-%d"),
            "category": "cat_work"
        }
        success, created_task = self.run_test("Create Task", "POST", "/api/tasks", 200, task_data)
        if success and created_task.get('id'):
            task_id = created_task['id']
            self.task_ids.append(task_id)
            self.log(f"✅ Created task with ID: {task_id}")
        else:
            return False
            
        # Toggle task completion
        success, toggled_task = self.run_test(
            "Toggle Task Complete", "POST", 
            f"/api/tasks/{task_id}/toggle", 
            200
        )
        if success and toggled_task.get('completed') == True:
            self.log("✅ Task marked as completed")
        else:
            self.log("❌ Task toggle failed", "FAIL")
            
        # Update task
        update_data = {"title": "Updated Test Task"}
        success, updated_task = self.run_test(
            "Update Task", "PUT", 
            f"/api/tasks/{task_id}", 
            200, update_data
        )
        if success and updated_task.get('title') == "Updated Test Task":
            self.log("✅ Task update successful")
            
        return True
    
    def test_xp_system(self) -> bool:
        """Test XP system"""
        self.log("=== Testing XP System ===")
        
        success, xp_data = self.run_test("Get XP", "GET", "/api/xp", 200)
        if success:
            total_xp = xp_data.get('total', 0)
            week_xp = xp_data.get('weekXP', 0)
            self.log(f"✅ XP System - Total: {total_xp}, Week: {week_xp}")
            return True
        return False
    
    def test_categories(self) -> bool:
        """Test categories"""
        self.log("=== Testing Categories ===")
        
        success, categories = self.run_test("Get Categories", "GET", "/api/categories", 200)
        if success:
            self.log(f"✅ Found {len(categories)} categories")
            return True
        return False
    
    def test_settings_and_export(self) -> bool:
        """Test settings and data export"""
        self.log("=== Testing Settings & Export ===")
        
        # Get settings
        success, settings = self.run_test("Get Settings", "GET", "/api/settings", 200)
        if not success:
            return False
            
        # Test export
        success, export_data = self.run_test("Export Data", "GET", "/api/export", 200)
        if success and 'habits' in export_data and 'tasks' in export_data:
            self.log("✅ Data export successful")
            self.log(f"   Exported {len(export_data.get('habits', []))} habits, {len(export_data.get('tasks', []))} tasks")
        else:
            self.log("❌ Data export failed", "FAIL")
            
        return True
    
    def test_analytics(self) -> bool:
        """Test analytics endpoint"""
        self.log("=== Testing Analytics ===")
        
        success, analytics = self.run_test("Get Analytics", "GET", "/api/analytics", 200)
        if success:
            total_completions = analytics.get('totalCompletions', 0)
            habit_count = analytics.get('habitCount', 0)
            self.log(f"✅ Analytics - Completions: {total_completions}, Habits: {habit_count}")
            return True
        return False
    
    def cleanup(self) -> bool:
        """Clean up test data"""
        self.log("=== Cleaning Up Test Data ===")
        
        # Delete test habits
        for habit_id in self.habit_ids:
            success, _ = self.run_test(f"Delete Habit {habit_id}", "DELETE", f"/api/habits/{habit_id}", 200)
            if success:
                self.log(f"✅ Deleted habit {habit_id}")
                
        # Delete test tasks
        for task_id in self.task_ids:
            success, _ = self.run_test(f"Delete Task {task_id}", "DELETE", f"/api/tasks/{task_id}", 200)
            if success:
                self.log(f"✅ Deleted task {task_id}")
                
        return True
    
    def run_all_tests(self) -> bool:
        """Run all backend tests"""
        self.log("🚀 Starting HabitFlow Backend API Tests")
        self.log(f"Testing against: {self.base_url}")
        
        # Test sequence
        tests = [
            ("Health Check", self.test_health_check),
            ("Authentication Flow", self.test_auth_flow),
            ("Habits CRUD", self.test_habits_crud),
            ("Tasks CRUD", self.test_tasks_crud),
            ("XP System", self.test_xp_system),
            ("Categories", self.test_categories),
            ("Settings & Export", self.test_settings_and_export),
            ("Analytics", self.test_analytics),
            ("Cleanup", self.cleanup),
        ]
        
        failed_tests = []
        
        for test_name, test_func in tests:
            try:
                if not test_func():
                    failed_tests.append(test_name)
                    self.log(f"❌ {test_name} test suite failed", "FAIL")
                else:
                    self.log(f"✅ {test_name} test suite passed", "PASS")
            except Exception as e:
                failed_tests.append(test_name)
                self.log(f"❌ {test_name} test suite crashed: {str(e)}", "ERROR")
        
        # Final results
        self.log("=" * 50)
        self.log(f"📊 Test Results: {self.tests_passed}/{self.tests_run} tests passed")
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        self.log(f"📈 Success Rate: {success_rate:.1f}%")
        
        if failed_tests:
            self.log(f"❌ Failed test suites: {', '.join(failed_tests)}", "FAIL")
            return False
        else:
            self.log("🎉 All test suites passed!", "PASS")
            return True

def main():
    """Main test runner"""
    tester = HabitFlowAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
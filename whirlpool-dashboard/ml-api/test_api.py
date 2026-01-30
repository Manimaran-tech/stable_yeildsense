
import requests
import json

url = "http://localhost:5000/api/farming/quick-analysis"
payload = {
    "token_a": "sol",
    "token_b": "usdc"
}
headers = {
    "Content-Type": "application/json"
}

try:
    response = requests.post(url, json=payload, headers=headers)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")

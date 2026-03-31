from fastapi.testclient import TestClient
from app import app

client = TestClient(app)

def test_api_is_alive():
    # This tests if your backend boots up and the API documentation is reachable
    response = client.get("/docs")
    assert response.status_code == 200

def test_compressor_endpoint_exists():
    # We expect a 422 error because we aren't sending a file, 
    # but it proves the route exists and isn't broken!
    response = client.post("/process-compress")
    assert response.status_code == 422
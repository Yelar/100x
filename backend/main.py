from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from pydantic import BaseModel
import os
from dotenv import load_dotenv
import json
from pathlib import Path
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

app = FastAPI()

# Configure CORS - Allow specific frontend URL
FRONTEND_URL = "http://localhost:3000"
BACKEND_URL = "http://localhost:8000"

logger.info(f"Configuring CORS: Frontend URL: {FRONTEND_URL}")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# OAuth2 configuration
CLIENT_SECRETS_FILE = "credentials.json"
SCOPES = ['https://www.googleapis.com/auth/userinfo.profile',
          'https://www.googleapis.com/auth/userinfo.email',
          'openid']

REDIRECT_URI = f"{FRONTEND_URL}/auth/callback"
logger.info(f"Redirect URI: {REDIRECT_URI}")

@app.on_event("startup")
async def startup_event():
    logger.info("Starting up FastAPI application")
    # Check if client_secrets.json exists
    if not os.path.exists(CLIENT_SECRETS_FILE):
        logger.error(f"{CLIENT_SECRETS_FILE} not found!")
    else:
        logger.info(f"{CLIENT_SECRETS_FILE} found")
        with open(CLIENT_SECRETS_FILE, 'r') as f:
            content = json.load(f)
            logger.info(f"Client secrets configured with redirect URIs: {content.get('web', {}).get('redirect_uris', [])}")

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    refresh_token: str
    scope: str
    expires_in: int

@app.get("/")
async def root():
    return {"status": "ok", "frontend_url": FRONTEND_URL, "backend_url": BACKEND_URL}

@app.get("/api/auth/google")
async def google_auth(request: Request):
    try:
        logger.info(f"Received auth request from: {request.client.host}")
        
        # Log request headers for debugging
        headers = dict(request.headers)
        logger.info(f"Request headers: {headers}")
        
        flow = Flow.from_client_secrets_file(
            CLIENT_SECRETS_FILE,
            scopes=SCOPES,
            redirect_uri=REDIRECT_URI
        )
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true'
        )
        
        logger.info(f"Generated authorization URL: {authorization_url}")
        return {"url": authorization_url}
    except Exception as e:
        logger.error(f"Error in google_auth: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/auth/google/callback")
async def google_callback(code: str, request: Request):
    try:
        logger.info("Received callback with code")
        logger.info(f"Request headers: {dict(request.headers)}")
        
        flow = Flow.from_client_secrets_file(
            CLIENT_SECRETS_FILE,
            scopes=SCOPES,
            redirect_uri=REDIRECT_URI
        )
        
        logger.info("Fetching token from Google")
        flow.fetch_token(code=code)
        credentials = flow.credentials
        
        # Get user info
        logger.info("Getting user info from Google")
        service = build('oauth2', 'v2', credentials=credentials)
        user_info = service.userinfo().get().execute()
        logger.info(f"Received user info for email: {user_info.get('email')}")
        
        # Save credentials to a file (in production, use a secure database)
        credentials_data = {
            "token": credentials.token,
            "refresh_token": credentials.refresh_token,
            "token_uri": credentials.token_uri,
            "client_id": credentials.client_id,
            "client_secret": credentials.client_secret,
            "scopes": credentials.scopes
        }
        
        # Create tokens directory if it doesn't exist
        Path("tokens").mkdir(exist_ok=True)
        
        # Save user info and credentials
        token_file = f"tokens/{user_info['email']}.json"
        with open(token_file, "w") as f:
            json.dump({
                "user_info": user_info,
                "credentials": credentials_data
            }, f)
        logger.info(f"Saved user info and credentials to {token_file}")
        
        return {
            "user_info": user_info,
            "access_token": credentials.token,
            "refresh_token": credentials.refresh_token
        }
    except Exception as e:
        logger.error(f"Error in google_callback: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/user")
async def get_user_info(email: str):
    try:
        with open(f"tokens/{email}.json", "r") as f:
            data = json.load(f)
            return data["user_info"]
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="User not found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="localhost", port=8000) 
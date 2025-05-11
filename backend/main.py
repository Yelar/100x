from fastapi import FastAPI, HTTPException, Depends, Request, Body
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
SCOPES = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/userinfo.profile',
    'openid'
]

# Get redirect URI from credentials file
with open(CLIENT_SECRETS_FILE, 'r') as f:
    client_secrets = json.load(f)
    web_config = client_secrets.get('web', {})
    REDIRECT_URI = web_config.get('redirect_uris', [""])[0]
    logger.info(f"Loaded redirect URI from credentials: {REDIRECT_URI}")

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    refresh_token: str
    scope: str
    expires_in: int

class AuthCode(BaseModel):
    code: str

@app.post("/api/auth/google/callback")
async def google_callback(request: Request):
    try:
        logger.info("Received callback request")
        body = await request.json()
        logger.info(f"Request body: {body}")
        
        if not body.get('code'):
            logger.error("No code found in request body")
            raise HTTPException(status_code=400, detail="No authentication code provided")
            
        code = body['code']
        logger.info(f"Code received: {code[:10]}...")  # Log first 10 chars of code for debugging
        
        flow = Flow.from_client_secrets_file(
            CLIENT_SECRETS_FILE,
            scopes=SCOPES,
            redirect_uri=REDIRECT_URI
        )
        
        try:
            logger.info("Fetching token from Google")
            flow.fetch_token(code=code)
            credentials = flow.credentials
            logger.info("Successfully obtained credentials from Google")
        except Exception as token_error:
            logger.error(f"Error fetching token: {str(token_error)}")
            raise HTTPException(status_code=400, detail=f"Failed to fetch token: {str(token_error)}")
        
        try:
            # Get user info
            logger.info("Getting user info from Google")
            service = build('oauth2', 'v2', credentials=credentials)
            user_info = service.userinfo().get().execute()
            logger.info(f"Received user info for email: {user_info.get('email')}")
        except Exception as user_info_error:
            logger.error(f"Error getting user info: {str(user_info_error)}")
            raise HTTPException(status_code=400, detail=f"Failed to get user info: {str(user_info_error)}")
        
        # Save credentials to a file (in production, use a secure database)
        credentials_data = {
            "token": credentials.token,
            "refresh_token": credentials.refresh_token,
            "token_uri": credentials.token_uri,
            "client_id": credentials.client_id,
            "client_secret": credentials.client_secret,
            "scopes": credentials.scopes
        }
        
        try:
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
        except Exception as save_error:
            logger.error(f"Error saving credentials: {str(save_error)}")
            # Don't raise an exception here, as we still want to return the tokens
        
        response_data = {
            "user_info": user_info,
            "access_token": credentials.token,
            "refresh_token": credentials.refresh_token
        }
        logger.info("Successfully prepared response data")
        
        # Redirect to frontend with the data
        return response_data
        
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Unexpected error in google_callback: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def root():
    return {"status": "ok", "frontend_url": FRONTEND_URL, "backend_url": BACKEND_URL}

@app.get("/api/auth/google")
async def google_auth(request: Request):
    try:
        logger.info(f"Received auth request from: {request.client.host}")
        
        flow = Flow.from_client_secrets_file(
            CLIENT_SECRETS_FILE,
            scopes=SCOPES,
            redirect_uri=REDIRECT_URI
        )
        
        # Include prompt='consent' to ensure user sees scope changes
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent'
        )
        
        logger.info(f"Generated authorization URL with scopes: {SCOPES}")
        return {"url": authorization_url}
    except Exception as e:
        logger.error(f"Error in google_auth: {str(e)}", exc_info=True)
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
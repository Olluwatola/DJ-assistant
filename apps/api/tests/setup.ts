// Set env vars before any module that reads them (config.ts) is imported.
process.env.PORT = "4001";
process.env.MONGO_URI = "mongodb://localhost:27017/dj-test";
process.env.JWT_SECRET = "test_jwt_secret_32_chars_minimum!!";
process.env.SPOTIFY_CLIENT_ID = "test_spotify_client_id";
process.env.SPOTIFY_CLIENT_SECRET = "test_spotify_client_secret";
process.env.SPOTIFY_REDIRECT_URI = "http://localhost:4001/api/spotify/callback";
process.env.FRONTEND_URL = "http://localhost:5173";
process.env.GETSONGBPM_API_KEY = "test_getsongbpm_api_key";

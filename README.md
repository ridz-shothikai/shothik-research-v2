# DeepResearch Node.js Backend

A Node.js backend clone of the Python LangGraph research agent, providing AI-powered research capabilities with web search, reflection, and iterative improvement.

## Features

- **Multi-step Research Process**: Query generation, web research, image search, reflection, and finalization
- **AI-Powered**: Uses Google Gemini 2.0 Flash for intelligent processing
- **Image Search**: Integrated Google Custom Search API for relevant images
- **Citation Management**: Automatic source gathering and citation handling
- **MongoDB Integration**: Persistent storage for research sessions and results
- **RESTful API**: Clean API endpoints for frontend integration
- **Rate Limited**: Built-in rate limiting for API protection

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and configuration
   ```

3. **Start MongoDB**
   ```bash
   # Make sure MongoDB is running locally or update MONGODB_URI in .env
   mongod
   ```

4. **Run the Application**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## API Endpoints

- `POST /api/research` - Start a new research session
- `GET /api/research/:id` - Get research session results
- `GET /api/research/:id/stream` - Stream research progress (SSE)
- `GET /health` - Health check endpoint

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | Google Gemini API key (also used for Custom Search) | Yes |
| `GOOGLE_CUSTOM_SEARCH_ENGINE_ID` | Google Custom Search Engine ID for image search | Optional* |
| `MONGODB_URI` | MongoDB connection string | Yes |
| `PORT` | Server port (default: 3000) | No |
| `NODE_ENV` | Environment (development/production) | No |

*Note: Image search will be skipped if `GOOGLE_CUSTOM_SEARCH_ENGINE_ID` is not provided.

## Google Custom Search Setup (for Image Search)

To enable image search functionality:

1. **Create a Custom Search Engine**:
   - Go to [Google Custom Search Engine](https://cse.google.com/cse/)
   - Click "Add" to create a new search engine
   - Enter `*.com` as the site to search (or specific domains)
   - Get your Search Engine ID from the setup page

2. **Enable Image Search**:
   - In your Custom Search Engine settings
   - Go to "Setup" → "Basics"
   - Turn on "Image search"
   - Turn on "Safe search"

3. **Add to Environment**:
   ```bash
   GOOGLE_CUSTOM_SEARCH_ENGINE_ID=your_search_engine_id_here
   ```

## Architecture

The backend follows a modular architecture similar to the Python version:

- **Controllers**: Handle HTTP requests and responses
- **Services**: Business logic and AI orchestration
- **Models**: MongoDB schemas and data models
- **Utils**: Helper functions and utilities
- **Config**: Configuration and environment setup

## Development

```bash
# Install dependencies
npm install

# Run in development mode with auto-reload
npm run dev

# Run tests
npm test
```

## License

MIT License

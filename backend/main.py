from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import logging
from .services.ingestion import GexIngestionService
from .services.basis import BasisService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("main")

app = FastAPI(title="GexLab v2 API")

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to localhost:3000
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global store
state = {
    "raw_data": {},
    "basis": {},
    "is_running": False
}

ingestion_service = GexIngestionService("SPY")

async def update_data_loop():
    """Background loop to refresh market data."""
    state["is_running"] = True
    while state["is_running"]:
        try:
            logger.info("Background update starting...")
            # 1. Fetch raw options chain
            raw_data = ingestion_service.fetch_full_chain(expiries_to_fetch=3)
            state["raw_data"] = raw_data
            
            # 2. Fetch basis
            basis_data = BasisService.get_futures_basis("SPY")
            state["basis"] = basis_data
            
            logger.info("Background update successful.")
        except Exception as e:
            logger.error(f"Error in background update: {e}")
        
        # Wait 30 seconds before next refresh
        await asyncio.sleep(30)

@app.on_event("startup")
async def startup_event():
    # Start the background poller
    asyncio.create_task(update_data_loop())

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "GexLab v2 Backend",
        "polling": state["is_running"]
    }

@app.get("/api/metrics/raw")
async def get_raw_metrics():
    """Returns the latest raw options chain data and basis info."""
    return {
        "metrics": state["raw_data"],
        "basis": state["basis"]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

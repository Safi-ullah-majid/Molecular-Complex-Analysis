#!/usr/bin/env python3
"""
FastAPI Backend for Molecular Complex Analyzer
Serves both API and frontend
"""

from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, Dict, Any
import os
import uuid
import json
import shutil
from pathlib import Path

try:
    from analyzer import MolecularComplexAnalyzer
except ImportError:
    print("Warning: analyzer.py not found")
    MolecularComplexAnalyzer = None

app = FastAPI(title="Molecular Complex Analyzer API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path("uploads")
RESULTS_DIR = Path("results")
UPLOAD_DIR.mkdir(exist_ok=True)
RESULTS_DIR.mkdir(exist_ok=True)

jobs_db = {}

class AnalysisSettings(BaseModel):
    model: str = "gemnet_oc"
    device: str = "cuda"
    fmax: float = 0.05
    steps: int = 200
    separation: float = 3.0
    method: str = "B3LYP"
    basis: str = "6-31G(d)"
    charge: int = 0
    multiplicity: int = 1

class AnalysisRequest(BaseModel):
    absorbent_file_id: str
    analyte_file_id: str
    settings: AnalysisSettings

async def run_analysis_task(job_id: str, absorbent_path: str, analyte_path: str, settings: AnalysisSettings):
    try:
        jobs_db[job_id]["status"] = "processing"
        jobs_db[job_id]["progress"] = 10
        jobs_db[job_id]["message"] = "Initializing..."
        
        if MolecularComplexAnalyzer is None:
            raise Exception("Analyzer not available")
        
        analyzer = MolecularComplexAnalyzer(fairchem_model=settings.model, device=settings.device)
        
        jobs_db[job_id]["progress"] = 20
        jobs_db[job_id]["message"] = "Parsing structures..."
        absorbent = analyzer.parse_gjf_file(absorbent_path)
        analyte = analyzer.parse_gjf_file(analyte_path)
        
        jobs_db[job_id]["progress"] = 40
        jobs_db[job_id]["message"] = "Optimizing absorbent..."
        opt_absorbent = analyzer.optimize_structure(absorbent, fmax=settings.fmax, steps=settings.steps)
        
        jobs_db[job_id]["progress"] = 60
        jobs_db[job_id]["message"] = "Optimizing analyte..."
        opt_analyte = analyzer.optimize_structure(analyte, fmax=settings.fmax, steps=settings.steps)
        
        jobs_db[job_id]["progress"] = 70
        jobs_db[job_id]["message"] = "Creating complex..."
        initial_complex = analyzer.create_complex(opt_absorbent, opt_analyte, settings.separation)
        
        jobs_db[job_id]["progress"] = 85
        jobs_db[job_id]["message"] = "Optimizing complex..."
        final_complex = analyzer.optimize_complex(initial_complex, fmax=settings.fmax, steps=settings.steps)
        
        jobs_db[job_id]["progress"] = 95
        jobs_db[job_id]["message"] = "Calculating properties..."
        properties = analyzer.calculate_properties(final_complex)
        
        result_prefix = RESULTS_DIR / job_id
        output_gjf = f"{result_prefix}_optimized.gjf"
        
        analyzer.save_gjf_file(final_complex, output_gjf, title="Optimized Complex",
                              method=settings.method, basis=settings.basis,
                              charge=settings.charge, multiplicity=settings.multiplicity)
        
        results = {
            "status": "success",
            "structures": {
                "absorbent_atoms": len(absorbent),
                "analyte_atoms": len(analyte),
                "complex_atoms": len(final_complex)
            },
            "properties": properties,
            "files": {"optimized_structure": output_gjf, "job_id": job_id}
        }
        
        with open(f"{result_prefix}_results.json", 'w') as f:
            json.dump(results, f, indent=2)
        
        jobs_db[job_id]["status"] = "completed"
        jobs_db[job_id]["progress"] = 100
        jobs_db[job_id]["message"] = "Complete!"
        jobs_db[job_id]["results"] = results
        
    except Exception as e:
        jobs_db[job_id]["status"] = "failed"
        jobs_db[job_id]["error"] = str(e)
        jobs_db[job_id]["message"] = f"Failed: {str(e)}"

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    if not file.filename.endswith('.gjf'):
        raise HTTPException(status_code=400, detail="Only .gjf files allowed")
    file_id = str(uuid.uuid4())
    file_path = UPLOAD_DIR / f"{file_id}.gjf"
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return {"file_id": file_id, "filename": file.filename, "message": "Upload successful"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@app.post("/api/analyze")
async def start_analysis(request: AnalysisRequest, background_tasks: BackgroundTasks):
    absorbent_path = UPLOAD_DIR / f"{request.absorbent_file_id}.gjf"
    analyte_path = UPLOAD_DIR / f"{request.analyte_file_id}.gjf"
    
    if not absorbent_path.exists():
        raise HTTPException(status_code=404, detail="Absorbent file not found")
    if not analyte_path.exists():
        raise HTTPException(status_code=404, detail="Analyte file not found")
    
    job_id = str(uuid.uuid4())
    jobs_db[job_id] = {"job_id": job_id, "status": "pending", "progress": 0,
                       "message": "Queued", "results": None, "error": None}
    
    background_tasks.add_task(run_analysis_task, job_id, str(absorbent_path),
                             str(analyte_path), request.settings)
    return {"job_id": job_id, "status": "pending"}

@app.get("/api/status/{job_id}")
async def get_status(job_id: str):
    if job_id not in jobs_db:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs_db[job_id]

@app.get("/api/download/{job_id}/{file_type}")
async def download_file(job_id: str, file_type: str):
    if job_id not in jobs_db:
        raise HTTPException(status_code=404, detail="Job not found")
    if jobs_db[job_id]["status"] != "completed":
        raise HTTPException(status_code=400, detail="Analysis not completed")
    
    if file_type == "structure":
        file_path = RESULTS_DIR / f"{job_id}_optimized.gjf"
    elif file_type == "results":
        file_path = RESULTS_DIR / f"{job_id}_results.json"
    else:
        raise HTTPException(status_code=400, detail="Invalid file type")
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path, filename=file_path.name)

@app.get("/health")
async def health():
    return {"status": "healthy", "active_jobs": len([j for j in jobs_db.values() if j["status"] == "processing"])}

# Serve frontend static files
frontend_build = Path("frontend/build")
if frontend_build.exists():
    app.mount("/static", StaticFiles(directory=str(frontend_build / "static")), name="static")
    
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404)
        file_path = frontend_build / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(frontend_build / "index.html")
else:
    @app.get("/")
    async def root():
        return {
            "name": "Molecular Complex Analyzer API",
            "version": "1.0.0",
            "status": "running",
            "message": "Frontend not built. Run: cd frontend && npm run build"
        }

if __name__ == "__main__":
    import uvicorn
    print("=" * 60)
    print("🧬 Molecular Complex Analyzer")
    print("=" * 60)
    print(f"📍 Running at: http://localhost:8000")
    print("=" * 60)
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")

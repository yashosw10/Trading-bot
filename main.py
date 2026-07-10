import uvicorn

if __name__ == "__main__":
    # This acts exactly like `python -m uvicorn api:app --reload`
    # but the background bot tasks are now hooked into the FastAPI lifespan!
    uvicorn.run("api:app", host="127.0.0.1", port=8000, reload=True)
